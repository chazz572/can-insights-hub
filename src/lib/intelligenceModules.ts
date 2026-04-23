// CJL Intelligence Modules — pure derivation utilities.
// All ten new features compute their views from the existing AnalysisResult payload
// without modifying decoding, aliasing, normalization, or summary behavior.

import type { AnalysisResult, JsonRecord } from "@/lib/canApi";

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const recordsOf = (value: unknown): JsonRecord[] => {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) {
    return Object.entries(value).map(([key, item]) =>
      isRecord(item) ? { key, ...item } : { key, value: item },
    );
  }
  return [];
};

export const numOf = (row: JsonRecord | undefined, keys: string[]): number => {
  if (!row) return 0;
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
};

export const textOf = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
};

const idOf = (row: JsonRecord): string => textOf(row.id ?? row.can_id ?? row.arbitration_id ?? row.identifier ?? row.key);
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const round = (v: number, d = 2) => Number.isFinite(v) ? Number(v.toFixed(d)) : 0;

// ──────────────────────────────────────────────────────────────────────────────
// 1. MODULE ACTIVITY MAP — cluster IDs by chatter / timing / volatility
// ──────────────────────────────────────────────────────────────────────────────
export type ModuleCluster = {
  label: string;
  ids: string[];
  state: "active" | "quiet" | "noisy" | "abnormal";
  reason: string;
  averageRate: number;
  averageVolatility: number;
};

export const buildModuleActivityMap = (analysis: AnalysisResult | null | undefined): ModuleCluster[] => {
  if (!analysis) return [];
  const idStats = recordsOf(analysis.id_stats);
  const deepDive = recordsOf(analysis.diagnostics?.id_deep_dive);
  const timing = recordsOf(analysis.diagnostics?.timing);

  if (!idStats.length) return [];

  const deepByMember: Record<string, JsonRecord> = {};
  deepDive.forEach((row) => { deepByMember[idOf(row)] = row; });
  const timingByMember: Record<string, JsonRecord> = {};
  timing.forEach((row) => { timingByMember[idOf(row)] = row; });

  const total = numOf({ value: analysis.total_messages }, ["value"]) || idStats.reduce((s, r) => s + numOf(r, ["count", "messages", "frequency", "total", "value"]), 0) || 1;
  const enriched = idStats.map((row) => {
    const id = idOf(row);
    const count = numOf(row, ["count", "messages", "frequency", "total", "value"]);
    const share = count / total;
    const dd = deepByMember[id] ?? {};
    const t = timingByMember[id] ?? {};
    const volatility = numOf(dd, ["payload_change_rate"]);
    const jitter = numOf(t, ["period_jitter", "jitter"]);
    const period = numOf(t, ["average_period", "mean_period", "period"]);
    return { id, count, share, volatility, jitter, period };
  });

  const noisyThreshold = 0.18;
  const quietThreshold = 0.005;
  const volatileThreshold = 0.25;
  const abnormalJitter = 0.06;

  const clusters: ModuleCluster[] = [
    { label: "Active periodic modules", ids: [], state: "active", reason: "Steady chatter with normal volatility — typical of healthy broadcasting ECUs.", averageRate: 0, averageVolatility: 0 },
    { label: "Quiet / dormant identifiers", ids: [], state: "quiet", reason: "Very low message share — sleeping modules, one-shot frames, or event-only IDs.", averageRate: 0, averageVolatility: 0 },
    { label: "Noisy / dominant talkers", ids: [], state: "noisy", reason: "Outsized share of bus traffic — review for chatter or stuck broadcasters.", averageRate: 0, averageVolatility: 0 },
    { label: "Abnormal / unstable behaviour", ids: [], state: "abnormal", reason: "High jitter or unusually volatile payloads — investigate first.", averageRate: 0, averageVolatility: 0 },
  ];

  const buckets: Record<ModuleCluster["state"], typeof enriched> = { active: [], quiet: [], noisy: [], abnormal: [] };

  for (const row of enriched) {
    if (row.jitter > abnormalJitter || row.volatility > volatileThreshold * 2) buckets.abnormal.push(row);
    else if (row.share > noisyThreshold) buckets.noisy.push(row);
    else if (row.share < quietThreshold) buckets.quiet.push(row);
    else buckets.active.push(row);
  }

  for (const cluster of clusters) {
    const items = buckets[cluster.state];
    cluster.ids = items.map((i) => i.id).slice(0, 24);
    cluster.averageRate = round(items.reduce((s, i) => s + i.share, 0) / Math.max(items.length, 1) * 100, 2);
    cluster.averageVolatility = round(items.reduce((s, i) => s + i.volatility, 0) / Math.max(items.length, 1), 3);
  }

  return clusters.filter((c) => c.ids.length > 0);
};

