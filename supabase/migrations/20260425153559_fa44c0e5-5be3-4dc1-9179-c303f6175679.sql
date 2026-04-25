CREATE TABLE public.shared_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  file_id uuid,
  title text,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_analyses ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own share links
CREATE POLICY "Users can create share links"
  ON public.shared_analyses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own share links"
  ON public.shared_analyses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own share links"
  ON public.shared_analyses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own share links"
  ON public.shared_analyses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Public read for active (non-revoked, non-expired) share links
CREATE POLICY "Public can read active shares"
  ON public.shared_analyses FOR SELECT TO anon, authenticated
  USING (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE INDEX idx_shared_analyses_token ON public.shared_analyses(share_token);
CREATE INDEX idx_shared_analyses_user ON public.shared_analyses(user_id);