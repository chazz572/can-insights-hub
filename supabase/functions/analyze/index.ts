import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CsvRow = Record<string, string>;
type JsonRecord = Record<string, unknown>;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
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

const parseCsv = (csv: string): CsvRow[] => {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
};

const normalizeRows = (rows: CsvRow[]) => {
  if (!rows.length) return rows;
  const columns = Object.keys(rows[0]);
  const idColumn = columns.find((column) => column === "id")
    ?? columns.find((column) => column.toLowerCase() === "id")
    ?? columns.find((column) => ["can_id", "arbitration_id", "identifier", "message_id"].includes(column.toLowerCase()))
    ?? "ID";

  return rows.map((row) => ({ ...row, id: row[idColumn] ?? row.ID ?? row.id ?? "" }));
};

const dataValue = (row: CsvRow) => row.Data ?? row.data ?? row.DATA ?? row.payload ?? row.Payload ?? "";
const timestampValue = (row: CsvRow) => Number(row.Timestamp ?? row.timestamp ?? row.Time ?? row.time ?? row.ts ?? Number.NaN);
const cleanHex = (value: string) => value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
const byteValues = (value: string) => cleanHex(value).match(/.{1,2}/g)?.slice(0, 8).map((byte) => Number.parseInt(byte, 16)).filter((byte) => Number.isFinite(byte)) ?? [];

const entropy = (values: number[]) => {
  if (!values.length) return 0;
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Number([...counts.values()].reduce((sum, count) => {
    const probability = count / values.length;
    return sum - probability * Math.log2(probability);
  }, 0).toFixed(4));
};

const summaryView = (rows: CsvRow[], anomalies: JsonRecord[], reverseEngineering: JsonRecord[]) => ({
  text: `Parsed ${rows.length} messages across ${new Set(rows.map((row) => row.id)).size} unique IDs. Detected ${anomalies.length} anomalies and ${reverseEngineering.length} reverse-engineering candidates.`,
});

const basicView = (rows: CsvRow[]) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(row.id, (counts.get(row.id) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({ id, count, percentage: rows.length ? Number(((count / rows.length) * 100).toFixed(2)) : 0 }));
};

const anomaliesView = (rows: CsvRow[]) => {
  const lengths = rows.map((row) => dataValue(row).length);
  const mean = lengths.reduce((sum, value) => sum + value, 0) / (lengths.length || 1);
  const variance = lengths.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (lengths.length || 1);
  const threshold = mean + 3 * Math.sqrt(variance);

  return rows
    .filter((row) => dataValue(row).length > threshold)
    .map((row) => ({ id: row.id, data: dataValue(row), reason: "Unusually long data payload" }));
};

const reverseEngineeringView = (idStats: JsonRecord[]) =>
  idStats.map((item, index) => ({
    id: item.id,
    count: item.count,
    cluster: index % 3,
    candidate_signal: Number(item.count ?? 0) > 1,
  }));

const vehicleBehaviorView = (rows: CsvRow[]) => {
  const ids = [...new Set(rows.map((row) => row.id))];
  return {
    possible_speed_ids: ids.filter((id) => rows.some((row) => row.id === id && dataValue(row).length === 2)),
    possible_rpm_ids: ids.filter((id) => rows.some((row) => row.id === id && dataValue(row).length === 4)),
    possible_pedal_ids: ids.filter((id) => rows.some((row) => row.id === id && dataValue(row).length === 1)),
  };
};

const detectProtocol = (rows: CsvRow[]) => {
  const ids = rows.map((row) => cleanHex(row.id));
  const extended = ids.filter((id) => id.length > 3).length;
  return {
    likely_protocol: extended > rows.length / 2 ? "CAN 2.0B / extended identifiers" : "CAN 2.0A / standard identifiers",
    total_ids_sampled: ids.length,
    extended_id_ratio: ids.length ? Number((extended / ids.length).toFixed(4)) : 0,
  };
};

const analyzeBytes = (rows: CsvRow[]) => Array.from({ length: 8 }, (_, byteIndex) => {
  const values = rows.map((row) => byteValues(dataValue(row))[byteIndex]).filter((value): value is number => typeof value === "number");
  const counts = new Map<number, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    byte_index: byteIndex,
    observed_count: values.length,
    unique_values: counts.size,
    entropy: entropy(values),
    dominant_value: dominant === undefined ? null : dominant,
  };
});

