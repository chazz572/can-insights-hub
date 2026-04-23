import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type JsonRecord = Record<string, unknown>;
type CsvIndexes = { timestampIndex: number; idIndex: number; dataIndex: number; metadataIndex: number };
type ParsedRecord = { id: string; data: string; timestamp: number; metadata: string };
type IdProfile = {
  count: number;
  lengths: Map<number, number>;
  timestamps: number[];
  byteCounts: Array<Map<number, number>>;
  previousData: string | null;
  changes: number;
  cleanSamples: string[];
};

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const resolveIndexes = (headerLine: string): CsvIndexes => {
  const headers = parseCsvLine(headerLine);
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const find = (names: string[]) => normalizedHeaders.findIndex((header) => names.includes(header));

  const timestampIndex = find(["timestamp", "time", "ts", "date time", "datetime"]);
  const idIndex = find(["id", "can_id", "arbitration_id", "identifier", "message_id", "canid", "pgn"]);
  const dataIndex = find(["data", "payload", "bytes", "data bytes"]);
  const metadataIndex = find(["metadata", "dbc_metadata", "description", "signals", "signal_names"]);

  if (idIndex < 0 || dataIndex < 0) {
    throw new Error("Normalized CSV is missing required id/data columns.");
  }

  return { timestampIndex, idIndex, dataIndex, metadataIndex };
};

const forEachCsvRecord = (csv: string, callback: (record: ParsedRecord) => void) => {
  let lineStart = 0;
  let indexes: CsvIndexes | null = null;

  for (let index = 0; index <= csv.length; index += 1) {
    const char = csv[index];
    if (index !== csv.length && char !== "\n") continue;

    let line = csv.slice(lineStart, index);
    lineStart = index + 1;

    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (!line.trim()) continue;

    if (!indexes) {
      indexes = resolveIndexes(line.replace(/^\uFEFF/, ""));
      continue;
    }

    const values = parseCsvLine(line);
    callback({
      id: values[indexes.idIndex] ?? "",
      data: values[indexes.dataIndex] ?? "",
      timestamp: Number(values[indexes.timestampIndex] ?? Number.NaN),
      metadata: indexes.metadataIndex >= 0 ? values[indexes.metadataIndex] ?? "" : "",
    });
  }
};

const cleanHex = (value: string) => value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
const byteValues = (value: string) => cleanHex(value).match(/.{1,2}/g)?.slice(0, 8).map((byte) => Number.parseInt(byte, 16)).filter((byte) => Number.isFinite(byte)) ?? [];
const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const standardDeviation = (values: number[]) => {
  const mean = average(values);
  return values.length ? Math.sqrt(average(values.map((value) => (value - mean) ** 2))) : 0;
};
const entropy = (values: number[]) => {
  if (!values.length) return 0;
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Number([...counts.values()].reduce((sum, count) => {
    const probability = count / values.length;
    return sum - probability * Math.log2(probability);
  }, 0).toFixed(4));
};

const analogCandidateScore = (values: number[]) => {
  if (values.length < 20) return 0;
  const unique = new Set(values).size;
  const range = Math.max(...values) - Math.min(...values);
  const transitions = values.slice(1).filter((value, index) => value !== values[index]).length;
  const transitionRate = transitions / Math.max(values.length - 1, 1);
  const smoothSteps = values.slice(1).filter((value, index) => Math.abs(value - values[index]) > 0 && Math.abs(value - values[index]) < Math.max(80, range * 0.18)).length;
  return unique >= 12 && range >= 250 ? transitionRate * 0.45 + (smoothSteps / Math.max(values.length - 1, 1)) * 0.35 + Math.min(0.2, unique / values.length) : 0;
};

const trendStats = (values: number[]) => {
  if (values.length < 3) return { range: 0, unique: new Set(values).size, rising: 0, falling: 0, flat: 0, reversals: 0, meanAbsDelta: 0, smoothness: 0, direction: "flat" };
  const deltas = values.slice(1).map((value, index) => value - values[index]);
  const nonZero = deltas.filter((delta) => delta !== 0);
  const signs = nonZero.map((delta) => Math.sign(delta));
  const reversals = signs.slice(1).filter((sign, index) => sign !== signs[index]).length;
  const range = Math.max(...values) - Math.min(...values);
  const meanAbsDelta = average(deltas.map(Math.abs));
  const rising = deltas.filter((delta) => delta > 0).length / deltas.length;
  const falling = deltas.filter((delta) => delta < 0).length / deltas.length;
  const flat = deltas.filter((delta) => delta === 0).length / deltas.length;
  const smoothSteps = deltas.filter((delta) => Math.abs(delta) > 0 && Math.abs(delta) <= Math.max(4, range * 0.22)).length / deltas.length;
  const direction = rising > 0.55 ? "rising" : falling > 0.55 ? "falling" : reversals >= 2 ? "oscillating" : flat > 0.75 ? "flat" : "mixed";
  return { range, unique: new Set(values).size, rising, falling, flat, reversals, meanAbsDelta, smoothness: smoothSteps, direction };
};

const pearson = (left: number[], right: number[]) => {
  const length = Math.min(left.length, right.length);
  if (length < 6) return 0;
  const a = left.slice(0, length);
  const b = right.slice(0, length);
  const meanA = average(a);
  const meanB = average(b);
  const numerator = a.reduce((sum, value, index) => sum + (value - meanA) * (b[index] - meanB), 0);
  const denominator = Math.sqrt(a.reduce((sum, value) => sum + (value - meanA) ** 2, 0) * b.reduce((sum, value) => sum + (value - meanB) ** 2, 0));
  return denominator ? Number((numerator / denominator).toFixed(4)) : 0;
};

