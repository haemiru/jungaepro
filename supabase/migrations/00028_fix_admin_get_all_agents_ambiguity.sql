-- admin_get_all_agents(): "column reference agent_id is ambiguous" 수정
-- 원인: RETURNS TABLE의 출력 컬럼 agent_id(PL/pgSQL 변수)와
--       서브쿼리의 properties.agent_id 컬럼이 충돌.
-- 해결: 서브쿼리에서 컬럼을 properties.agent_id 로 명시.
-- (00025부터 존재한 버그. 00027은 본문을 그대로 보존했으므로 여기서 최종 수정.)

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
    SELECT properties.agent_id AS aid, COUNT(*) AS cnt
    FROM properties
    GROUP BY properties.agent_id
  ) pc ON pc.aid = ap.id
  ORDER BY ap.created_at DESC;
END;
$$;
