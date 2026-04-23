import type { AnalysisResult, JsonRecord } from "@/lib/canApi";

const rows = (value: unknown): JsonRecord[] => Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
const num = (row: JsonRecord, keys: string[]) => Number(keys.map((key) => row[key]).find((value) => typeof value === "number" || (typeof value === "string" && !Number.isNaN(Number(value)))) ?? 0);
const clamp = (value: number) => Math.max(5, Math.min(98, Math.round(value)));
const text = (value: unknown) => value === undefined || value === null || value === "" ? "unknown" : String(value);

export type VehicleIdentification = {
  category: { label: string; confidence: number };
  protocol: { label: string; confidence: number };
  oemStyle: { label: string; confidence: number };
  explanation: string;
};

export type DbcCandidateSignal = {
  id: string;
  name: string;
  byteStart: number;
  bitStart: number;
  bitLength: number;
  endianness: string;
  factor: string;
  unit: string;
  type: string;
  confidence: number;
  explanation: string;
};

export const inferVehicleIdentification = (analysis: AnalysisResult): VehicleIdentification => {
  const protocol = analysis.diagnostics?.protocol as JsonRecord | undefined;
  const systems = rows(analysis.diagnostics?.systems);
  const idStats = rows(analysis.id_stats);
  const byteAnalysis = rows(analysis.diagnostics?.byte_analysis);
  const bitAnalysis = rows(analysis.diagnostics?.bit_analysis);
  const extendedRatio = Number(protocol?.extended_id_ratio ?? 0);
  const hasJ1939 = Boolean(protocol?.has_j1939_shape) || extendedRatio > 0.55;
  const hasDiagnostics = Boolean(protocol?.has_uds_or_isotp_shape) || idStats.some((row) => /^7|18DA/i.test(text(row.id ?? row.key)));
  const highEntropyBytes = byteAnalysis.filter((row) => num(row, ["entropy", "unique_values"]) > 1.5).length;
  const activeBits = bitAnalysis.filter((row) => num(row, ["activity", "transitions"]) > 0.05).length;
  const hasPowertrain = systems.some((row) => /powertrain/i.test(text(row.category)));
  const hasBody = systems.some((row) => /body|chassis/i.test(text(row.category)));
  const hasEvHints = systems.some((row) => /battery|bms|inverter|ev/i.test(`${text(row.category)} ${text(row.id)}`)) || idStats.some((row) => /18DA|18F/i.test(text(row.id ?? row.key))) && highEntropyBytes >= 4;

  const category = hasJ1939
    ? { label: "heavy-duty / J1939-style vehicle", confidence: clamp(72 + extendedRatio * 25) }
    : hasEvHints
      ? { label: "EV or hybrid candidate", confidence: clamp(58 + highEntropyBytes * 5) }
      : hasPowertrain && hasBody
        ? { label: "passenger car or light truck", confidence: clamp(62 + activeBits / 2) }
        : { label: "generic CAN-equipped vehicle", confidence: clamp(48 + Math.min(25, Number(analysis.unique_ids ?? 0))) };

  const protocolGuess = hasJ1939
    ? { label: "J1939 / CAN 2.0B", confidence: clamp(76 + extendedRatio * 20) }
    : hasDiagnostics
      ? { label: "UDS / ISO-TP diagnostic-heavy CAN", confidence: 72 }
      : extendedRatio > 0.25
        ? { label: "mixed standard and extended CAN", confidence: 64 }
        : { label: "CAN 2.0A standard identifiers", confidence: clamp(70 - extendedRatio * 20) };

  const oemStyle = hasEvHints
    ? { label: "Tesla-like / modern EV-style", confidence: clamp(45 + highEntropyBytes * 6) }
    : hasJ1939
      ? { label: "heavy-duty OEM-like", confidence: 70 }
      : hasDiagnostics && hasBody
        ? { label: "GM/Ford-like diagnostic/body network", confidence: 52 }
        : { label: "Toyota/Ford/GM-like generic passenger CAN", confidence: 42 };

  return {
    category,
    protocol: protocolGuess,
    oemStyle,
    explanation: `This is a heuristic fingerprint based on ID width, diagnostic-shaped IDs, timing density, active bits, byte entropy, and system categories. It is not OEM-certified; it points analysts toward the most likely vehicle family before DBC validation.`,
  };
};