const analyzeBits = (rows: CsvRow[]) => Array.from({ length: 64 }, (_, bit) => {
  const byteIndex = Math.floor(bit / 8);
  const bitIndex = 7 - (bit % 8);
  const values = rows.map((row) => byteValues(dataValue(row))[byteIndex]).filter((value): value is number => typeof value === "number").map((byte) => (byte >> bitIndex) & 1);
  const ones = values.filter((value) => value === 1).length;
  const transitions = values.slice(1).filter((value, index) => value !== values[index]).length;
  return {
    bit,
    byte_index: byteIndex,
    bit_index: bitIndex,
    ones,
    zeros: values.length - ones,
    transitions,
    activity: values.length ? Number((transitions / values.length).toFixed(4)) : 0,
  };
});

const analyzeTiming = (rows: CsvRow[]) => {
  const byId = new Map<string, number[]>();
  rows.forEach((row) => {
    const timestamp = timestampValue(row);
    if (!Number.isFinite(timestamp)) return;
    byId.set(row.id, [...(byId.get(row.id) ?? []), timestamp]);
  });

  return [...byId.entries()].map(([id, timestamps]) => {
    const sorted = timestamps.sort((a, b) => a - b);
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
};

const extractSignals = (byteAnalysis: JsonRecord[], bitAnalysis: JsonRecord[]) => ({
  byte_signal_candidates: byteAnalysis.filter((item) => Number(item.entropy ?? 0) > 0.5),
  active_bit_candidates: bitAnalysis.filter((item) => Number(item.activity ?? 0) > 0.05),
});

const classifySystems = (rows: CsvRow[]) => [...new Set(rows.map((row) => row.id))].map((id) => {
  const numeric = Number.parseInt(cleanHex(id), 16);
  const category = Number.isFinite(numeric) && numeric >= 0x18F00000 ? "powertrain_or_diagnostic" : Number.isFinite(numeric) && numeric >= 0x700 ? "diagnostic" : "body_or_chassis";
  return { id, category, confidence: "heuristic" };
});

const mechanicSummary = (rows: CsvRow[], anomalies: JsonRecord[], vehicleBehavior: JsonRecord) =>
  `Capture contains ${rows.length} CAN messages. ${anomalies.length} anomalous payloads were detected. Candidate speed IDs: ${(vehicleBehavior.possible_speed_ids as unknown[]).join(", ") || "none"}. Candidate RPM IDs: ${(vehicleBehavior.possible_rpm_ids as unknown[]).join(", ") || "none"}.`;

const runAnalysis = (csv: string) => {
  const rows = normalizeRows(parseCsv(csv));
  const idStats = basicView(rows);
  const anomalies = anomaliesView(rows);
  const reverseEngineering = reverseEngineeringView(idStats);
  const vehicleBehavior = vehicleBehaviorView(rows);
  const byteAnalysis = analyzeBytes(rows);
  const bitAnalysis = analyzeBits(rows);
  const timing = analyzeTiming(rows);
  const systems = classifySystems(rows);

  return {
    summary: summaryView(rows, anomalies, reverseEngineering),
    total_messages: rows.length,
    unique_ids: new Set(rows.map((row) => row.id)).size,
    id_stats: idStats,
    anomalies,
    reverse_engineering: reverseEngineering,
    vehicle_behavior: vehicleBehavior,
    diagnostics: {
      protocol: detectProtocol(rows),
      byte_analysis: byteAnalysis,
      bit_analysis: bitAnalysis,
      timing,
      signals: extractSignals(byteAnalysis, bitAnalysis),
      systems,
      mechanic_summary: mechanicSummary(rows, anomalies, vehicleBehavior),
    },
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const fileId = typeof body?.file_id === "string" ? body.file_id : "";
    if (!/^[0-9a-fA-F-]{36}$/.test(fileId)) return jsonResponse({ error: "Valid file_id is required" }, 400);

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
    if (!metadata?.storage_path) return jsonResponse({ error: "File not found" }, 404);

    const { data: file, error: downloadError } = await supabase.storage
      .from("can-csv-uploads")
      .download(metadata.storage_path);

    if (downloadError) throw new Error(`Storage download failed: ${downloadError.message}`);

    return jsonResponse(runAnalysis(await file.text()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return jsonResponse({ error: message }, 500);
  }
});
