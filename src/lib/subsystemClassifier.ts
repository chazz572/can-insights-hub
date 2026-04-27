// Heuristic CAN ID → likely vehicle subsystem classifier.
// Pure, framework-agnostic. Used by Explain-This-Frame, Inferred Subsystems,
// and Live Analyzer to label unknown traffic without a DBC.
//
// Heuristics combine common OEM/J1939/UDS ID ranges with payload/timing shape.

export type Subsystem =
  | "Powertrain (ECM)"
  | "Transmission (TCM)"
  | "Brakes / ABS / ESC"
  | "Body (BCM)"
  | "Instrument Cluster"
  | "Infotainment"
  | "Steering / EPS"
  | "HVAC / Climate"
  | "Battery / BMS (EV/Hybrid)"
  | "Inverter / Drive Motor (EV)"
  | "Charging (EV)"
  | "Diagnostics (UDS/OBD-II)"
  | "Gateway / Network Mgmt"
  | "Suspension / Chassis"
  | "Airbag / SRS"
  | "Lighting / Exterior"
  | "Telematics / Comfort"
  | "Unknown";

export interface FrameLike {
  id: number;
  data?: number[];
  dlc?: number;
  hz?: number;
  count?: number;
}

export interface ClassificationResult {
  subsystem: Subsystem;
  confidence: number; // 0..1
  reasons: string[];
  status: "normal" | "watch" | "anomalous";
  tags: string[];
}

// Common 11-bit identifier ranges seen across OEMs (heuristic).
const RANGE_RULES: Array<{ test: (id: number) => boolean; subsystem: Subsystem; reason: string; weight: number }> = [
  { test: (id) => id >= 0x000 && id <= 0x0ff, subsystem: "Powertrain (ECM)", reason: "Low arbitration ID range — typically high-priority engine/torque traffic.", weight: 0.55 },
  { test: (id) => id >= 0x100 && id <= 0x1ff, subsystem: "Brakes / ABS / ESC", reason: "ID range commonly used for ABS/ESC and wheel-speed broadcasts.", weight: 0.55 },
  { test: (id) => id >= 0x200 && id <= 0x2ff, subsystem: "Transmission (TCM)", reason: "Range often carries gear/torque request and TCM status.", weight: 0.5 },
  { test: (id) => id >= 0x300 && id <= 0x3ff, subsystem: "Steering / EPS", reason: "Range commonly used by EPS / chassis controllers.", weight: 0.45 },
  { test: (id) => id >= 0x400 && id <= 0x4ff, subsystem: "Instrument Cluster", reason: "Range used by IPC for speed/RPM/odometer broadcasts.", weight: 0.5 },
  { test: (id) => id >= 0x500 && id <= 0x5ff, subsystem: "Body (BCM)", reason: "Range frequently used by BCM (doors, locks, lighting).", weight: 0.5 },
  { test: (id) => id >= 0x600 && id <= 0x6ff, subsystem: "HVAC / Climate", reason: "Mid range commonly used by climate / comfort modules.", weight: 0.4 },
  // UDS/OBD-II diagnostic IDs (11-bit)
  { test: (id) => id >= 0x700 && id <= 0x7ef, subsystem: "Diagnostics (UDS/OBD-II)", reason: "ISO-15765/UDS diagnostic request/response range.", weight: 0.85 },
  { test: (id) => id === 0x7df, subsystem: "Diagnostics (UDS/OBD-II)", reason: "OBD-II functional broadcast request ID.", weight: 0.95 },
];

// 29-bit / J1939 hints
const isExtendedJ1939 = (id: number) => id > 0x7ff && id <= 0x1fffffff;

const isUdsResponseShape = (data?: number[]) => {
  if (!data || data.length < 2) return false;
  // ISO-TP single-frame (first nibble 0) or first-frame (1) or consecutive (2)
  const pci = data[0] >> 4;
  return pci === 0 || pci === 1 || pci === 2 || pci === 3;
};

