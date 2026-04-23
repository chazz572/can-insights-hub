import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CanFormat = "CSV" | "J1939 CSV" | "candump" | "CRTD" | "ASC" | "BLF" | "MDF/MF4" | "CANedge" | "key/value" | "generic TXT";
type Frame = { timestamp: string; id: string; dlc: number; data: string[] };
type ConversionResult = { format: CanFormat; csv: string; frameCount: number; warnings: string[] };

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanId = (value: string) => value.replace(/^0x/i, "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
const cleanByte = (value: string) => value.replace(/^0x/i, "").replace(/[^a-fA-F0-9]/g, "").slice(0, 2).padStart(2, "0").toUpperCase();
const isId = (value: string) => /^[0-9a-fA-F]{1,8}x?$/.test(value.replace(/^0x/i, ""));
const isByte = (value: string) => /^(0x)?[0-9a-fA-F]{1,2}$/.test(value);
const splitBytes = (value: string) => value.replace(/[^a-fA-F0-9]/g, "").match(/.{1,2}/g)?.slice(0, 8).map(cleanByte) ?? [];
const csvEscape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

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
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
};

const toCsv = (frames: Frame[]) => ["timestamp,id,dlc,data", ...frames.map((frame) => [
  csvEscape(frame.timestamp),
  csvEscape(cleanId(frame.id)),
  frame.dlc,
  csvEscape(frame.data.map(cleanByte).join(" ")),
].join(","))].join("\n");

const normalizeFrame = (timestamp: string, id: string, bytes: string[], dlc?: number): Frame | null => {
  const normalizedId = cleanId(id);
  const normalizedBytes = bytes.map(cleanByte).filter((byte) => /^[0-9A-F]{2}$/.test(byte)).slice(0, 8);
  if (!normalizedId || !normalizedBytes.length) return null;
  return { timestamp: timestamp || "0", id: normalizedId, dlc: Math.min(Number.isFinite(Number(dlc)) ? Number(dlc) : normalizedBytes.length, 8), data: normalizedBytes };
};

const detectFormat = (name: string, bytes: Uint8Array, text: string): CanFormat => {
  const lower = name.toLowerCase();
  const firstLines = text.split(/\r?\n/).slice(0, 25).join("\n");
  const signature = new TextDecoder().decode(bytes.slice(0, 8));
  if (signature.startsWith("LOGG") || lower.endsWith(".blf")) return "BLF";
  if (signature.startsWith("MDF") || lower.endsWith(".mf4") || lower.endsWith(".mdf")) return "MDF/MF4";
  if (lower.endsWith(".asc") || /date\s+.*base\s+hex|internal events logged|begin triggerblock/i.test(firstLines)) return "ASC";
  if (lower.endsWith(".crtd") || /^\s*\d+(?:\.\d+)?\s+[0-9a-fA-F]{3,8}\s+\d\s+/m.test(text)) return "CRTD";
  if (/\(\d+\.\d+\)\s+\w+\s+[0-9a-fA-F]+#|\w+\s+[0-9a-fA-F]+\s+\[\d\]/m.test(text) || lower.endsWith(".log")) return "candump";
  if (/pgn|source|destination|priority|j1939/i.test(firstLines) && lower.endsWith(".csv")) return "J1939 CSV";
  if (lower.endsWith(".csv")) return "CSV";
  if (/\b(timestamp|time|id|can_id|arbitration_id|data|payload)\s*[:=]/i.test(firstLines)) return "key/value";
  if (/canedge|\.jsonl|channel.*can/i.test(firstLines) || lower.includes("canedge")) return "CANedge";
  return "generic TXT";
};

const parseCsv = (text: string, warnings: string[], format: CanFormat): Frame[] => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());
  const find = (names: string[]) => normalizedHeaders.findIndex((header) => names.includes(header));
  const timestampIndex = find(["timestamp", "time", "ts", "date time", "datetime"]);
  const idIndex = find(["id", "can_id", "arbitration_id", "identifier", "message_id", "canid", "pgn"]);
  const dlcIndex = find(["dlc", "length", "len"]);
  const dataIndex = find(["data", "payload", "bytes", "data bytes"]);
  const byteIndexes = normalizedHeaders.map((header, index) => (/^(byte|data)[_ -]?[0-7]$|^b[0-7]$/.test(header) ? index : -1)).filter((index) => index >= 0);
  if (idIndex < 0) warnings.push("CSV header is missing a recognized CAN ID column; trying generic frame extraction.");
  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const bytes = dataIndex >= 0 ? splitBytes(values[dataIndex] ?? "") : byteIndexes.map((byteIndex) => values[byteIndex]).filter(Boolean);
    return normalizeFrame(timestampIndex >= 0 ? values[timestampIndex] : String(index), idIndex >= 0 ? values[idIndex] : "", bytes, dlcIndex >= 0 ? Number(values[dlcIndex]) : undefined);
  }).filter((frame): frame is Frame => Boolean(frame)).map((frame) => format === "J1939 CSV" ? { ...frame, id: cleanId(frame.id) } : frame);
};

