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

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const uploadCsv = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const { data: payload, error } = await supabase.functions.invoke<{ file_id?: string; filename?: string }>("upload", {
    body: formData,
  });

  if (error) {
    throw new Error(error.message || "Upload request failed.");
  }

  if (!payload?.file_id) {
    throw new Error("Upload succeeded, but no file_id was returned.");
  }

  return payload.file_id;
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