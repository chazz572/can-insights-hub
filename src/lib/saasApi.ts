import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "@/lib/canApi";

type AnyRow = Record<string, unknown>;

export type AiInsightKind = "mechanic" | "reverse" | "repair" | "signal" | "decoder";

export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
};

export const saveAnalysisSnapshot = async ({ fileId, result, title }: { fileId: string; result: AnalysisResult; title?: string }) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to save analyses.");

  const anomalies = Array.isArray(result.anomalies) ? result.anomalies.length : 0;
  const healthScore = Math.max(0, Math.min(100, 100 - anomalies * 12));

  const { error } = await supabase.from("saved_analyses" as never).insert({
    user_id: user.id,
    file_id: fileId,
    title: title || `CAN Analysis ${new Date().toLocaleDateString()}`,
    result_snapshot: result as unknown as AnyRow,
    health_score: healthScore,
    tags: ["CAN", anomalies ? "anomaly-review" : "healthy"],
  } as never);

  if (error) throw new Error(error.message);
};

export const loadSavedAnalyses = async () => {
  const { data, error } = await supabase
    .from("saved_analyses" as never)
    .select("*" as never)
    .order("created_at" as never, { ascending: false })
    .limit(24);

  if (error) throw new Error(error.message);
  return (data ?? []) as AnyRow[];
};

export const loadFleetVehicles = async () => {
  const { data, error } = await supabase
    .from("fleet_vehicles" as never)
    .select("*" as never)
    .order("created_at" as never, { ascending: false })
    .limit(24);

  if (error) throw new Error(error.message);
  return (data ?? []) as AnyRow[];
};

export const createFleetVehicle = async (vehicleName: string) => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to add vehicles.");

  const { error } = await supabase.from("fleet_vehicles" as never).insert({
    user_id: user.id,
    vehicle_name: vehicleName.trim(),
    status: "monitoring",
    health_score: 92,
  } as never);

  if (error) throw new Error(error.message);
};

export const requestAiInsight = async ({ kind, analysis }: { kind: AiInsightKind; analysis: AnalysisResult }) => {
  const { data, error } = await supabase.functions.invoke<{ insight?: string; error?: string }>("ai-diagnostics", {
    body: { kind, analysis },
  });

  if (error) throw new Error(error.message || "AI insight request failed.");
  if (data?.error) throw new Error(data.error);
  return data?.insight ?? "No insight returned.";
};
