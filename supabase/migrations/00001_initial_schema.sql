-- ============================================
-- Jungaepro: 공인중개사 올인원 업무 플랫폼
-- Initial Schema Migration
-- ============================================

-- Custom enum types
CREATE TYPE public.user_role AS ENUM ('customer', 'agent', 'staff');
CREATE TYPE public.staff_role AS ENUM ('lead_agent', 'associate_agent', 'assistant');

-- ============================================
-- updated_at trigger function (used by multiple tables)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 1. users 테이블
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role public.user_role NOT NULL DEFAULT 'customer',
  display_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. agent_profiles 테이블
-- ============================================
CREATE TABLE public.agent_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  office_name TEXT NOT NULL,
  representative TEXT NOT NULL,
  business_number TEXT NOT NULL,
  license_number TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  fax TEXT,
  business_hours JSONB,
  logo_url TEXT,
  description TEXT,
  specialties TEXT[],
  insurance_info JSONB,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. staff_members 테이블
-- ============================================
CREATE TABLE public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_profile_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.staff_role NOT NULL DEFAULT 'assistant',
  permissions JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_profile_id, user_id)
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. agent_feature_settings 테이블
-- ============================================
CREATE TABLE public.agent_feature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  settings_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, feature_key)
);

ALTER TABLE public.agent_feature_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies (after all tables created)
-- ============================================

-- users policies
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users_select_office_members"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_members sm
      JOIN public.agent_profiles ap ON ap.id = sm.agent_profile_id
      WHERE sm.user_id = auth.uid()
        AND (ap.user_id = public.users.id
             OR EXISTS (
               SELECT 1 FROM public.staff_members sm2
               WHERE sm2.agent_profile_id = sm.agent_profile_id
                 AND sm2.user_id = public.users.id
             ))
    )
  );

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- agent_profiles policies
CREATE POLICY "agent_profiles_select_authenticated"
  ON public.agent_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "agent_profiles_insert_own"
  ON public.agent_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_profiles_update_own"
  ON public.agent_profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- staff_members policies
CREATE POLICY "staff_members_select_office"
  ON public.staff_members FOR SELECT
  USING (
    agent_profile_id IN (
      SELECT ap.id FROM public.agent_profiles ap WHERE ap.user_id = auth.uid()
      UNION
      SELECT sm.agent_profile_id FROM public.staff_members sm WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "staff_members_insert_owner"
  ON public.staff_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_profiles ap
      WHERE ap.id = agent_profile_id AND ap.user_id = auth.uid()
    )
  );

CREATE POLICY "staff_members_update_owner"
  ON public.staff_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_profiles ap
      WHERE ap.id = agent_profile_id AND ap.user_id = auth.uid()
    )
  );

CREATE POLICY "staff_members_delete_owner"
  ON public.staff_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.agent_profiles ap
      WHERE ap.id = agent_profile_id AND ap.user_id = auth.uid()
    )
  );

-- agent_feature_settings policies
CREATE POLICY "feature_settings_select_office"
  ON public.agent_feature_settings FOR SELECT
  USING (
    agent_id IN (
      SELECT ap.id FROM public.agent_profiles ap WHERE ap.user_id = auth.uid()
      UNION
      SELECT sm.agent_profile_id FROM public.staff_members sm WHERE sm.user_id = auth.uid()
    )
  );

CREATE POLICY "feature_settings_insert_owner"
  ON public.agent_feature_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agent_profiles ap
      WHERE ap.id = agent_id AND ap.user_id = auth.uid()
    )
  );

CREATE POLICY "feature_settings_update_owner"
  ON public.agent_feature_settings FOR UPDATE
  USING (
    NOT is_locked
    AND EXISTS (
      SELECT 1 FROM public.agent_profiles ap
      WHERE ap.id = agent_id AND ap.user_id = auth.uid()
    )
  );

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_agent_profiles_user_id ON public.agent_profiles(user_id);
CREATE INDEX idx_agent_profiles_is_verified ON public.agent_profiles(is_verified);
CREATE INDEX idx_staff_members_agent_profile_id ON public.staff_members(agent_profile_id);
CREATE INDEX idx_staff_members_user_id ON public.staff_members(user_id);
CREATE INDEX idx_feature_settings_agent_id ON public.agent_feature_settings(agent_id);

-- ============================================
-- Trigger
-- ============================================
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.agent_feature_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