const classifySignal = (signal: JsonRecord, metadata = "") => {
  const byteStart = Number(signal.byte_start ?? 0);
  const maxValue = Number(signal.max_value ?? 0);
  const range = Number(signal.range ?? 0);
  const direction = String(signal.direction ?? "mixed");
  const text = metadata.toLowerCase();
  if (/engine[^a-z0-9]*rpm|crankshaft|camshaft/.test(text)) return "engine_rpm_candidate";
  if (/motor[^a-z0-9]*rpm|inverter[^a-z0-9]*rpm|drive[^a-z0-9]*rpm/.test(text)) return "motor_rpm_candidate";
  if (/(wheel[^a-z0-9]*speed|vehicle[^a-z0-9]*speed|road[^a-z0-9]*speed)/.test(text)) return "speed_or_wheel_speed_candidate";
  if (/(accelerator|pedal|brake[^a-z0-9]*(pressure|position)|steering[^a-z0-9]*(angle|torque))/.test(text)) return "pedal_brake_or_steering_candidate";
  if (range <= 16 && Number(signal.unique_values ?? 0) <= 16) return "gear_flag_or_counter_candidate";
  if (!text && range > 8 && maxValue <= 255 && ["rising", "falling"].includes(direction)) return "compact_changing_byte_candidate";
  return "analog_sensor_candidate";
};

const describeSignalEvidence = (signal: JsonRecord) => `ID ${signal.id} bytes ${signal.byte_start}-${Number(signal.byte_start ?? 0) + 1} ${signal.endianness} ranged ${signal.min_value}-${signal.max_value}, changed ${signal.unique_values} unique values, trended ${signal.direction}, and had ${Number(signal.smoothness ?? 0).toFixed(2)} smooth-step behavior.`;

