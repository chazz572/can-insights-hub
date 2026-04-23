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
  byteSeries: number[][];
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

const pearson = (a: number[], b: number[]) => {
  const length = Math.min(a.length, b.length);
  if (length < 4) return 0;
  const x = a.slice(0, length);
  const y = b.slice(0, length);
  const ax = average(x);
  const ay = average(y);
  const numerator = x.reduce((sum, value, index) => sum + (value - ax) * (y[index] - ay), 0);
  const dx = Math.sqrt(x.reduce((sum, value) => sum + (value - ax) ** 2, 0));
  const dy = Math.sqrt(y.reduce((sum, value) => sum + (value - ay) ** 2, 0));
  return dx && dy ? Number((numerator / (dx * dy)).toFixed(4)) : 0;
};

const classifyVolatility = (changeRate: number, volatileByteCount: number) => {
  if (changeRate > 0.75 || volatileByteCount >= 4) return "volatile";
  if (changeRate > 0.35 || volatileByteCount >= 2) return "dynamic";
  if (changeRate > 0.05 || volatileByteCount >= 1) return "semi-static";
  return "static";
};

const detectByteBehavior = (series: number[]) => {
  const values = series.filter((value) => Number.isFinite(value));
  if (values.length < 4) return { counter: false, direction: "none", modulo: null as number | null, checksum_like: false, confidence: 0 };
  const deltas = values.slice(1).map((value, index) => value - values[index]);
  const inc = deltas.filter((delta) => delta === 1 || delta < -200).length;
  const dec = deltas.filter((delta) => delta === -1 || delta > 200).length;
  const unique = new Set(values).size;
  const transitions = deltas.filter((delta) => delta !== 0).length;
  const counterScore = Math.max(inc, dec) / Math.max(deltas.length, 1);
  const checksumScore = unique / values.length;
  return {
    counter: counterScore > 0.55,
    direction: inc >= dec ? "incrementing" : "decrementing",
    modulo: counterScore > 0.55 && unique <= 16 ? unique : null,
    checksum_like: checksumScore > 0.65 && transitions / Math.max(deltas.length, 1) > 0.65,
    confidence: Number(Math.max(counterScore, checksumScore * 0.75).toFixed(3)),
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

  forEachCsvRecord(csv, ({ id, data, timestamp }) => {
    totalMessages += 1;
    idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    const profile = idProfiles.get(id) ?? { count: 0, lengths: new Map<number, number>(), timestamps: [], byteCounts: Array.from({ length: 8 }, () => new Map<number, number>()), byteSeries: Array.from({ length: 8 }, () => []), previousData: null, changes: 0, cleanSamples: [] };
    profile.count += 1;
    profile.lengths.set(data.length, (profile.lengths.get(data.length) ?? 0) + 1);
    if (Number.isFinite(timestamp)) profile.timestamps.push(timestamp);
    if (profile.previousData !== null && profile.previousData !== cleanHex(data)) profile.changes += 1;
    profile.previousData = cleanHex(data);
    idProfiles.set(id, profile);

    if (cleanHex(id).length > 3) extendedIds += 1;

    const payloadLength = data.length;
    const delta = payloadLength - meanLength;
    meanLength += delta / totalMessages;
    m2Length += delta * (payloadLength - meanLength);

    if (payloadLength === 2) speedIds.add(id);
    if (payloadLength === 4) rpmIds.add(id);
    if (payloadLength === 1) pedalIds.add(id);

    const bytes = byteValues(data);

    bytes.forEach((byte, byteIndex) => {
      profile.byteCounts[byteIndex].set(byte, (profile.byteCounts[byteIndex].get(byte) ?? 0) + 1);
      if (profile.byteSeries[byteIndex].length < 400) profile.byteSeries[byteIndex].push(byte);
    });
    if (profile.cleanSamples.length < 400) profile.cleanSamples.push(cleanHex(data));

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
    if (data.length > anomalyThreshold) {
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

  const idClassifications = idDeepDive.map((item) => {
    const volatility_score = Math.min(1, Number(item.payload_change_rate) + (Array.isArray(item.volatile_bytes) ? item.volatile_bytes.length : 0) / 8);
    const classification = classifyVolatility(Number(item.payload_change_rate), Array.isArray(item.volatile_bytes) ? item.volatile_bytes.length : 0);
    return { id: item.id, classification, volatility_score: Number(volatility_score.toFixed(4)), reasoning: `${item.id} changed in ${Math.round(Number(item.payload_change_rate) * 100)}% of observed transitions with ${(item.volatile_bytes as number[]).length} volatile byte position(s).` };
  });

  const counterChecksum = [...idProfiles.entries()].map(([id, profile]) => {
    const byte_behavior = profile.byteSeries.map((series, byte_index) => ({ byte_index, ...detectByteBehavior(series) }));
    return {
      id,
      counters: byte_behavior.filter((item) => item.counter).map((item) => ({ byte_index: item.byte_index, direction: item.direction, modulo: item.modulo, confidence: item.confidence })),
      checksums: byte_behavior.filter((item) => item.checksum_like && !item.counter).map((item) => ({ byte_index: item.byte_index, confidence: item.confidence })),
      byte_behavior,
    };
  }).filter((item) => item.counters.length || item.checksums.length);

  const correlationSignals = [...idProfiles.entries()].flatMap(([id, profile]) => profile.byteSeries.map((series, byte_index) => ({ key: `${id}:byte${byte_index}`, id, byte_index, series })));
  const topCorrelatedPairs = correlationSignals.flatMap((left, leftIndex) => correlationSignals.slice(leftIndex + 1).map((right) => ({ left: left.key, right: right.key, correlation: pearson(left.series, right.series), relationship: "byte_value_correlation" })))
    .filter((item) => Math.abs(item.correlation) >= 0.72)
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, 24);

  const ecuClusters = idDeepDive.map((item) => {
    const timingMatch = timing.filter((row) => Math.abs(Number(row.average_period) - Number(item.average_period)) < 0.002).map((row) => row.id).filter((id) => id !== item.id).slice(0, 8);
    const structureMatch = idDeepDive.filter((row) => row.id !== item.id && JSON.stringify(row.payload_lengths) === JSON.stringify(item.payload_lengths)).map((row) => row.id).slice(0, 8);
    const ids = [...new Set([item.id, ...timingMatch, ...structureMatch])];
    return { cluster_id: `cluster_${item.id}`, ids, confidence: Number(Math.min(0.95, 0.35 + timingMatch.length * 0.08 + structureMatch.length * 0.06).toFixed(3)), behavior: `IDs share ${timingMatch.length ? "timing" : "limited timing"} and ${structureMatch.length ? "payload length" : "limited payload"} similarity; likely related ECU/status group.` };
  }).filter((cluster) => cluster.ids.length > 1).slice(0, 16);

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
      network_health: networkHealth,
      driver_behavior: driverBehavior,
      event_timeline: eventTimeline,
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
