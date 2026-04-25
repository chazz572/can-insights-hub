import { supabase } from "@/integrations/supabase/client";
import type { AnalysisResult } from "@/lib/canApi";

const generateToken = () => {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
};

export interface ShareCreateInput {
  fileId?: string;
  result: AnalysisResult;
  title?: string;
  expiresInDays?: number | null;
}

export interface ShareCreateResult {
  token: string;
  url: string;
  expiresAt: string | null;
}

export const createShareLink = async ({ fileId, result, title, expiresInDays }: ShareCreateInput): Promise<ShareCreateResult> => {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Sign in required to create a share link.");
  }

  const token = generateToken();
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : null;

  const { error } = await supabase.from("shared_analyses").insert([{
    user_id: userData.user.id,
    share_token: token,
    file_id: fileId ?? null,
    title: title ?? null,
    result_snapshot: result as unknown as Record<string, unknown>,
    expires_at: expiresAt,
  }]);

  if (error) throw new Error(error.message || "Failed to create share link.");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/#/shared/${token}`;
  return { token, url, expiresAt };
};

export interface SharedSnapshot {
  token: string;
  title: string | null;
  fileId: string | null;
  result: AnalysisResult;
  createdAt: string;
  expiresAt: string | null;
}

export const fetchSharedAnalysis = async (token: string): Promise<SharedSnapshot> => {
  const { data, error } = await supabase
    .from("shared_analyses")
    .select("share_token,title,file_id,result_snapshot,created_at,expires_at,revoked_at")
    .eq("share_token", token)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load shared analysis.");
  if (!data) throw new Error("This share link is invalid or no longer available.");
  if (data.revoked_at) throw new Error("This share link has been revoked.");
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("This share link has expired.");
  }

  return {
    token: data.share_token,
    title: data.title,
    fileId: data.file_id,
    result: data.result_snapshot as unknown as AnalysisResult,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
};
