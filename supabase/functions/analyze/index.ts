import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type JsonRecord = Record<string, unknown>;
type CsvIndexes = { timestampIndex: number; idIndex: number; dataIndex: number };
type ParsedRecord = { id: string; data: string; timestamp: number };
type IdProfile = {
  count: number;
  lengths: Map<number, number>;
  timestamps: number[];
  byteCounts: Array<Map<number, number>>;
  previousData: string | null;
  changes: number;
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

  if (idIndex < 0 || dataIndex < 0) {
    throw new Error("Normalized CSV is missing required id/data columns.");
  }

  return { timestampIndex, idIndex, dataIndex };
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

  forEachCsvRecord(csv, ({ id, data, timestamp }) => {
    totalMessages += 1;
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    const profile = idProfiles.get(id) ?? { count: 0, lengths: new Map<number, number>(), timestamps: [], byteCounts: Array.from({ length: 8 }, () => new Map<number, number>()), previousData: null, changes: 0 };
    profile.count += 1;
    profile.lengths.set(data.length, (profile.lengths.get(data.length) ?? 0) + 1);
    if (Number.isFinite(timestamp)) profile.timestamps.push(timestamp);
    if (profile.previousData !== null && profile.previousData !== cleanHex(data)) profile.changes += 1;
    profile.previousData = cleanHex(data);
    idProfiles.set(id, profile);

    if (cleanHex(id).length > 3) extendedIds += 1;

    const payloadLength = byteValues(data).length;
    const delta = payloadLength - meanLength;
    meanLength += delta / totalMessages;
    m2Length += delta * (payloadLength - meanLength);

    if (payloadLength === 2) speedIds.add(id);
    if (payloadLength === 4) rpmIds.add(id);
    if (payloadLength === 1) pedalIds.add(id);

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

    return { id, category, module_type, confidence_score: category === "diagnostic" ? 0.82 : 0.58, confidence: "heuristic", reasoning: `ID range ${cleanHex(id)} maps heuristically to ${module_type}.` };
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
      return score > 0.48 ? {
        id,
        byte_start,
        bit_start: byte_start * 8,
        bit_length: 16,
        endianness: beScore >= leScore ? "big_endian_candidate" : "little_endian_candidate",
        min_value: Math.min(...values),
        max_value: Math.max(...values),
        unique_values: new Set(values).size,
        confidence_score: Number(Math.min(0.96, score).toFixed(3)),
        likely_signal_type: byte_start <= 2 && Math.max(...values) > 900 && Math.max(...values) < 9000 ? "rpm_candidate" : "analog_signal_candidate",
        reasoning: "Smooth changing 16-bit byte pair with enough range and transitions to resemble an analog engine/sensor signal.",
      } : null;
    }).filter(Boolean);
  }) as JsonRecord[];

  analogSignals.filter((signal) => signal.likely_signal_type === "rpm_candidate").forEach((signal) => rpmIds.add(String(signal.id)));

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

  const driverBehavior = {
    movement_confidence: speedIds.size ? "candidate" : "unknown",
    engine_activity_confidence: rpmIds.size ? "candidate" : "unknown",
    pedal_activity_confidence: pedalIds.size ? "candidate" : "unknown",
    harsh_event_candidates: anomalies.slice(0, 12),
    interpretation: speedIds.size || pedalIds.size ? "Vehicle activity signals are present, but exact driving behavior requires DBC validation." : "Driving behavior cannot be confirmed from this capture without stronger speed/pedal candidates.",
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
    classification: speedIds.size || pedalIds.size ? "possible_low_speed_or_driving" : rpmIds.size ? "engine_running_stationary" : "ignition_on_idle_or_accessory",
    confidence_score: speedIds.size || pedalIds.size ? 0.62 : 0.86,
    reasoning: speedIds.size || pedalIds.size ? "Motion-like candidates exist, but full driving state needs validation against controlled movement." : "Motion, wheel-speed, pedal, brake, steering, torque, and gear signals are absent while periodic housekeeping traffic is present.",
  };

  const correlationPairs = idDeepDive.flatMap((left, leftIndex) => idDeepDive.slice(leftIndex + 1).map((right) => ({ left: left.id, right: right.id, correlation: Number((1 - Math.min(1, Math.abs(Number(left.average_period) - Number(right.average_period)))).toFixed(4)), relationship: "timing_cadence_similarity" }))).filter((item) => item.correlation >= 0.72).slice(0, 24);
  const enhancedNetworkHealth = { ...networkHealth, bus_health_score: Math.max(0, Math.min(100, 100 - anomalies.length * 4 - Math.round(Number(networkHealth.timing_irregularity_score) * 120))), chatter_classification: idStats.some((item) => item.percentage > 35) ? "dominant_id_chatter" : totalMessages / Math.max(idCounts.size, 1) > 60 ? "busy_periodic_chatter" : "normal_idle_chatter", dropout_events: timing.filter((item) => Number(item.max_period) > Math.max(Number(item.average_period) * 3, 0.1)).map((item) => ({ id: item.id, max_period: item.max_period, average_period: item.average_period, classification: "possible_gap_or_dropout" })).slice(0, 16) };
  const derivedEvents = enhancedNetworkHealth.dropout_events.map((item, index) => ({ event_index: eventTimeline.length + index + 1, id: item.id, timestamp: null, event_type: "possible_module_dropout", description: `Timing gap detected: max period ${item.max_period}s vs average ${item.average_period}s.`, before_after_hint: "Compare nearby frames to confirm wake/sleep or missing traffic." }));

  return {
    ok: true,
    summary: {
      text: `Parsed ${totalMessages} messages across ${idCounts.size} unique IDs. Detected ${anomalies.length} anomalies and ${reverseEngineering.length} reverse-engineering candidates.`,
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
      },
      systems,
      id_deep_dive: idDeepDive,
      ecu_clusters: ecuClusters,
      counter_checksum_analysis: counterChecksumAnalysis,
      id_classifications: idClassifications,
      module_type_heuristics: systems,
      vehicle_state: vehicleState,
      missing_physical_signals: missingPhysicalSignals,
      infotainment_security_frames: systems.filter((item) => ["infotainment_or_cluster", "body_control_or_security"].includes(String(item.module_type))),
      correlation_analysis: {
        top_correlated_pairs: correlationPairs,
        correlation_matrix: correlationPairs,
        likely_signal_relationships: correlationPairs.map((item) => ({ ...item, explanation: "These IDs share timing cadence and should be reviewed as related ECU/status traffic." })),
      },
      network_health: enhancedNetworkHealth,
      driver_behavior: driverBehavior,
      event_timeline: [...eventTimeline, ...derivedEvents],
      mechanic_summary: `Capture contains ${totalMessages} CAN messages. ${anomalies.length} anomalous payloads were detected. Candidate speed IDs: ${vehicleBehavior.possible_speed_ids.join(", ") || "none"}. Candidate RPM IDs: ${vehicleBehavior.possible_rpm_ids.join(", ") || "none"}.`,
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