export const generatePartialDbcCandidates = (analysis: AnalysisResult): DbcCandidateSignal[] => {
  const vehicle = analysis.vehicle_behavior ?? {};
  const deepDive = rows(analysis.diagnostics?.id_deep_dive);
  const bitRows = rows(analysis.diagnostics?.bit_analysis);
  const speedIds = new Set((vehicle.possible_speed_ids ?? []).map(String));
  const rpmIds = new Set((vehicle.possible_rpm_ids ?? []).map(String));
  const pedalIds = new Set((vehicle.possible_pedal_ids ?? []).map(String));

  const candidates = deepDive.slice(0, 18).flatMap((idRow) => {
    const id = text(idRow.id);
    const volatileBytes = Array.isArray(idRow.volatile_bytes) ? idRow.volatile_bytes.map(Number).filter(Number.isFinite) : [];
    const byteEntropy = rows(idRow.byte_entropy);
    const changingBytes = volatileBytes.length ? volatileBytes : byteEntropy.filter((row) => num(row, ["entropy", "unique_values"]) > 0.6).map((row) => num(row, ["byte_index"]));
    const type = speedIds.has(id) ? "speed" : rpmIds.has(id) ? "RPM" : pedalIds.has(id) ? "pedal" : changingBytes.length >= 2 ? "status / analog signal" : "status";
    const unit = type === "speed" ? "km/h" : type === "RPM" ? "rpm" : type === "pedal" ? "%" : changingBytes.length ? "raw" : "boolean";
    const factor = type === "speed" ? "0.01–0.1" : type === "RPM" ? "0.125–1" : type === "pedal" ? "0.4" : changingBytes.length ? "1" : "1";
    const length = changingBytes.length >= 2 ? 16 : changingBytes.length === 1 ? 8 : 1;
    const byteStart = changingBytes[0] ?? Math.floor(num(bitRows[0] ?? {}, ["bit"]) / 8) ?? 0;
    const confidence = clamp(35 + num(idRow, ["payload_change_rate"]) * 35 + changingBytes.length * 8 + (speedIds.has(id) || rpmIds.has(id) || pedalIds.has(id) ? 20 : 0));
    return [{
      id,
      name: `${type.replace(/\W+/g, "_")}_${id}`,
      byteStart,
      bitStart: byteStart * 8,
      bitLength: length,
      endianness: "Intel/little-endian candidate",
      factor,
      unit,
      type,
      confidence,
      explanation: `Inferred from payload volatility, byte entropy, timing frequency, and whether this ID matched speed/RPM/pedal candidate heuristics. Treat as a draft signal, not an OEM-accurate decode.`,
    }];
  });

  return candidates.length ? candidates : [{ id: "unknown", name: "candidate_status_flag", byteStart: 0, bitStart: 0, bitLength: 1, endianness: "unknown", factor: "1", unit: "boolean", type: "status", confidence: 20, explanation: "Not enough per-ID signal evidence was available; upload a longer log with changing vehicle actions for stronger DBC candidates." }];
};

export const buildPartialDbcDraft = (signals: DbcCandidateSignal[]) => [
  "CJL CAN Intelligence Platform — Partial DBC Draft",
  "Heuristic candidate definitions only. Not OEM-accurate and not a complete DBC file.",
  "",
  ...signals.map((signal) => [
    `ID ${signal.id} :: ${signal.name}`,
    `  start_bit=${signal.bitStart}, length=${signal.bitLength}, endian=${signal.endianness}`,
    `  factor=${signal.factor}, unit=${signal.unit}, type=${signal.type}, confidence=${signal.confidence}%`,
    `  why=${signal.explanation}`,
    "",
  ].join("\n")),
].join("\n");