const metadataTokens = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const containsAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));
const summarizeMetadata = (metadataById: Map<string, string>, idCounts: Map<string, number>) => {
  const rows = [...metadataById.entries()].map(([id, metadata]) => ({ id, metadata, text: metadata.toLowerCase(), tokens: metadataTokens(metadata) }));
  const scoreRows = (terms: string[]) => rows.filter((row) => containsAny(row.text, terms));
  const evTerms = ["battery", "bms", "inverter", "drive", "regen", "charge", "charger", "hv", "dc", "thermal", "motor", "torque", "tesla", "model3", "autopilot", "brake", "steering", "pedal"];
  const oemTerms = ["tesla", "model3", "autopilot", "partybus", "vehiclebus", "chassisbus", "ui_", "di_", "bms_", "ibst_", "epas_", "esp_"];
  const domainTerms = {
    battery_energy: ["battery", "bms", "hv", "charge", "charger", "soc", "cell", "pack", "voltage", "current"],
    traction_inverter_motor: ["inverter", "motor", "drive", "di_", "torque", "regen", "powertrain"],
    chassis_brake_steering: ["brake", "steering", "epas", "esp", "wheel", "speed", "abs"],
    body_ui_autopilot: ["autopilot", "camera", "ui_", "display", "gps", "cell", "wifi", "radar", "adas"],
    thermal: ["thermal", "temperature", "coolant", "pump", "fan", "heat", "ac"]
  };
  const matchedEvRows = scoreRows(evTerms);
  const matchedOemRows = scoreRows(oemTerms);
  const domains = Object.entries(domainTerms).map(([domain, terms]) => {
    const matches = scoreRows(terms);
    return { domain, ids: matches.map((row) => row.id).slice(0, 12), evidence_terms: [...new Set(matches.flatMap((row) => row.tokens.filter((token) => terms.some((term) => token.includes(term.replace(/_$/, ""))))))].slice(0, 16), count: matches.length };
  }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
  const likelyOem = containsAny(rows.map((row) => row.text).join(" "), ["tesla", "model3", "autopilot", "partybus", "vehiclebus", "chassisbus"]) ? "Tesla Model 3 / Tesla-style DBC" : "unknown from metadata";
  const evConfidence = Math.min(0.99, 0.35 + matchedEvRows.length * 0.035 + domains.length * 0.06 + (likelyOem.includes("Tesla") ? 0.28 : 0));
  return {
    has_dbc_metadata: rows.length > 0,
    likely_oem_or_platform: likelyOem,
    ev_confidence_score: Number(evConfidence.toFixed(3)),
    ev_evidence_ids: matchedEvRows.map((row) => row.id).slice(0, 20),
    oem_evidence_ids: matchedOemRows.map((row) => row.id).slice(0, 20),
    domains,
    metadata_id_coverage: idCounts.size ? Number((rows.length / idCounts.size).toFixed(3)) : 0,
    explanation: rows.length ? `Metadata names include ${domains.map((item) => item.domain.replace(/_/g, " ")).join(", ") || "system labels"}; ${likelyOem !== "unknown from metadata" ? `${likelyOem} naming is present` : "no explicit OEM naming was found"}.` : "No DBC/message metadata was available in the normalized file.",
  };
};

const runAnalysis = (csv: string) => {
  let totalMessages = 0;
  let extendedIds = 0;
  let meanLength = 0;
  let m2Length = 0;

  const idCounts = new Map<string, number>();
  const speedIds = new Set<string>();
  const rpmIds = new Set<string>();
  const pedalIds = new Set<string>();
  const byteCounts = Array.from({ length: 8 }, () => new Map<number, number>());
  const byteObservedCounts = Array.from({ length: 8 }, () => 0);
  const bitOnes = Array.from({ length: 64 }, () => 0);
  const bitObserved = Array.from({ length: 64 }, () => 0);
  const bitTransitions = Array.from({ length: 64 }, () => 0);
  const bitPrevious = Array.from<number | null>({ length: 64 }, () => null);
  const timingById = new Map<string, number[]>();
  const idProfiles = new Map<string, IdProfile>();
  const metadataById = new Map<string, string>();

  forEachCsvRecord(csv, ({ id, data, timestamp, metadata }) => {
    totalMessages += 1;
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    const profile = idProfiles.get(id) ?? { count: 0, lengths: new Map<number, number>(), timestamps: [], byteCounts: Array.from({ length: 8 }, () => new Map<number, number>()), previousData: null, changes: 0, cleanSamples: [] };
    profile.count += 1;
    profile.lengths.set(data.length, (profile.lengths.get(data.length) ?? 0) + 1);
    if (Number.isFinite(timestamp)) profile.timestamps.push(timestamp);
    if (profile.previousData !== null && profile.previousData !== cleanHex(data)) profile.changes += 1;
    profile.previousData = cleanHex(data);
    if (profile.cleanSamples.length < 800) profile.cleanSamples.push(cleanHex(data));
    idProfiles.set(id, profile);
    if (metadata) metadataById.set(id, `${metadataById.get(id) ?? ""} ${metadata}`.trim().slice(0, 6000));

    if (cleanHex(id).length > 3) extendedIds += 1;

    const payloadLength = byteValues(data).length;
    const delta = payloadLength - meanLength;
    meanLength += delta / totalMessages;
    m2Length += delta * (payloadLength - meanLength);

    const bytes = byteValues(data);

    bytes.forEach((byte, byteIndex) => {
      profile.byteCounts[byteIndex].set(byte, (profile.byteCounts[byteIndex].get(byte) ?? 0) + 1);
    });

    for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
      const byte = bytes[byteIndex];
      byteObservedCounts[byteIndex] += 1;
      byteCounts[byteIndex].set(byte, (byteCounts[byteIndex].get(byte) ?? 0) + 1);

      for (let offset = 0; offset < 8; offset += 1) {
        const bit = byteIndex * 8 + offset;
        const bitIndex = 7 - offset;
        const value = (byte >> bitIndex) & 1;
        bitObserved[bit] += 1;
        bitOnes[bit] += value;
        if (bitPrevious[bit] !== null && bitPrevious[bit] !== value) {
          bitTransitions[bit] += 1;
        }
        bitPrevious[bit] = value;
      }
    }

    if (Number.isFinite(timestamp)) {
      const timestamps = timingById.get(id);
      if (timestamps) timestamps.push(timestamp);
      else timingById.set(id, [timestamp]);
    }
  });

  if (!totalMessages) {
    throw new Error("No CAN messages were found in the normalized CSV.");
  }

  const variance = m2Length / totalMessages;
  const anomalyThreshold = meanLength + 3 * Math.sqrt(variance);
  const anomalies: JsonRecord[] = [];

  forEachCsvRecord(csv, ({ id, data }) => {
    if (byteValues(data).length > anomalyThreshold) {
      anomalies.push({ id, data, reason: "Unusually long data payload" });
    }
  });

  const metadataInsights = summarizeMetadata(metadataById, idCounts);
  const isDbcReference = metadataInsights.has_dbc_metadata && totalMessages === idCounts.size;
  const idStats = [...idCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count, percentage: totalMessages ? Number(((count / totalMessages) * 100).toFixed(2)) : 0 }));

  const reverseEngineering = idStats.map((item, index) => ({
    id: item.id,
    count: item.count,
    cluster: index % 3,
    candidate_signal: Number(item.count ?? 0) > 1,
  }));

  const byteAnalysis = byteCounts.map((counts, byteIndex) => {
    const values = [...counts.entries()].flatMap(([value, count]) => Array.from({ length: count }, () => value));
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    return {
      byte_index: byteIndex,
      observed_count: byteObservedCounts[byteIndex],
      unique_values: counts.size,
      entropy: entropy(values),
      dominant_value: dominant === undefined ? null : dominant,
    };
  });

  const bitAnalysis = Array.from({ length: 64 }, (_, bit) => ({
    bit,
    byte_index: Math.floor(bit / 8),
    bit_index: 7 - (bit % 8),
    ones: bitOnes[bit],
    zeros: bitObserved[bit] - bitOnes[bit],
    transitions: bitTransitions[bit],
    activity: bitObserved[bit] ? Number((bitTransitions[bit] / bitObserved[bit]).toFixed(4)) : 0,
  }));

  const timing = [...timingById.entries()].map(([id, timestamps]) => {
    const sorted = [...timestamps].sort((a, b) => a - b);
    const periods = sorted.slice(1).map((timestamp, index) => timestamp - sorted[index]);
    const average = periods.reduce((sum, value) => sum + value, 0) / (periods.length || 1);
    const jitter = periods.reduce((sum, value) => sum + Math.abs(value - average), 0) / (periods.length || 1);

    return {
      id,
      samples: sorted.length,
      average_period: Number(average.toFixed(6)),
      period_jitter: Number(jitter.toFixed(6)),
      min_period: periods.length ? Math.min(...periods) : 0,
      max_period: periods.length ? Math.max(...periods) : 0,
    };
  });

  const systems = [...idCounts.keys()].map((id) => {
    const numeric = Number.parseInt(cleanHex(id), 16);
    const category = Number.isFinite(numeric) && numeric >= 0x18F00000
      ? "powertrain_or_diagnostic"
      : Number.isFinite(numeric) && numeric >= 0x700
        ? "diagnostic"
        : "body_or_chassis";

    const module_type = category === "diagnostic"
      ? "diagnostic"
      : Number.isFinite(numeric) && numeric >= 0x500
        ? "infotainment_or_cluster"
        : Number.isFinite(numeric) && numeric >= 0x300
          ? "body_control_or_security"
          : Number.isFinite(numeric) && numeric >= 0x180
            ? "chassis_or_powertrain"
            : "body_control";

    const metadata = (metadataById.get(id) ?? "").toLowerCase();
    const metadataModule = containsAny(metadata, ["bms", "battery", "charge", "charger", "hv", "inverter", "motor", "drive", "torque"])
      ? "ev_powertrain_or_battery"
      : containsAny(metadata, ["autopilot", "camera", "radar", "gps", "ui_", "display"])
        ? "adas_or_infotainment"
        : containsAny(metadata, ["brake", "steering", "wheel", "epas", "esp"])
          ? "chassis_brake_steering"
          : module_type;
    return { id, category: metadataModule.includes("ev_") ? "ev_powertrain_energy" : category, module_type: metadataModule, confidence_score: metadata ? 0.9 : category === "diagnostic" ? 0.82 : 0.58, confidence: metadata ? "dbc_metadata_supported" : "heuristic", reasoning: metadata ? `DBC/message names for ${cleanHex(id)} indicate ${metadataModule}.` : `ID range ${cleanHex(id)} maps heuristically to ${module_type}.` };
  });

  const idDeepDive = [...idProfiles.entries()].map(([id, profile]) => {
    const periods = [...profile.timestamps].sort((a, b) => a - b).slice(1).map((timestamp, index, sorted) => timestamp - sorted[index]);
    const byteEntropy = profile.byteCounts.map((counts, byteIndex) => ({
      byte_index: byteIndex,
      unique_values: counts.size,
      entropy: entropy([...counts.entries()].flatMap(([value, count]) => Array.from({ length: count }, () => value))),
      dominant_value: [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }));
    const volatileBytes = byteEntropy.filter((item) => item.entropy > 0.7).map((item) => item.byte_index);

    return {
      id,
      messages: profile.count,
      message_share_percent: Number(((profile.count / totalMessages) * 100).toFixed(2)),
      payload_lengths: Object.fromEntries(profile.lengths.entries()),
      average_period: Number(average(periods).toFixed(6)),
      period_jitter: Number(standardDeviation(periods).toFixed(6)),
      payload_change_rate: Number((profile.changes / Math.max(profile.count - 1, 1)).toFixed(4)),
      volatile_bytes: volatileBytes,
      byte_entropy: byteEntropy,
      likely_role: volatileBytes.length >= 2 ? "multi-byte changing signal candidate" : profile.changes === 0 ? "static/status candidate" : "single-byte/status signal candidate",
    };
  }).sort((a, b) => Number(b.messages) - Number(a.messages));

  const analogSignals = [...idProfiles.entries()].flatMap(([id, profile]) => {
    const samples = profile.cleanSamples.map(byteValues).filter((bytes) => bytes.length >= 2);
    if (samples.length < 20) return [];
    return Array.from({ length: 7 }, (_, byte_start) => {
      const bigEndian = samples.filter((bytes) => bytes.length > byte_start + 1).map((bytes) => bytes[byte_start] * 256 + bytes[byte_start + 1]);
      const littleEndian = samples.filter((bytes) => bytes.length > byte_start + 1).map((bytes) => bytes[byte_start] + bytes[byte_start + 1] * 256);
      const beScore = analogCandidateScore(bigEndian);
      const leScore = analogCandidateScore(littleEndian);
      const score = Math.max(beScore, leScore);
      const values = beScore >= leScore ? bigEndian : littleEndian;
      const trend = trendStats(values);
      return score > 0.48 ? {
        id,
        byte_start,
        bit_start: byte_start * 8,
        bit_length: 16,
        endianness: beScore >= leScore ? "big_endian_candidate" : "little_endian_candidate",
        min_value: Math.min(...values),
        max_value: Math.max(...values),
        range: trend.range,
        unique_values: new Set(values).size,
        direction: trend.direction,
        rising_ratio: Number(trend.rising.toFixed(3)),
        falling_ratio: Number(trend.falling.toFixed(3)),
        reversals: trend.reversals,
        mean_abs_delta: Number(trend.meanAbsDelta.toFixed(3)),
        smoothness: Number(trend.smoothness.toFixed(3)),
        confidence_score: Number(Math.min(0.96, score).toFixed(3)),
        likely_signal_type: byte_start <= 2 && Math.max(...values) > 900 && Math.max(...values) < 9000 ? "rpm_candidate" : "analog_signal_candidate",
        reasoning: "Smooth changing 16-bit byte pair with enough range, transitions, and directional structure to resemble a live vehicle signal.",
      } : null;
    }).filter(Boolean);
  }) as JsonRecord[];

  analogSignals.forEach((signal) => {
    signal.likely_signal_type = classifySignal(signal, String(metadataById.get(String(signal.id)) ?? ""));
    signal.evidence = describeSignalEvidence(signal);
  });

  analogSignals.filter((signal) => String(signal.likely_signal_type).includes("speed") || String(signal.likely_signal_type).includes("wheel")).forEach((signal) => speedIds.add(String(signal.id)));
  analogSignals.filter((signal) => /rpm_candidate/.test(String(signal.likely_signal_type))).forEach((signal) => rpmIds.add(String(signal.id)));
  analogSignals.filter((signal) => /pedal|brake|steering/i.test(String(signal.likely_signal_type))).forEach((signal) => pedalIds.add(String(signal.id)));

  const networkHealth = {
    estimated_bus_load_score: Math.min(100, Math.round((totalMessages / Math.max(idCounts.size, 1)) * 10)),
    dominant_ids: idStats.filter((item) => item.percentage > 10).slice(0, 8),
    noisy_ids: idDeepDive.filter((item) => Number(item.message_share_percent) > 25 || Number(item.period_jitter) > 0.05).slice(0, 8),
    quiet_ids: idDeepDive.filter((item) => Number(item.messages) <= 2).slice(0, 12),
    missing_or_sparse_message_risk: idDeepDive.filter((item) => Number(item.messages) <= 2).length,
    timing_irregularity_score: Number(average(idDeepDive.map((item) => Number(item.period_jitter))).toFixed(6)),
  };

  const protocolInsights = {
    likely_protocol: extendedIds > totalMessages / 2 ? "CAN 2.0B / extended identifiers" : "CAN 2.0A / standard identifiers",
    extended_id_ratio: totalMessages ? Number((extendedIds / totalMessages).toFixed(4)) : 0,
    has_j1939_shape: totalMessages ? extendedIds / totalMessages > 0.55 && [...idCounts.keys()].some((id) => cleanHex(id).length >= 8) : false,
    has_uds_or_isotp_shape: [...idCounts.keys()].some((id) => /^7[0-9A-F]{2}$/i.test(cleanHex(id)) || /^18DA/i.test(cleanHex(id))),
    diagnostic_id_candidates: [...idCounts.keys()].filter((id) => /^7[0-9A-F]{2}$/i.test(cleanHex(id)) || /^18DA/i.test(cleanHex(id))).slice(0, 16),
  };

  const speedSignals = analogSignals.filter((signal) => /speed|wheel/i.test(String(signal.likely_signal_type))).slice(0, 8);
  const rpmSignals = analogSignals.filter((signal) => String(signal.likely_signal_type) === "rpm_candidate").slice(0, 8);
  const pedalBrakeSteeringSignals = analogSignals.filter((signal) => /pedal|brake|steering/i.test(String(signal.likely_signal_type))).slice(0, 8);
  const loadSignals = analogSignals.filter((signal) => /analog_sensor/i.test(String(signal.likely_signal_type)) && Number(signal.range ?? 0) > 500).slice(0, 8);
  const metadataEvConfidence = Number(metadataInsights.ev_confidence_score ?? 0);
  const risingMotion = speedSignals.some((signal) => signal.direction === "rising") || pedalBrakeSteeringSignals.some((signal) => signal.direction === "rising");
  const fallingMotion = speedSignals.some((signal) => signal.direction === "falling") || pedalBrakeSteeringSignals.some((signal) => signal.direction === "falling");
  const oscillatingMotion = speedSignals.some((signal) => signal.direction === "oscillating") || pedalBrakeSteeringSignals.some((signal) => signal.direction === "oscillating");
  const engineActive = rpmSignals.length > 0 || loadSignals.length > 0;
  const hasDefensibleMotion = speedSignals.length > 0 || pedalBrakeSteeringSignals.length > 0;
  const behaviorLabel = !hasDefensibleMotion
    ? "awake periodic CAN traffic with no defensible vehicle-motion conclusion"
    : risingMotion && !fallingMotion
    ? "accelerating or increasing load"
    : fallingMotion && !risingMotion
      ? "decelerating, braking, or load dropping"
      : risingMotion && fallingMotion
        ? "transient driving with acceleration and deceleration phases"
        : oscillatingMotion
          ? "turning, pedal modulation, or low-speed maneuvering"
            : "awake periodic CAN traffic with no defensible vehicle-motion conclusion";
  const behaviorConfidence = isDbcReference ? 0 : !hasDefensibleMotion ? 0.22 : Math.min(0.86, 0.42 + speedSignals.length * 0.12 + pedalBrakeSteeringSignals.length * 0.08);
  const behavioralEvidence = [...speedSignals, ...rpmSignals, ...pedalBrakeSteeringSignals, ...loadSignals].slice(0, 12).map(describeSignalEvidence);
  const subtleAbnormalities = [
    ...timing.filter((item) => Number(item.period_jitter) > Math.max(Number(item.average_period) * 0.2, 0.003)).map((item) => ({ id: item.id, type: "timing_jitter_or_drift", severity: Number(item.period_jitter) > Math.max(Number(item.average_period) * 0.75, 0.02) ? "moderate" : "minor", evidence: `Average period ${item.average_period}s with jitter ${item.period_jitter}s; max gap ${item.max_period}s.` })),
    ...idDeepDive.filter((item) => Number(item.payload_change_rate) === 0 && Number(item.messages) > 8).map((item) => ({ id: item.id, type: "stuck_payload_or_static_status", severity: "minor", evidence: `Payload did not change across ${item.messages} messages; likely static status, but worth noting if it should be live.` })),
    ...idDeepDive.filter((item) => Number(item.messages) <= 2).map((item) => ({ id: item.id, type: "unusual_id_silence_or_sparse_frame", severity: "minor", evidence: `Only ${item.messages} frame(s) observed; this can indicate one-shot status, wake/sleep traffic, or missing expected repetition.` })),
  ].slice(0, 32);
  const metadataText = [...metadataById.values()].join(" ").toLowerCase();
  const explicitEvTerms = ["pack voltage", "hv voltage", "high voltage", "battery current", "pack current", "cell voltage", "cell temp", "inverter torque", "motor rpm", "drive inverter"];
  const explicitIceTerms = ["engine rpm", "fuel trim", "o2 sensor", "oxygen sensor", "intake manifold", "map sensor", "crankshaft", "camshaft"];
  const explicitHybridTerms = ["hybrid ecu", "hybrid control", "motor torque", "engine torque"];
  const hasExplicitEvMetadata = containsAny(metadataText, explicitEvTerms);
  const hasExplicitIceMetadata = containsAny(metadataText, explicitIceTerms);
  const hasExplicitHybridMetadata = containsAny(metadataText, explicitHybridTerms);
  const hasHvAnalogEvidence = analogSignals.some((signal) => Number(signal.max_value ?? 0) >= 200 && Number(signal.max_value ?? 0) <= 900 && Number(signal.range ?? 0) >= 20 && /voltage|hv|pack|battery/i.test(String(metadataById.get(String(signal.id)) ?? "")));
  const hasEngineRpmEvidence = rpmSignals.some((signal) => /engine|rpm|crank/i.test(String(metadataById.get(String(signal.id)) ?? "")));
  const hasMotorRpmEvidence = rpmSignals.some((signal) => /motor|inverter|drive/i.test(String(metadataById.get(String(signal.id)) ?? "")));
  const evEvidence = [hasExplicitEvMetadata || hasHvAnalogEvidence ? `explicit EV/HV signal naming or voltage-range evidence on IDs ${[...metadataById.entries()].filter(([, value]) => containsAny(value.toLowerCase(), explicitEvTerms)).map(([id]) => id).slice(0, 8).join(", ") || analogSignals.filter((signal) => Number(signal.max_value ?? 0) >= 200 && Number(signal.max_value ?? 0) <= 900).map((signal) => String(signal.id)).slice(0, 8).join(", ")}` : null, hasMotorRpmEvidence ? `motor/inverter RPM evidence on IDs ${rpmSignals.filter((signal) => /motor|inverter|drive/i.test(String(metadataById.get(String(signal.id)) ?? ""))).map((signal) => String(signal.id)).join(", ")}` : null].filter(Boolean);
  const iceEvidence = [hasExplicitIceMetadata || hasEngineRpmEvidence ? `explicit ICE signal naming on IDs ${[...metadataById.entries()].filter(([, value]) => containsAny(value.toLowerCase(), explicitIceTerms)).map(([id]) => id).slice(0, 8).join(", ") || rpmSignals.filter((signal) => /engine|rpm|crank/i.test(String(metadataById.get(String(signal.id)) ?? ""))).map((signal) => String(signal.id)).join(", ")}` : null].filter(Boolean);
  const hybridEvidence = [hasExplicitHybridMetadata ? `explicit hybrid signal naming on IDs ${[...metadataById.entries()].filter(([, value]) => containsAny(value.toLowerCase(), explicitHybridTerms)).map(([id]) => id).slice(0, 8).join(", ")}` : null, evEvidence.length && iceEvidence.length ? "both HV/motor evidence and engine/ICE evidence are present in live traffic" : null].filter(Boolean);
  const vehicleType = isDbcReference
    ? { classification: "Vehicle type cannot be determined from this log.", confidence_score: 0, evidence: [], reasoning: "This upload is a DBC signal definition file, not a vehicle log. Message and signal names can describe network structure, but they do not prove the vehicle type or operating state." }
    : hybridEvidence.length
      ? { classification: "hybrid", confidence_score: 0.86, evidence: hybridEvidence, reasoning: "Hybrid classification requires both engine-side and high-voltage/motor-side evidence, or explicit hybrid ECU naming in live decoded traffic." }
      : evEvidence.length
        ? { classification: "EV", confidence_score: 0.82, evidence: evEvidence, reasoning: "EV classification is based only on explicit high-voltage, pack/cell, inverter, motor, or drive-unit evidence; missing RPM or fuel signals are ignored." }
        : iceEvidence.length
          ? { classification: "ICE", confidence_score: 0.82, evidence: iceEvidence, reasoning: "ICE classification is based only on explicit engine RPM, fuel trim, oxygen sensor, intake manifold, crankshaft, or camshaft evidence; generic ID patterns are ignored." }
          : { classification: "Vehicle type cannot be determined from this log.", confidence_score: 0, evidence: [], reasoning: "The log lacks explicit EV indicators such as HV pack voltage/current, cell data, inverter torque, or motor RPM, and lacks explicit ICE indicators such as engine RPM, fuel trims, O2 sensors, intake manifold pressure, crankshaft, or camshaft signals." };

  const driverBehavior = {
    behavior: isDbcReference ? "DBC definition map / not live driving traffic" : behaviorLabel,
    confidence_score: Number(behaviorConfidence.toFixed(3)),
    movement_confidence: speedSignals.length ? "supported_by_signal_shape" : "not_supported_by_motion_bytes",
    engine_activity_confidence: rpmSignals.length || loadSignals.length ? "supported_by_dynamic_powertrain_like_bytes" : "not_isolated",
    pedal_activity_confidence: pedalBrakeSteeringSignals.length ? "supported_by_compact_input_like_bytes" : "not_isolated",
    harsh_event_candidates: anomalies.slice(0, 12),
    evidence: behavioralEvidence.length ? behavioralEvidence : ["No byte pair showed the rising/falling motion shape required to defend speed, pedal, brake, steering, or wheel-speed claims."],
    interpretation: isDbcReference ? "This upload is a DBC definition file, so the defensible conclusion is limited to message definitions, signal names, and likely ECU groups. It must not be treated as live traffic or used by itself to classify vehicle type." : `${behaviorLabel}. This conclusion is based on byte-level trend direction, smoothness, entropy, timing cadence, and cross-ID relationships rather than message counts alone.`,
  };

  const eventTimeline = anomalies.slice(0, 24).map((item, index) => ({
    event_index: index + 1,
    id: item.id,
    event_type: "payload_anomaly",
    description: item.reason,
    before_after_hint: "Compare this ID against nearby frames for timing or payload changes.",
  }));

  const vehicleBehavior = {
    possible_speed_ids: [...speedIds],
    possible_rpm_ids: [...rpmIds],
    possible_pedal_ids: [...pedalIds],
  };

  const idClassifications = idDeepDive.map((item) => {
    const volatileByteCount = Array.isArray(item.volatile_bytes) ? item.volatile_bytes.length : 0;
    const changeRate = Number(item.payload_change_rate);
    const classification = changeRate > 0.75 || volatileByteCount >= 4 ? "volatile" : changeRate > 0.35 || volatileByteCount >= 2 ? "dynamic" : changeRate > 0.05 || volatileByteCount >= 1 ? "semi-static" : "static";
    return { id: item.id, classification, volatility_score: Number(Math.min(1, changeRate + volatileByteCount / 8).toFixed(4)), reasoning: `${item.id} changed in ${Math.round(changeRate * 100)}% of observed transitions with ${volatileByteCount} volatile byte position(s).` };
  });

  const ecuClusters = idDeepDive.map((item) => {
    const timingMatches = timing.filter((row) => row.id !== item.id && Math.abs(Number(row.average_period) - Number(item.average_period)) < 0.002).map((row) => row.id).slice(0, 6);
    const structureMatches = idDeepDive.filter((row) => row.id !== item.id && JSON.stringify(row.payload_lengths) === JSON.stringify(item.payload_lengths)).map((row) => row.id).slice(0, 6);
    const ids = [...new Set([String(item.id), ...timingMatches, ...structureMatches])];
    return { cluster_id: `cluster_${item.id}`, ids, confidence: Number(Math.min(0.95, 0.35 + timingMatches.length * 0.08 + structureMatches.length * 0.06).toFixed(3)), behavior: "IDs share timing cadence and/or payload structure, suggesting related ECU housekeeping/status traffic." };
  }).filter((cluster) => cluster.ids.length > 1).slice(0, 16);

  const counterChecksumAnalysis = idDeepDive.map((item) => {
    const byteEntropy = Array.isArray(item.byte_entropy) ? item.byte_entropy as JsonRecord[] : [];
    const counters = byteEntropy.filter((row) => Number(row.unique_values ?? 0) > 1 && Number(row.unique_values ?? 0) <= 16 && Number(row.entropy ?? 0) > 0.3).map((row) => ({ byte_index: row.byte_index, direction: "rolling_or_modulo", modulo: row.unique_values, confidence: 0.58 }));
    const checksums = byteEntropy.filter((row) => Number(row.unique_values ?? 0) > 16 && Number(row.entropy ?? 0) > 1.2).map((row) => ({ byte_index: row.byte_index, confidence: 0.52 }));
    return { id: item.id, counters, checksums, byte_behavior: byteEntropy };
  }).filter((item) => item.counters.length || item.checksums.length);

  const missingPhysicalSignals = [
    speedIds.size ? null : { signal: "speed", reasoning: "No repeated motion-shaped payload pattern was found." },
    rpmIds.size ? null : { signal: "rpm", reasoning: "No clear engine-speed-style changing payload was found." },
    pedalIds.size ? null : { signal: "pedal", reasoning: "No compact pedal-position-style changing signal was found." },
    { signal: "brake", reasoning: "No validated brake toggle or pressure pattern was isolated." },
    { signal: "steering", reasoning: "No steering-angle-style bidirectional changing pattern was isolated." },
    { signal: "wheel_speed", reasoning: "No grouped wheel-speed-like correlated byte patterns were isolated." },
    { signal: "torque", reasoning: "No torque-like dynamic powertrain signal was isolated." },
    { signal: "gear", reasoning: "No gear-state enum pattern was isolated." },
  ].filter(Boolean);

  const vehicleState = {
    classification: behaviorLabel.replace(/ /g, "_"),
    confidence_score: Number(behaviorConfidence.toFixed(3)),
    reasoning: behavioralEvidence.length ? behavioralEvidence.join(" ") : "The log contains periodic CAN housekeeping traffic, but it lacks correlated, directional byte movement needed to defend motion or driver-input claims.",
    evidence: behavioralEvidence,
  };

  const correlationPairs = idDeepDive.flatMap((left, leftIndex) => idDeepDive.slice(leftIndex + 1).map((right) => ({ left: left.id, right: right.id, correlation: Number((1 - Math.min(1, Math.abs(Number(left.average_period) - Number(right.average_period)))).toFixed(4)), relationship: "timing_cadence_similarity" }))).filter((item) => item.correlation >= 0.72).slice(0, 24);
  const enhancedNetworkHealth = { ...networkHealth, bus_health_score: Math.max(0, Math.min(100, 100 - anomalies.length * 4 - Math.round(Number(networkHealth.timing_irregularity_score) * 120))), chatter_classification: idStats.some((item) => item.percentage > 35) ? "dominant_id_chatter" : totalMessages / Math.max(idCounts.size, 1) > 60 ? "busy_periodic_chatter" : "normal_idle_chatter", dropout_events: timing.filter((item) => Number(item.max_period) > Math.max(Number(item.average_period) * 3, 0.1)).map((item) => ({ id: item.id, max_period: item.max_period, average_period: item.average_period, classification: "possible_gap_or_dropout" })).slice(0, 16) };
  const derivedEvents = enhancedNetworkHealth.dropout_events.map((item, index) => ({ event_index: eventTimeline.length + index + 1, id: item.id, timestamp: null, event_type: "possible_module_dropout", description: `Timing gap detected: max period ${item.max_period}s vs average ${item.average_period}s.`, before_after_hint: "Compare nearby frames to confirm wake/sleep or missing traffic." }));
  const whatDataShows = [
    isDbcReference ? "This is a DBC definition map, not live CAN traffic. It defines message IDs, signal names, transmitters, and likely ECU groups, but it does not prove vehicle type or motion." : `The strongest defensible vehicle-state conclusion is ${behaviorLabel} at ${Math.round(behaviorConfidence * 100)}% confidence.`,
    `Vehicle type: ${vehicleType.classification} ${vehicleType.confidence_score ? `(${Math.round(vehicleType.confidence_score * 100)}% confidence)` : ""}. ${vehicleType.reasoning}`,
    metadataInsights.has_dbc_metadata ? `DBC/OEM evidence: ${metadataInsights.explanation} This metadata is used for structure and decoding support only, not vehicle-type classification by itself.` : "No DBC metadata was available; vehicle type remains unclassified unless explicit decoded EV, hybrid, or ICE signals are present.",
    behavioralEvidence.length ? `Behavior evidence: ${behavioralEvidence.slice(0, 4).join(" ")}` : "Behavior evidence: no correlated directional speed, wheel, pedal, brake, steering, or gear-shaped byte movement was present, so motion claims are intentionally limited.",
    `Protocol behavior: ${protocolInsights.likely_protocol}; extended-ID ratio ${(protocolInsights.extended_id_ratio * 100).toFixed(1)}%, diagnostic-shaped IDs ${protocolInsights.diagnostic_id_candidates.join(", ") || "not present"}.`,
    subtleAbnormalities.length ? `Subtle abnormalities found: ${subtleAbnormalities.slice(0, 5).map((item) => `${item.type} on ${item.id}`).join("; ")}.` : "Subtle abnormality checks did not isolate jitter, drift, sparse-ID, stuck-byte, or entropy-spike evidence above the current thresholds.",
    ecuClusters.length ? `Likely ECU groups: ${ecuClusters.slice(0, 4).map((cluster) => `${cluster.cluster_id} (${cluster.ids.join(", ")})`).join("; ")}.` : "ECU grouping evidence was weak because timing cadence and payload structures did not form repeated multi-ID clusters.",
  ];
  const detailedSummary = [
    "What the Data Actually Shows",
    ...whatDataShows.map((item) => `- ${item}`),
    "",
    "Interpretation",
    `The capture is best described as ${behaviorLabel}. The engine/powertrain read is ${driverBehavior.engine_activity_confidence}, movement read is ${driverBehavior.movement_confidence}, and driver-input read is ${driverBehavior.pedal_activity_confidence}.`,
    `Reverse-engineering priorities are ${analogSignals.slice(0, 8).map((signal) => `${signal.id}:${signal.likely_signal_type}`).join(", ") || "limited because no strong analog signal candidates crossed threshold"}.`,
    `Health notes: ${subtleAbnormalities.length ? subtleAbnormalities.slice(0, 6).map((item) => `${item.severity} ${item.type} on ${item.id}`).join("; ") : "no threshold-level subtle abnormalities were isolated"}.`,
  ].join("\n");

  return {
    ok: true,
    summary: {
      text: detailedSummary,
      what_the_data_actually_shows: whatDataShows,
    },
    total_messages: totalMessages,
    unique_ids: idCounts.size,
    id_stats: idStats,
    anomalies,
    reverse_engineering: reverseEngineering,
    vehicle_behavior: vehicleBehavior,
    diagnostics: {
      protocol: {
        ...protocolInsights,
        total_ids_sampled: totalMessages,
      },
      byte_analysis: byteAnalysis,
      bit_analysis: bitAnalysis,
      timing,
      signals: {
        byte_signal_candidates: byteAnalysis.filter((item) => Number(item.entropy ?? 0) > 0.5),
        active_bit_candidates: bitAnalysis.filter((item) => Number(item.activity ?? 0) > 0.05),
        analog_signal_candidates: analogSignals,
        rpm_signal_candidates: analogSignals.filter((item) => item.likely_signal_type === "rpm_candidate"),
      },
      systems,
      metadata_insights: metadataInsights,
      id_deep_dive: idDeepDive,
      ecu_clusters: ecuClusters,
      counter_checksum_analysis: counterChecksumAnalysis,
      id_classifications: idClassifications,
      module_type_heuristics: systems,
      vehicle_state: vehicleState,
      vehicle_type: vehicleType,
      missing_physical_signals: missingPhysicalSignals,
      infotainment_security_frames: systems.filter((item) => ["infotainment_or_cluster", "body_control_or_security"].includes(String(item.module_type))),
      correlation_analysis: {
        top_correlated_pairs: correlationPairs,
        correlation_matrix: correlationPairs,
        likely_signal_relationships: correlationPairs.map((item) => ({ ...item, explanation: "These IDs share timing cadence and should be reviewed as related ECU/status traffic." })),
      },
      network_health: enhancedNetworkHealth,
      subtle_abnormalities: subtleAbnormalities,
      driver_behavior: driverBehavior,
      event_timeline: [...eventTimeline, ...derivedEvents],
      what_the_data_actually_shows: whatDataShows,
      mechanic_summary: detailedSummary,
    },
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" });

  try {
    const body = await req.json().catch(() => null);
    const fileId = typeof body?.file_id === "string" ? body.file_id : "";
    if (!/^[0-9a-fA-F-]{36}$/.test(fileId)) return jsonResponse({ ok: false, error: "Valid file_id is required" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: metadata, error: metadataError } = await supabase
      .from("can_uploads")
      .select("storage_path")
      .eq("file_id", fileId)
      .maybeSingle();

    if (metadataError) throw new Error(`Upload metadata lookup failed: ${metadataError.message}`);
    if (!metadata?.storage_path) return jsonResponse({ ok: false, error: "File not found" });

    const { data: file, error: downloadError } = await supabase.storage
      .from("can-csv-uploads")
      .download(metadata.storage_path);

    if (downloadError) throw new Error(`Storage download failed: ${downloadError.message}`);

    return jsonResponse(runAnalysis(await file.text()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return jsonResponse({ ok: false, error: message });
  }
});
