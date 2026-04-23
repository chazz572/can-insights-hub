import { supabase } from "@/integrations/supabase/client";

export type JsonRecord = Record<string, unknown>;

export interface AnalysisResult {
  file_type?: "log" | "dbc" | "log_dbc" | "batch" | "unsupported" | string;
  analysis_pipeline?: string;
  supported_file_type?: boolean;
  summary?: string | { text?: string; [key: string]: unknown };
  total_messages?: number;
  unique_ids?: number;
  id_stats?: JsonRecord[];
  anomalies?: JsonRecord[];
  reverse_engineering?: JsonRecord[];
  vehicle_behavior?: {
    possible_speed_ids?: unknown[];
    possible_rpm_ids?: unknown[];
    possible_pedal_ids?: unknown[];
    [key: string]: unknown;
  };
  diagnostics?: {
    protocol?: unknown;
    byte_analysis?: unknown;
    bit_analysis?: unknown;
    timing?: unknown;
    signals?: unknown;
    systems?: unknown;
    mechanic_summary?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface UploadResult {
  file_id?: string;
  filename: string;
  detected_format?: string;
  file_type?: string;
  analysis_pipeline?: string;
  frame_count?: number;
  warnings?: string[];
  error?: string;
}

export const uploadCsv = async (file: File): Promise<string> => {
  const payload = await uploadCanFiles([file]);
  const first = payload.files.find((item) => item.file_id);
  if (!first?.file_id) throw new Error("Upload succeeded, but no file_id was returned.");
  return first.file_id;
};

export const uploadCanFiles = async (files: File[]): Promise<{ file_id?: string; files: UploadResult[] }> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const { data: payload, error } = await supabase.functions.invoke<{ ok?: boolean; file_id?: string; files?: UploadResult[]; error?: string }>("upload", {
    body: formData,
  });

  if (error) throw new Error(error.message || "Upload request failed.");
  if (payload?.ok === false || payload?.error) {
    const fileErrors = payload.files?.map((item) => item.error).filter(Boolean).join(" ");
    throw new Error(fileErrors || payload.error || "No files could be converted.");
  }
  if (!payload?.files?.length) throw new Error("Upload returned no converted files.");
  return { file_id: payload.file_id, files: payload.files };
};

export const analyzeFile = async (fileId: string): Promise<AnalysisResult> => {
  const { data, error } = await supabase.functions.invoke<AnalysisResult & { ok?: boolean; error?: string }>("analyze", {
    body: { file_id: fileId },
  });

  if (error) {
    throw new Error(error.message || "Analysis request failed.");
  }

  if (data?.ok === false || data?.error) {
    throw new Error(data.error || "Analysis request failed.");
  }

  if (!data) {
    throw new Error("Analysis request returned no data.");
  }

  return data;
};

export const checkBackendHealth = async (): Promise<void> => {
  return Promise.resolve();
};
