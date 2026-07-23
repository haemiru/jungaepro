-- 개공 ↔ 슈퍼관리자 문의 채널 (인앱 스레드)
-- - support_tickets: 문의 스레드 (개공 1명 ↔ 슈퍼관리자)
-- - support_ticket_messages: 스레드 내 메시지 (agent/admin)
-- 접근은 전부 SECURITY DEFINER RPC로 처리 (권한 경계: 개공은 자기 것만, 슈퍼관리자는 전부).
-- RLS는 직접 SELECT 방어용으로만 활성화, 쓰기는 RPC 경유.

-- ─── 테이블 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',   -- general/billing/bug/feature/account
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  last_sender TEXT NOT NULL DEFAULT 'agent' CHECK (last_sender IN ('agent', 'admin')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  agent_last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'admin')),
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_agent_id ON public.support_tickets(agent_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_last_message_at ON public.support_tickets(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);

-- ─── 메시지 삽입 시 부모 스레드 갱신 트리거 ──────────────
CREATE OR REPLACE FUNCTION public.touch_support_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.support_tickets
  SET last_message_at = NEW.created_at,
      last_sender = NEW.sender_type,
      -- 닫힌 스레드에 새 글이 달리면 다시 열림. agent 글이면 대기(open), admin 글이면 답변완료(answered)
      status = CASE WHEN NEW.sender_type = 'agent' THEN 'open' ELSE 'answered' END,
      -- 보낸 쪽은 자기 글을 읽은 것으로 처리
      agent_last_read_at = CASE WHEN NEW.sender_type = 'agent' THEN NEW.created_at ELSE agent_last_read_at END,
      admin_last_read_at = CASE WHEN NEW.sender_type = 'admin' THEN NEW.created_at ELSE admin_last_read_at END,
      updated_at = now()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_support_ticket ON public.support_ticket_messages;
CREATE TRIGGER trg_touch_support_ticket
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_support_ticket();

-- ─── RLS (직접 SELECT 방어용) ────────────────────────────
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- 현재 사용자가 접근 가능한 티켓인지 (개공 본인 또는 소속 스태프 또는 슈퍼관리자)
CREATE OR REPLACE FUNCTION public.can_access_support_ticket(p_agent_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_super_admin()
    OR p_agent_id IN (SELECT id FROM public.agent_profiles WHERE user_id = auth.uid())
    OR p_agent_id IN (SELECT agent_profile_id FROM public.staff_members WHERE user_id = auth.uid());
$$;

DROP POLICY IF EXISTS support_tickets_select ON public.support_tickets;
CREATE POLICY support_tickets_select ON public.support_tickets
  FOR SELECT USING (public.can_access_support_ticket(agent_id));

DROP POLICY IF EXISTS support_ticket_messages_select ON public.support_ticket_messages;
CREATE POLICY support_ticket_messages_select ON public.support_ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id AND public.can_access_support_ticket(st.agent_id)
    )
  );

-- ─── RPC: 문의 생성 (개공) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject TEXT,
  p_category TEXT,
  p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
  v_ticket_id UUID;
BEGIN
  SELECT id INTO v_agent_id FROM public.agent_profiles WHERE user_id = auth.uid();
  IF v_agent_id IS NULL THEN
    SELECT agent_profile_id INTO v_agent_id FROM public.staff_members WHERE user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION '중개사 프로필을 찾을 수 없습니다.';
  END IF;

  IF p_subject IS NULL OR length(trim(p_subject)) = 0 THEN
    RAISE EXCEPTION '제목을 입력하세요.';
  END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION '내용을 입력하세요.';
  END IF;

  INSERT INTO public.support_tickets (agent_id, created_by, subject, category)
  VALUES (v_agent_id, auth.uid(), trim(p_subject), COALESCE(NULLIF(trim(p_category), ''), 'general'))
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.support_ticket_messages (ticket_id, sender_type, sender_user_id, body)
  VALUES (v_ticket_id, 'agent', auth.uid(), p_body);

  RETURN v_ticket_id;
END;
$$;

-- ─── RPC: 메시지 작성 (개공 또는 슈퍼관리자) ───────────────
CREATE OR REPLACE FUNCTION public.post_support_message(
  p_ticket_id UUID,
  p_body TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender TEXT;
  v_agent_id UUID;
  v_msg_id UUID;
BEGIN
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION '내용을 입력하세요.';
  END IF;

  SELECT agent_id INTO v_agent_id FROM public.support_tickets WHERE id = p_ticket_id;
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION '문의를 찾을 수 없습니다.';
  END IF;

  IF public.is_super_admin() THEN
    v_sender := 'admin';
  ELSIF public.can_access_support_ticket(v_agent_id) THEN
    v_sender := 'agent';
  ELSE
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.support_ticket_messages (ticket_id, sender_type, sender_user_id, body)
  VALUES (p_ticket_id, v_sender, auth.uid(), p_body)
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

-- ─── RPC: 읽음 처리 ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_support_ticket_read(p_ticket_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  SELECT agent_id INTO v_agent_id FROM public.support_tickets WHERE id = p_ticket_id;
  IF v_agent_id IS NULL THEN RETURN; END IF;

  IF public.is_super_admin() THEN
    UPDATE public.support_tickets SET admin_last_read_at = now() WHERE id = p_ticket_id;
  ELSIF public.can_access_support_ticket(v_agent_id) THEN
    UPDATE public.support_tickets SET agent_last_read_at = now() WHERE id = p_ticket_id;
  END IF;
END;
$$;

-- ─── RPC: 상태 변경 (열림/해결/종료) ─────────────────────
CREATE OR REPLACE FUNCTION public.set_support_ticket_status(
  p_ticket_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  IF p_status NOT IN ('open', 'answered', 'closed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT agent_id INTO v_agent_id FROM public.support_tickets WHERE id = p_ticket_id;
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION '문의를 찾을 수 없습니다.';
  END IF;

  IF NOT (public.is_super_admin() OR public.can_access_support_ticket(v_agent_id)) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.support_tickets SET status = p_status, updated_at = now() WHERE id = p_ticket_id;
END;
$$;

-- ─── RPC: 슈퍼관리자 문의함 목록 (개공 정보 조인 + 미확인 여부) ──
CREATE OR REPLACE FUNCTION public.admin_get_support_tickets()
RETURNS TABLE (
  id UUID,
  agent_id UUID,
  office_name TEXT,
  representative TEXT,
  email TEXT,
  slug TEXT,
  subject TEXT,
  category TEXT,
  status TEXT,
  last_sender TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  message_count BIGINT,
  admin_unread BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized: super admin access only';
  END IF;

  RETURN QUERY
  SELECT
    st.id,
    st.agent_id,
    ap.office_name::TEXT,
    ap.representative::TEXT,
    u.email::TEXT,
    ap.slug::TEXT,
    st.subject,
    st.category,
    st.status,
    st.last_sender,
    st.last_message_at,
    st.created_at,
    (SELECT COUNT(*) FROM public.support_ticket_messages m WHERE m.ticket_id = st.id) AS message_count,
    (st.last_sender = 'agent'
      AND (st.admin_last_read_at IS NULL OR st.last_message_at > st.admin_last_read_at)) AS admin_unread
  FROM public.support_tickets st
  JOIN public.agent_profiles ap ON ap.id = st.agent_id
  JOIN public.users u ON u.id = ap.user_id
  ORDER BY st.last_message_at DESC;
END;
$$;
