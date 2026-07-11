-- Super Admin: 이메일 하드코딩 → users.is_super_admin 플래그 기반으로 전환
-- 클라이언트(AdminHeader/SuperAdminPage)와 서버 RPC가 동일한 기준(is_super_admin)을 사용한다.

-- 1. 플래그 컬럼 추가
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. 기존 슈퍼관리자 계정 시드 (이메일 기준 1회성). 이후 슈퍼관리자 지정은 이 컬럼을 직접 갱신.
UPDATE public.users SET is_super_admin = true WHERE email = 'junominu@gmail.com';

-- 3. 현재 사용자가 슈퍼관리자인지 확인하는 헬퍼 (RLS 우회 위해 SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.users WHERE id = auth.uid()), false);
$$;

-- 4. 기존 RPC 3종의 권한 체크를 이메일 → is_super_admin() 으로 교체

CREATE OR REPLACE FUNCTION admin_get_all_agents()
RETURNS TABLE (
  agent_id UUID,
  user_id UUID,
  email TEXT,
  display_name TEXT,
  office_name TEXT,
  representative TEXT,
  slug TEXT,
  subscription_plan TEXT,
  is_verified BOOLEAN,
  created_at TIMESTAMPTZ,
  property_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access only';
  END IF;

  RETURN QUERY
  SELECT
    ap.id AS agent_id,
    ap.user_id,
    u.email::TEXT,
    u.display_name::TEXT,
    ap.office_name::TEXT,
    ap.representative::TEXT,
    ap.slug::TEXT,
    ap.subscription_plan::TEXT,
    ap.is_verified,
    ap.created_at,
    COALESCE(pc.cnt, 0) AS property_count
  FROM agent_profiles ap
  JOIN users u ON u.id = ap.user_id
  LEFT JOIN (
    SELECT agent_id AS aid, COUNT(*) AS cnt
    FROM properties
    GROUP BY agent_id
  ) pc ON pc.aid = ap.id
  ORDER BY ap.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_update_agent_plan(
  target_agent_id UUID,
  new_plan TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access only';
  END IF;

  IF new_plan NOT IN ('free', 'basic', 'pro') THEN
    RAISE EXCEPTION 'Invalid plan: must be free, basic, or pro';
  END IF;

  UPDATE agent_profiles
  SET subscription_plan = new_plan
  WHERE id = target_agent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_verify_agent(
  target_agent_id UUID,
  verified BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access only';
  END IF;

  UPDATE agent_profiles
  SET is_verified = verified
  WHERE id = target_agent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent not found';
  END IF;
END;
$$;
