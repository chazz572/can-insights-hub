CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  company_name text,
  role_title text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_tier text NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'enterprise')),
  billing_status text NOT NULL DEFAULT 'trialing' CHECK (billing_status IN ('trialing', 'active', 'past_due', 'canceled')),
  seat_limit integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_role text NOT NULL DEFAULT 'member' CHECK (member_role IN ('owner', 'admin', 'engineer', 'viewer', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE TABLE public.saved_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  file_id uuid NOT NULL,
  title text NOT NULL,
  vehicle_label text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text,
  result_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  health_score integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.saved_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  title text NOT NULL,
  baseline_file_id uuid,
  comparison_file_id uuid,
  comparison_type text NOT NULL DEFAULT 'before_after' CHECK (comparison_type IN ('before_after', 'golden_file', 'side_by_side')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  vehicle_name text NOT NULL,
  vin text,
  make text,
  model text,
  model_year integer,
  mileage integer,
  health_score integer NOT NULL DEFAULT 100,
  last_analysis_id uuid REFERENCES public.saved_analyses(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'monitoring' CHECK (status IN ('healthy', 'monitoring', 'maintenance_due', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY['analysis:read']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND member_role IN ('owner', 'admin')
  )
$$;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team members can view teams" ON public.teams FOR SELECT TO authenticated USING (public.is_team_member(id, auth.uid()));
CREATE POLICY "Authenticated users can create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team admins can update teams" ON public.teams FOR UPDATE TO authenticated USING (public.is_team_admin(id, auth.uid())) WITH CHECK (public.is_team_admin(id, auth.uid()));

CREATE POLICY "Team members can view memberships" ON public.team_members FOR SELECT TO authenticated USING (public.is_team_member(team_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Users can create their own team membership" ON public.team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_team_admin(team_id, auth.uid()));
CREATE POLICY "Team admins can update memberships" ON public.team_members FOR UPDATE TO authenticated USING (public.is_team_admin(team_id, auth.uid())) WITH CHECK (public.is_team_admin(team_id, auth.uid()));
CREATE POLICY "Team admins can remove memberships" ON public.team_members FOR DELETE TO authenticated USING (public.is_team_admin(team_id, auth.uid()));

CREATE POLICY "Users can view saved analyses" ON public.saved_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users can create saved analyses" ON public.saved_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users can update saved analyses" ON public.saved_analyses FOR UPDATE TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid()))) WITH CHECK (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid())));
CREATE POLICY "Users can delete saved analyses" ON public.saved_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid())));

CREATE POLICY "Users can view saved comparisons" ON public.saved_comparisons FOR SELECT TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users can create saved comparisons" ON public.saved_comparisons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users can update saved comparisons" ON public.saved_comparisons FOR UPDATE TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid()))) WITH CHECK (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid())));
CREATE POLICY "Users can delete saved comparisons" ON public.saved_comparisons FOR DELETE TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid())));

CREATE POLICY "Users can view fleet vehicles" ON public.fleet_vehicles FOR SELECT TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users can create fleet vehicles" ON public.fleet_vehicles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_member(team_id, auth.uid())));
CREATE POLICY "Users can update fleet vehicles" ON public.fleet_vehicles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid()))) WITH CHECK (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid())));
CREATE POLICY "Users can delete fleet vehicles" ON public.fleet_vehicles FOR DELETE TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid())));

CREATE POLICY "Users can view api keys" ON public.api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid())));
CREATE POLICY "Users can create api keys" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_admin(team_id, auth.uid())));
CREATE POLICY "Users can update api keys" ON public.api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid()))) WITH CHECK (auth.uid() = user_id OR (team_id IS NOT NULL AND public.is_team_admin(team_id, auth.uid())));

CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_saved_analyses_user_id ON public.saved_analyses(user_id);
CREATE INDEX idx_saved_analyses_team_id ON public.saved_analyses(team_id);
CREATE INDEX idx_fleet_vehicles_team_id ON public.fleet_vehicles(team_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_saved_analyses_updated_at BEFORE UPDATE ON public.saved_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_saved_comparisons_updated_at BEFORE UPDATE ON public.saved_comparisons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fleet_vehicles_updated_at BEFORE UPDATE ON public.fleet_vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_team_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));

  INSERT INTO public.teams (name, created_by)
  VALUES (COALESCE(NEW.raw_user_meta_data ->> 'company_name', 'Personal Workspace'), NEW.id)
  RETURNING id INTO new_team_id;

  INSERT INTO public.team_members (team_id, user_id, member_role)
  VALUES (new_team_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();