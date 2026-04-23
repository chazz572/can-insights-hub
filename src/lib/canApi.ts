import { supabase } from "@/integrations/supabase/client";

export type JsonRecord = Record<string, unknown>;

export interface AnalysisResult {
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

  const { data: payload, error } = await supabase.functions.invoke<{ file_id?: string; files?: UploadResult[]; error?: string }>("upload", {
    body: formData,
  });

  if (error) throw new Error(error.message || "Upload request failed.");
  if (payload?.error && !payload.files?.length) throw new Error(payload.error);
  if (!payload?.files?.length) throw new Error("Upload returned no converted files.");
  return { file_id: payload.file_id, files: payload.files };
};

export const analyzeFile = async (fileId: string): Promise<AnalysisResult> => {
  const { data, error } = await supabase.functions.invoke<AnalysisResult>("analyze", {
    body: { file_id: fileId },
  });

  if (error) {
    throw new Error(error.message || "Analysis request failed.");
  }

  if (!data) {
    throw new Error("Analysis request returned no data.");
  }

  return data;
};

export const checkBackendHealth = async (): Promise<void> => {
  return Promise.resolve();
};
