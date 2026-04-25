import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "@/lib/canApi";

const generateToken = () => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export interface ShareCreateInput {
  fileId?: string;
  result: AnalysisResult;
  title?: string;
  expiresInDays?: number | null;
}

export interface SharedAnalysisRecord {
  share_token: string;
  title: string | null;
  file_id: string | null;
  result_snapshot: AnalysisResult;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export const createShareLink = async ({ fileId, result, title, expiresInDays }: ShareCreateInput) => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Sign in to create a share link.");

  const token = generateToken();
  const expires_at = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null;

  const { error } = await supabase.from("shared_analyses" as never).insert({
    share_token: token,
    user_id: userData.user.id,
    file_id: fileId ?? null,
    title: title ?? `CAN Analysis ${new Date().toLocaleDateString()}`,
    result_snapshot: result as unknown as Record<string, unknown>,
    expires_at,
  } as never);

  if (error) throw new Error(error.message);

  const url = `${window.location.origin}${window.location.pathname}#/shared/${token}`;
  return { token, url, expires_at };
};

export const fetchSharedAnalysis = async (token: string): Promise<SharedAnalysisRecord> => {
  const { data, error } = await supabase
    .from("shared_analyses" as never)
    .select("share_token, title, file_id, result_snapshot, expires_at, revoked_at, created_at" as never)
    .eq("share_token" as never, token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("This share link is invalid, expired, or has been revoked.");
  return data as unknown as SharedAnalysisRecord;
};
