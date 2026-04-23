const API_BASE_URL = "http://127.0.0.1:8000/api";

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

  const payload = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  }).then((response) => parseJsonResponse<{ file_id?: string; filename?: string }>(response));

  if (!payload.file_id) {
    throw new Error("Upload succeeded, but no file_id was returned.");
  }

  return payload.file_id;
};

export const analyzeFile = async (fileId: string): Promise<AnalysisResult> => {
  return fetch(`${API_BASE_URL}/analyze/${fileId}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  }).then((response) => parseJsonResponse<AnalysisResult>(response));
};

export const checkBackendHealth = async (): Promise<void> => {
  const payload = await fetch(`${API_BASE_URL}/health`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  }).then((response) => parseJsonResponse<{ status?: string }>(response));

  if (payload.status !== "ok") {
    throw new Error("Backend health check failed.");
  }
};