export const classifyFrame = (frame: FrameLike): ClassificationResult => {
  const reasons: string[] = [];
  const tags: string[] = [];
  let subsystem: Subsystem = "Unknown";
  let confidence = 0.15;
  let status: ClassificationResult["status"] = "normal";

  // 1. ID-range rules
  for (const rule of RANGE_RULES) {
    if (rule.test(frame.id)) {
      subsystem = rule.subsystem;
      confidence = rule.weight;
      reasons.push(rule.reason);
      break;
    }
  }

  // 2. J1939 / 29-bit
  if (isExtendedJ1939(frame.id)) {
    const pgn = (frame.id >> 8) & 0xffff;
    const sa = frame.id & 0xff;
    reasons.push(`Extended 29-bit ID (PGN ${pgn.toString(16).toUpperCase()}, SA ${sa.toString(16).toUpperCase()}) — J1939-style heavy-duty traffic.`);
    tags.push("J1939");
    if (pgn >= 0xf000 && pgn <= 0xfeff) {
      subsystem = "Powertrain (ECM)";
      confidence = Math.max(confidence, 0.7);
      reasons.push("PGN sits in proprietary broadcast band typical of engine/transmission ECUs.");
    } else {
      subsystem = subsystem === "Unknown" ? "Gateway / Network Mgmt" : subsystem;
      confidence = Math.max(confidence, 0.55);
    }
  }

  // 3. UDS/ISO-TP shape boosts diagnostics confidence
  if (isUdsResponseShape(frame.data) && frame.id >= 0x700 && frame.id <= 0x7ff) {
    confidence = Math.min(1, confidence + 0.1);
    tags.push("ISO-TP");
  }

  // 4. EV/Hybrid hints from very high cadence + 8-byte payloads
  if ((frame.hz ?? 0) >= 80 && (frame.dlc ?? frame.data?.length ?? 0) >= 7) {
    if (subsystem === "Unknown" || subsystem === "Powertrain (ECM)") {
      subsystem = "Inverter / Drive Motor (EV)";
      reasons.push("Very high frame rate with full payload — typical of inverter / drive-motor broadcasts.");
      confidence = Math.max(confidence, 0.6);
      tags.push("High-rate");
    }
  }

  // 5. BMS hint — moderate cadence, repeating wide payload at 0x180-0x1ef
  if (frame.id >= 0x180 && frame.id <= 0x1ef && (frame.dlc ?? 0) >= 6 && (frame.hz ?? 0) > 5 && (frame.hz ?? 0) < 50) {
    if (subsystem === "Brakes / ABS / ESC") {
      // keep brakes as primary but note BMS possibility
      reasons.push("Cadence + payload also resembles BMS cell-voltage broadcasts — verify against vehicle type.");
      tags.push("Possibly-BMS");
    }
  }

  // 6. Anomaly heuristics
  if (frame.dlc !== undefined && frame.data && frame.dlc !== frame.data.length) {
    status = "anomalous";
    reasons.push(`DLC (${frame.dlc}) does not match payload length (${frame.data.length}) — malformed frame.`);
  }
  if ((frame.hz ?? 0) > 500) {
    status = status === "anomalous" ? "anomalous" : "watch";
    reasons.push(`Extreme cadence (${frame.hz?.toFixed(0)} Hz) — possible bus flood or stuck transmitter.`);
  }
  if (frame.data && frame.data.length === 8 && frame.data.every((b) => b === 0)) {
    status = status === "anomalous" ? "anomalous" : "watch";
    reasons.push("All-zero payload across 8 bytes — module may be initializing or bus fault present.");
  }
  if (frame.data && frame.data.length === 8 && frame.data.every((b) => b === 0xff)) {
    status = "anomalous";
    reasons.push("All-0xFF payload — common signature for dropped/erroneous frame.");
  }

  if (subsystem === "Unknown") {
    reasons.push("ID does not match common OEM ranges; subsystem inferred only from payload/timing.");
  }

  return {
    subsystem,
    confidence: Math.max(0.1, Math.min(1, confidence)),
    reasons,
    status,
    tags,
  };
};

export interface SubsystemCluster {
  subsystem: Subsystem;
  ids: number[];
  totalCount: number;
  avgHz: number;
  anomalousCount: number;
  confidence: number;
}

export const clusterBySubsystem = (frames: FrameLike[]): SubsystemCluster[] => {
  const buckets = new Map<Subsystem, { ids: Set<number>; count: number; hzSum: number; hzN: number; conf: number; anomalies: number }>();
  for (const f of frames) {
    const r = classifyFrame(f);
    const b = buckets.get(r.subsystem) ?? { ids: new Set<number>(), count: 0, hzSum: 0, hzN: 0, conf: 0, anomalies: 0 };
    b.ids.add(f.id);
    b.count += f.count ?? 1;
    if (f.hz) { b.hzSum += f.hz; b.hzN += 1; }
    b.conf = Math.max(b.conf, r.confidence);
    if (r.status !== "normal") b.anomalies += 1;
    buckets.set(r.subsystem, b);
  }
  return Array.from(buckets.entries())
    .map(([subsystem, b]) => ({
      subsystem,
      ids: Array.from(b.ids).sort((a, c) => a - c),
      totalCount: b.count,
      avgHz: b.hzN ? b.hzSum / b.hzN : 0,
      anomalousCount: b.anomalies,
      confidence: b.conf,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);
};

export const formatCanId = (id: number, format: "hex" | "decimal" = "hex") =>
  format === "hex" ? `0x${id.toString(16).toUpperCase().padStart(3, "0")}` : id.toString(10);