const parseCandump = (text: string) => text.split(/\r?\n/).map((line, index) => {
  const trimmed = line.trim();
  const hash = trimmed.match(/^\(?([\d.]+)\)?\s+\S+\s+([0-9a-fA-F]+)#([0-9a-fA-F]*)/);
  if (hash) return normalizeFrame(hash[1], hash[2], splitBytes(hash[3]));
  const bracket = trimmed.match(/^\(?([\d.]+)\)?\s+\S+\s+([0-9a-fA-F]+)\s+\[(\d+)\]\s+(.+)$/);
  if (bracket) return normalizeFrame(bracket[1], bracket[2], bracket[4].split(/\s+/).filter(isByte), Number(bracket[3]));
  const noTimestamp = trimmed.match(/^\S+\s+([0-9a-fA-F]+)#([0-9a-fA-F]*)/);
  return noTimestamp ? normalizeFrame(String(index), noTimestamp[1], splitBytes(noTimestamp[2])) : null;
}).filter((frame): frame is Frame => Boolean(frame));

const parseCrtd = (text: string) => text.split(/\r?\n/).map((line, index) => {
  const parts = line.trim().split(/[\s,;]+/).filter(Boolean);
  if (parts.length < 4) return null;
  const idIndex = parts.findIndex(isId);
  if (idIndex < 0) return null;
  const timestamp = idIndex > 0 && /^\d+(\.\d+)?$/.test(parts[idIndex - 1]) ? parts[idIndex - 1] : String(index);
  const dlc = /^\d+$/.test(parts[idIndex + 1] ?? "") ? Number(parts[idIndex + 1]) : undefined;
  const byteStart = dlc === undefined ? idIndex + 1 : idIndex + 2;
  return normalizeFrame(timestamp, parts[idIndex].replace(/x$/i, ""), parts.slice(byteStart).filter(isByte), dlc);
}).filter((frame): frame is Frame => Boolean(frame));

const parseAsc = (text: string) => text.split(/\r?\n/).map((line) => {
  const parts = line.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 6 || !/^\d+(\.\d+)?$/.test(parts[0])) return null;
  const idIndex = parts.findIndex((part, index) => index > 0 && isId(part));
  if (idIndex < 0) return null;
  const dlcIndex = parts.findIndex((part, index) => index > idIndex && /^\d+$/.test(part) && Number(part) <= 64);
  if (dlcIndex < 0) return null;
  return normalizeFrame(parts[0], parts[idIndex].replace(/x$/i, ""), parts.slice(dlcIndex + 1).filter(isByte), Number(parts[dlcIndex]));
}).filter((frame): frame is Frame => Boolean(frame));

const parseKeyValue = (text: string) => text.split(/\r?\n/).map((line, index) => {
  const get = (keys: string[]) => keys.map((key) => line.match(new RegExp(`${key}\\s*[:=]\\s*([0-9a-fA-Fx .:-]+)`, "i"))?.[1]?.trim()).find(Boolean);
  const id = get(["id", "can_id", "arbitration_id", "pgn"]);
  const data = get(["data", "payload", "bytes"]);
  const timestamp = get(["timestamp", "time", "ts"]) ?? String(index);
  return id && data ? normalizeFrame(timestamp, id, splitBytes(data)) : null;
}).filter((frame): frame is Frame => Boolean(frame));

const parseGeneric = (text: string) => text.split(/\r?\n/).map((line, index) => {
  const tokens = line.trim().replace(/[#,;|]/g, " ").split(/\s+/).filter(Boolean);
  const idIndex = tokens.findIndex((token) => isId(token) && cleanId(token).length >= 2);
  if (idIndex < 0) return null;
  const timestamp = tokens.slice(0, idIndex).find((token) => /^\d+(\.\d+)?$/.test(token)) ?? String(index);
  return normalizeFrame(timestamp, tokens[idIndex], tokens.slice(idIndex + 1).filter(isByte));
}).filter((frame): frame is Frame => Boolean(frame));

const parseBinaryBestEffort = (bytes: Uint8Array, format: CanFormat, warnings: string[]) => {
  warnings.push(`${format} binary parsing is handled with best-effort embedded frame extraction in this Cloud runtime. Exporting to ASC/CSV from the logger gives the highest fidelity.`);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return [...parseCandump(text), ...parseAsc(text), ...parseGeneric(text)];
};

const convertFile = async (file: File): Promise<ConversionResult> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const warnings: string[] = [];
  const format = detectFormat(file.name, bytes, text);
  const frames = format === "CSV" || format === "J1939 CSV" ? parseCsv(text, warnings, format)
    : format === "candump" ? parseCandump(text)
    : format === "CRTD" ? parseCrtd(text)
    : format === "ASC" ? parseAsc(text)
    : format === "key/value" || format === "CANedge" ? [...parseKeyValue(text), ...parseGeneric(text)]
    : format === "BLF" || format === "MDF/MF4" ? parseBinaryBestEffort(bytes, format, warnings)
    : parseGeneric(text);

  const seen = new Set<string>();
  const deduped = frames.filter((frame) => {
    const key = `${frame.timestamp}|${frame.id}|${frame.data.join(" ")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!deduped.length) throw new Error(`No valid CAN frames found in ${file.name}. Try ASC, CSV, candump, CRTD, or a text export if this is a proprietary binary log.`);
  const malformed = text.split(/\r?\n/).filter((line) => line.trim()).length - deduped.length;
  if (malformed > 0 && format !== "CSV" && format !== "BLF" && format !== "MDF/MF4") warnings.push(`${malformed} line(s) were skipped because they did not look like valid CAN frames.`);
  return { format, csv: toCsv(deduped), frameCount: deduped.length, warnings };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  try {
    const formData = await req.formData();
    const files = [...formData.getAll("files"), formData.get("file")].filter((item): item is File => item instanceof File);
    if (!files.length) return jsonResponse({ ok: false, error: "At least one CAN log file is required" }, 400);
    if (files.length > 12) return jsonResponse({ ok: false, error: "Batch uploads are limited to 12 files at a time" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const results = [];

    for (const file of files) {
      try {
        const converted = await convertFile(file);
        const fileId = crypto.randomUUID();
        const storagePath = `${fileId}.csv`;
        const normalizedBytes = new TextEncoder().encode(converted.csv);
        const { error: uploadError } = await supabase.storage.from("can-csv-uploads").upload(storagePath, normalizedBytes, { contentType: "text/csv", upsert: false });
        if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);
        const { error: metadataError } = await supabase.from("can_uploads").insert({
          file_id: fileId,
          filename: file.name,
          storage_path: storagePath,
          content_type: "text/csv",
          file_size: normalizedBytes.byteLength,
        });
        if (metadataError) throw new Error(`Upload metadata save failed: ${metadataError.message}`);
        results.push({ file_id: fileId, filename: file.name, detected_format: converted.format, frame_count: converted.frameCount, warnings: converted.warnings });
      } catch (error) {
        results.push({ filename: file.name, error: error instanceof Error ? error.message : "Conversion failed" });
      }
    }

    const successful = results.filter((result) => "file_id" in result);
    if (!successful.length) return jsonResponse({ ok: false, error: "No files could be converted", files: results }, 400);
    return jsonResponse({ ok: true, ...successful[0], files: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});