// ──────────────────────────────────────────────────────────────────────────────
// 2. DYNAMIC BYTE HEATMAP — per-ID byte volatility classification
// ──────────────────────────────────────────────────────────────────────────────
export type ByteHeatCell = { byteIndex: number; volatility: number; classification: "static" | "rare" | "moderate" | "dynamic" };
export type ByteHeatRow = { id: string; cells: ByteHeatCell[]; dynamicCount: number };

const classifyVolatility = (v: number): ByteHeatCell["classification"] =>
  v >= 0.5 ? "dynamic" : v >= 0.15 ? "moderate" : v > 0 ? "rare" : "static";

export const buildDynamicByteHeatmap = (analysis: AnalysisResult | null | undefined): ByteHeatRow[] => {
  if (!analysis) return [];
  const deep = recordsOf(analysis.diagnostics?.id_deep_dive);
  const fallback = recordsOf(analysis.diagnostics?.byte_analysis);

  if (deep.length) {
    return deep.slice(0, 24).map((row) => {
      const id = idOf(row);
      const entropy = recordsOf(row.byte_entropy);
      const volatile = Array.isArray(row.volatile_bytes) ? row.volatile_bytes.map(Number).filter(Number.isFinite) : [];
      const cells: ByteHeatCell[] = Array.from({ length: 8 }, (_, byteIndex) => {
        const fromEntropy = entropy.find((e) => numOf(e, ["byte_index", "byte"]) === byteIndex);
        const explicit = fromEntropy ? numOf(fromEntropy, ["entropy", "score", "value", "unique_values"]) / 8 : volatile.includes(byteIndex) ? 0.6 : 0;
        const v = clamp(explicit, 0, 1);
        return { byteIndex, volatility: round(v, 3), classification: classifyVolatility(v) };
      });
      return { id, cells, dynamicCount: cells.filter((c) => c.classification !== "static").length };
    });
  }

  // Fallback when only flat byte_analysis exists
  return fallback.slice(0, 24).map((row, i) => {
    const v = clamp(numOf(row, ["entropy", "score", "value", "unique_values"]) / 8, 0, 1);
    return {
      id: textOf(row.id ?? row.byte ?? `byte_${i}`),
      cells: Array.from({ length: 8 }, (_, byteIndex) => ({ byteIndex, volatility: round(v, 3), classification: classifyVolatility(v) })),
      dynamicCount: v > 0 ? 8 : 0,
    };
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// 3. ACTIVE BIT DETECTOR — bit toggles, flag-likeness, correlation hints
// ──────────────────────────────────────────────────────────────────────────────
export type ActiveBit = {
  id: string;
  bit: number;
  byte: number;
  bitInByte: number;
  activity: number;
  ones: number;
  zeros: number;
  pattern: "toggle" | "flag" | "stuck-high" | "stuck-low" | "rare-event";
  correlation: string;
};

export const buildActiveBitMap = (analysis: AnalysisResult | null | undefined): ActiveBit[] => {
  if (!analysis) return [];
  const rows = recordsOf(analysis.diagnostics?.bit_analysis);
  if (!rows.length) return [];

  const detected: ActiveBit[] = rows.slice(0, 64).map((row) => {
    const bit = Math.round(numOf(row, ["bit", "bit_index", "index"]));
    const ones = numOf(row, ["ones", "high_count"]);
    const zeros = numOf(row, ["zeros", "low_count"]);
    const total = ones + zeros || 1;
    const activity = numOf(row, ["activity", "transitions"]) || Math.min(ones, zeros) / total;
    const ratio = ones / total;
    const pattern: ActiveBit["pattern"] =
      activity > 0.35 ? "toggle"
      : ratio > 0.95 ? "stuck-high"
      : ratio < 0.05 ? "stuck-low"
      : activity > 0.05 ? "flag"
      : "rare-event";
    return {
      id: textOf(row.id ?? row.key ?? "bit_stream"),
      bit,
      byte: Math.floor(bit / 8),
      bitInByte: bit % 8,
      activity: round(activity, 3),
      ones,
      zeros,
      pattern,
      correlation: pattern === "toggle" ? "Pairs likely with adjacent toggling bits or counter LSB." : pattern === "flag" ? "Likely a status flag tied to ID-level state changes." : pattern === "stuck-high" || pattern === "stuck-low" ? "Constant — useful as a module-presence marker." : "Sparse event bit; correlate with anomalies in time.",
    };
  });

  return detected.filter((b) => b.pattern !== "rare-event" || b.activity > 0).sort((a, b) => b.activity - a.activity);
};

// ──────────────────────────────────────────────────────────────────────────────
// 4. COUNTER / CHECKSUM DETECTOR
// ──────────────────────────────────────────────────────────────────────────────
export type CounterChecksumCandidate = {
  id: string;
  byteIndex: number;
  kind: "rolling_counter" | "wraparound" | "checksum" | "candidate";
  confidence: number;
  reason: string;
};

export const detectCountersAndChecksums = (analysis: AnalysisResult | null | undefined): CounterChecksumCandidate[] => {
  if (!analysis) return [];
  const explicit = recordsOf(analysis.diagnostics?.counter_checksum_analysis);
  if (explicit.length) {
    return explicit.slice(0, 32).map((row) => ({
      id: idOf(row),
      byteIndex: Math.round(numOf(row, ["byte_index", "byte"])),
      kind: (textOf(row.kind ?? row.type ?? "candidate").toLowerCase().includes("check") ? "checksum" : textOf(row.kind ?? "").toLowerCase().includes("wrap") ? "wraparound" : textOf(row.kind ?? "").toLowerCase().includes("count") ? "rolling_counter" : "candidate") as CounterChecksumCandidate["kind"],
      confidence: clamp(Math.round(numOf(row, ["confidence", "confidence_score"]) * (numOf(row, ["confidence"]) > 1 ? 1 : 100))),
      reason: textOf(row.reason ?? row.note ?? "Backend-detected counter/checksum candidate."),
    }));
  }

  const deep = recordsOf(analysis.diagnostics?.id_deep_dive);
  const candidates: CounterChecksumCandidate[] = [];
  for (const row of deep) {
    const id = idOf(row);
    const entropy = recordsOf(row.byte_entropy);
    const volatile = Array.isArray(row.volatile_bytes) ? row.volatile_bytes.map(Number).filter(Number.isFinite) : [];
    for (let byte = 0; byte < 8; byte += 1) {
      const e = entropy.find((entry) => numOf(entry, ["byte_index", "byte"]) === byte);
      const unique = numOf(e, ["unique_values"]);
      const ent = numOf(e, ["entropy"]);
      const isVolatile = volatile.includes(byte);
      // Rolling counter: small but consistent unique set, low entropy ramp
      if (isVolatile && unique >= 4 && unique <= 16 && ent > 0 && ent < 4) {
        candidates.push({ id, byteIndex: byte, kind: "rolling_counter", confidence: clamp(45 + unique * 3), reason: `Byte ${byte} cycles through ${unique} values — counter wraparound shape.` });
      } else if (isVolatile && unique >= 200) {
        candidates.push({ id, byteIndex: byte, kind: "checksum", confidence: clamp(50 + Math.round(ent * 8)), reason: `Byte ${byte} uses near-full 0–255 range with high entropy — typical CRC/XOR checksum.` });
      }
    }
  }
  return candidates.slice(0, 32);
};

// ──────────────────────────────────────────────────────────────────────────────
// 5. CAN HEALTH SCORE
// ──────────────────────────────────────────────────────────────────────────────
export type CanHealthScore = {
  score: number;
  grade: "Excellent" | "Healthy" | "Watch" | "Degraded" | "Unstable";
  components: { label: string; score: number; weight: number; note: string }[];
  explanation: string;
};

export const computeCanHealthScore = (analysis: AnalysisResult | null | undefined): CanHealthScore => {
  const base: CanHealthScore = {
    score: 0,
    grade: "Watch",
    components: [],
    explanation: "Insufficient data to compute a health score.",
  };
  if (!analysis) return base;

  const timing = recordsOf(analysis.diagnostics?.timing);
  const idStats = recordsOf(analysis.id_stats);
  const deep = recordsOf(analysis.diagnostics?.id_deep_dive);
  const anomalies = recordsOf(analysis.anomalies);
  const total = Number(analysis.total_messages ?? 0) || idStats.reduce((s, r) => s + numOf(r, ["count", "messages", "value"]), 0);

  const avgJitter = timing.length ? timing.reduce((s, r) => s + numOf(r, ["period_jitter", "jitter"]), 0) / timing.length : 0;
  const jitterScore = clamp(Math.round(100 - Math.min(95, avgJitter * 800)));

  const maxShare = idStats.length ? Math.max(...idStats.map((r) => numOf(r, ["count", "messages", "value"]) / Math.max(total, 1))) : 0;
  const chatterScore = clamp(Math.round(100 - Math.min(95, maxShare * 220)));

  const avgVol = deep.length ? deep.reduce((s, r) => s + numOf(r, ["payload_change_rate"]), 0) / deep.length : 0.1;
  const volatilityScore = clamp(Math.round(100 - Math.min(75, Math.max(0, avgVol - 0.5) * 150)));

  const idStability = clamp(Math.round(100 - Math.min(80, anomalies.length * 6)));

  const components = [
    { label: "Timing jitter", score: jitterScore, weight: 0.30, note: `Average jitter ${avgJitter.toFixed(4)} s — ${jitterScore >= 80 ? "steady scheduling" : jitterScore >= 55 ? "some irregularity" : "noticeable instability"}.` },
    { label: "Chatter volume", score: chatterScore, weight: 0.25, note: `Top talker uses ${(maxShare * 100).toFixed(1)}% of frames.` },
    { label: "Payload volatility", score: volatilityScore, weight: 0.20, note: `Mean per-ID change rate ${(avgVol * 100).toFixed(1)}%.` },
    { label: "ID stability", score: idStability, weight: 0.25, note: `${anomalies.length} anomalous frame${anomalies.length === 1 ? "" : "s"} flagged.` },
  ];

  const score = clamp(Math.round(components.reduce((s, c) => s + c.score * c.weight, 0)));
  const grade: CanHealthScore["grade"] = score >= 90 ? "Excellent" : score >= 78 ? "Healthy" : score >= 60 ? "Watch" : score >= 40 ? "Degraded" : "Unstable";
  const explanation = `Composite of timing jitter (${jitterScore}), chatter (${chatterScore}), payload volatility (${volatilityScore}), and ID stability (${idStability}). Score reflects only what the captured frames show; it does not imply mechanical fault.`;
  return { score, grade, components, explanation };
};

// ──────────────────────────────────────────────────────────────────────────────
// 6. BEHAVIOR SUMMARIES — rising / falling / cyclic / stable / noisy
// ──────────────────────────────────────────────────────────────────────────────
export type BehaviorSummary = { subject: string; behavior: "rising" | "falling" | "cyclic" | "stable" | "noisy" | "mixed"; description: string };

const numericSeries = (row: JsonRecord): number[] => {
  for (const key of ["values", "samples", "history", "series"]) {
    const arr = row[key];
    if (Array.isArray(arr)) return arr.map(Number).filter(Number.isFinite);
  }
  return [];
};

const classifySeries = (values: number[]): BehaviorSummary["behavior"] => {
  if (values.length < 3) return "stable";
  const first = values[0];
  const last = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span === 0) return "stable";
  let direction = 0;
  for (let i = 1; i < values.length; i += 1) direction += Math.sign(values[i] - values[i - 1]);
  const directionRatio = direction / (values.length - 1);
  if (directionRatio > 0.55 && last > first) return "rising";
  if (directionRatio < -0.55 && last < first) return "falling";
  let crossings = 0;
  const mid = (max + min) / 2;
  for (let i = 1; i < values.length; i += 1) if ((values[i - 1] - mid) * (values[i] - mid) < 0) crossings += 1;
  if (crossings >= 4) return "cyclic";
  if (span / Math.max(Math.abs(mid), 1) > 0.8) return "noisy";
  return "mixed";
};

export const buildBehaviorSummaries = (analysis: AnalysisResult | null | undefined): BehaviorSummary[] => {
  if (!analysis) return [];
  const decoded = recordsOf(analysis.diagnostics?.decoded_signals);
  const deep = recordsOf(analysis.diagnostics?.id_deep_dive);
  const summaries: BehaviorSummary[] = [];

  for (const row of decoded.slice(0, 12)) {
    const series = numericSeries(row);
    const subject = textOf(row.signal ?? row.name ?? row.id ?? "decoded signal");
    const behavior = series.length ? classifySeries(series) : "stable";
    summaries.push({
      subject,
      behavior,
      description: series.length
        ? `Signal trace shows ${behavior} behaviour across ${series.length} samples (min ${Math.min(...series).toFixed(2)}, max ${Math.max(...series).toFixed(2)}).`
        : `No sample series available — classified as stable based on metadata only.`,
    });
  }

  for (const row of deep.slice(0, 8)) {
    const change = numOf(row, ["payload_change_rate"]);
    const subject = `ID ${idOf(row)} payload`;
    const behavior: BehaviorSummary["behavior"] = change > 0.7 ? "noisy" : change > 0.3 ? "cyclic" : change > 0.05 ? "mixed" : "stable";
    summaries.push({ subject, behavior, description: `Payload changes in ${(change * 100).toFixed(1)}% of frames.` });
  }

  return summaries;
};

// ──────────────────────────────────────────────────────────────────────────────
// 7. DBC AUTO-MATCHING ENHANCEMENTS — confidence per match
// ──────────────────────────────────────────────────────────────────────────────
export type DbcMatchInsight = {
  totalLogIds: number;
  matchedIds: number;
  unmatchedIds: string[];
  matches: { logId: string; dbcId: string; method: string; confidence: number }[];
  notes: string[];
};

const normaliseId = (raw: string): { dec: string; hex: string } => {
  const stripped = raw.replace(/^0x/i, "").trim();
  const isHex = /[a-f]/i.test(stripped);
  const isDecOnly = /^\d+$/.test(stripped);
  let decValue = NaN;
  if (isHex) decValue = parseInt(stripped, 16);
  else if (isDecOnly) decValue = parseInt(stripped, 10);
  if (!Number.isFinite(decValue)) return { dec: stripped, hex: stripped.toUpperCase() };
  return { dec: String(decValue), hex: decValue.toString(16).toUpperCase() };
};

export const evaluateDbcMatching = (analysis: AnalysisResult | null | undefined): DbcMatchInsight => {
  const empty: DbcMatchInsight = { totalLogIds: 0, matchedIds: 0, unmatchedIds: [], matches: [], notes: ["No DBC data available."] };
  if (!analysis) return empty;
  const decoded = recordsOf(analysis.diagnostics?.decoded_signals);
  const inventory = recordsOf(analysis.diagnostics?.can_id_inventory);
  const dbc = isRecord(analysis.diagnostics?.dbc) ? analysis.diagnostics?.dbc as JsonRecord : undefined;
  const dbcMessages = recordsOf(dbc?.messages);

  if (!dbcMessages.length && !decoded.length) return empty;

  const dbcDec = new Set<string>();
  const dbcHex = new Set<string>();
  for (const m of dbcMessages) {
    const { dec, hex } = normaliseId(textOf(m.id ?? m.message_id ?? m.can_id));
    dbcDec.add(dec);
    dbcHex.add(hex);
  }

  const logIds = inventory.length ? inventory.map((r) => textOf(r.id ?? r.can_id ?? r.key)) : recordsOf(analysis.id_stats).map((r) => idOf(r));
  const matches: DbcMatchInsight["matches"] = [];
  const matched = new Set<string>();

  for (const logId of logIds) {
    const { dec, hex } = normaliseId(logId);
    const stdMask = Number.isFinite(Number(dec)) ? String(Number(dec) & 0x7ff) : "";
    if (dbcDec.has(dec)) {
      matches.push({ logId, dbcId: dec, method: "decimal exact", confidence: 99 });
      matched.add(logId);
    } else if (dbcHex.has(hex)) {
      matches.push({ logId, dbcId: `0x${hex}`, method: "hex exact", confidence: 96 });
      matched.add(logId);
    } else if (stdMask && dbcDec.has(stdMask)) {
      matches.push({ logId, dbcId: stdMask, method: "extended → standard mask", confidence: 78 });
      matched.add(logId);
    } else if (decoded.some((d) => textOf(d.id ?? d.can_id) === logId)) {
      matches.push({ logId, dbcId: logId, method: "backend alias", confidence: 70 });
      matched.add(logId);
    }
  }

  const unmatched = logIds.filter((id) => !matched.has(id));
  const notes = [
    `${matches.length} of ${logIds.length} log IDs matched a DBC definition.`,
    unmatched.length ? `Unmatched IDs are reported below — verify base (hex/dec) and frame width.` : `All log IDs reconciled with the DBC.`,
  ];
  return { totalLogIds: logIds.length, matchedIds: matches.length, unmatchedIds: unmatched.slice(0, 24), matches: matches.slice(0, 50), notes };
};

// ──────────────────────────────────────────────────────────────────────────────
// 8. INSTANT INTELLIGENCE BRIEF — combined, deduplicated overview
// ──────────────────────────────────────────────────────────────────────────────
export type InstantIntelligence = {
  headline: string;
  highlights: string[];
  modules: number;
  dynamicBytes: number;
  activeBits: number;
  counters: number;
  health: CanHealthScore;
};

export const buildInstantIntelligence = (analysis: AnalysisResult | null | undefined): InstantIntelligence => {
  const health = computeCanHealthScore(analysis);
  const modules = buildModuleActivityMap(analysis);
  const heat = buildDynamicByteHeatmap(analysis);
  const bits = buildActiveBitMap(analysis);
  const counters = detectCountersAndChecksums(analysis);
  const dbc = evaluateDbcMatching(analysis);

  const dynamicBytes = heat.reduce((s, r) => s + r.dynamicCount, 0);
  const headline = `${health.grade} bus · ${modules.length} module clusters · ${dynamicBytes} dynamic bytes · ${bits.length} active bits`;
  const highlights: string[] = [];
  highlights.push(`Health score ${health.score}/100 (${health.grade}).`);
  if (modules.length) highlights.push(`${modules.length} cluster${modules.length === 1 ? "" : "s"} identified across active, quiet, noisy, and abnormal states.`);
  if (counters.length) highlights.push(`${counters.length} counter/checksum candidate${counters.length === 1 ? "" : "s"} detected.`);
  if (dbc.totalLogIds) highlights.push(`${dbc.matchedIds}/${dbc.totalLogIds} log IDs matched against the DBC.`);
  if (bits.length) highlights.push(`${bits.length} bit-level toggles or flags suitable for boolean decoding.`);

  return { headline, highlights, modules: modules.length, dynamicBytes, activeBits: bits.length, counters: counters.length, health };
};

// ──────────────────────────────────────────────────────────────────────────────
// 9 + 10. ECU SWAP HELPER & GATEWAY TRANSLATOR BUILDER
// ──────────────────────────────────────────────────────────────────────────────
export type SwapPair = {
  sourceId: string;
  targetId: string;
  overlapBytes: number[];
  sharedCounters: number;
  timingDeltaMs: number;
  confidence: number;
  rationale: string;
};

export type GatewayRule = {
  fromId: string;
  toId: string;
  byteMap: { from: number; to: number; transform: string }[];
  notes: string;
};

const fingerprintForSwap = (analysis: AnalysisResult | null | undefined) => {
  if (!analysis) return [] as Array<{ id: string; volatileBytes: number[]; counters: number; period: number }>;
  const deep = recordsOf(analysis.diagnostics?.id_deep_dive);
  const timing = recordsOf(analysis.diagnostics?.timing);
  const counters = detectCountersAndChecksums(analysis);
  const counterByLog = counters.reduce<Record<string, number>>((acc, c) => { acc[c.id] = (acc[c.id] ?? 0) + 1; return acc; }, {});
  const timingByLog: Record<string, number> = {};
  timing.forEach((row) => { timingByLog[idOf(row)] = numOf(row, ["average_period", "mean_period", "period"]); });
  return deep.map((row) => {
    const id = idOf(row);
    const volatileBytes = Array.isArray(row.volatile_bytes) ? row.volatile_bytes.map(Number).filter(Number.isFinite) : [];
    return { id, volatileBytes, counters: counterByLog[id] ?? 0, period: timingByLog[id] ?? 0 };
  });
};

export const buildEcuSwapPairs = (before: AnalysisResult | null | undefined, after: AnalysisResult | null | undefined): SwapPair[] => {
  const a = fingerprintForSwap(before);
  const b = fingerprintForSwap(after);
  if (!a.length || !b.length) return [];
  const pairs: SwapPair[] = [];
  for (const src of a) {
    let best: { target: typeof b[number]; overlap: number[]; score: number } | null = null;
    for (const tgt of b) {
      const overlap = src.volatileBytes.filter((byte) => tgt.volatileBytes.includes(byte));
      const counterMatch = Math.min(src.counters, tgt.counters);
      const periodCloseness = src.period && tgt.period ? 1 - Math.min(1, Math.abs(src.period - tgt.period) / Math.max(src.period, tgt.period)) : 0.3;
      const score = overlap.length * 14 + counterMatch * 10 + periodCloseness * 30;
      if (!best || score > best.score) best = { target: tgt, overlap, score };
    }
    if (best && best.score > 14) {
      const timingDeltaMs = round(Math.abs(src.period - best.target.period) * 1000, 2);
      pairs.push({
        sourceId: src.id,
        targetId: best.target.id,
        overlapBytes: best.overlap,
        sharedCounters: Math.min(src.counters, best.target.counters),
        timingDeltaMs,
        confidence: clamp(Math.round(best.score)),
        rationale: `Overlapping volatile bytes (${best.overlap.join(", ") || "none"}), shared counters, and ${timingDeltaMs} ms timing delta.`,
      });
    }
  }
  return pairs.sort((x, y) => y.confidence - x.confidence).slice(0, 24);
};

export const buildGatewayTranslator = (pairs: SwapPair[]): GatewayRule[] =>
  pairs.map((pair) => ({
    fromId: pair.sourceId,
    toId: pair.targetId,
    byteMap: (pair.overlapBytes.length ? pair.overlapBytes : [0, 1, 2, 3]).slice(0, 8).map((byte) => ({
      from: byte,
      to: byte,
      transform: pair.sharedCounters > 0 && byte === pair.overlapBytes[0] ? "passthrough + counter realign" : "passthrough",
    })),
    notes: `Confidence ${pair.confidence}%. Verify with bench capture before deploying as gateway logic.`,
  }));

export const exportTranslatorTable = (rules: GatewayRule[]): string => {
  const header = ["from_id", "to_id", "from_byte", "to_byte", "transform", "notes"].join(",");
  const rows = rules.flatMap((rule) => rule.byteMap.map((m) => [rule.fromId, rule.toId, m.from, m.to, m.transform, rule.notes.replace(/,/g, ";")].join(",")));
  return [header, ...rows].join("\n");
};
