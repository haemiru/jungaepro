-- ============================================
-- 토스페이먼츠 정기결제 (빌링) 연동
-- ============================================
-- billing_subscriptions : 구독 + 빌링키(결제수단 자격증명) 보관 — service_role(Edge Function) 전용
-- payment_history        : 결제 원장 — 소유자 읽기
-- get_my_subscription()  : billing_key 제외한 안전 컬럼만 노출 (SECURITY DEFINER)
-- pg_cron                : 매일 만기 구독 자동결제 — 스케줄 활성화는 go-live 시 (아래 주석 참조)
--
-- agent_profiles.subscription_plan 은 "유효 플랜"의 source of truth 로 유지한다
-- (featureStore·매물 수 제한이 이미 이 컬럼을 읽음). 아래 테이블은 결제 원장 역할.
-- ============================================

-- 1. 구독 테이블 (민감 — 빌링키 보관)
CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  customer_key TEXT NOT NULL,
  billing_key TEXT NOT NULL,                        -- 결제수단 자격증명. 클라이언트에 절대 노출 금지.
  card_company TEXT,
  card_last4 TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('basic', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  pending_plan TEXT CHECK (pending_plan IN ('free', 'basic', 'pro')),  -- 만기 시 전환 예약(다운그레이드/해지)
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

-- 클라이언트(anon/authenticated) 직접 접근 정책 없음 → billing_key 노출 차단.
-- service_role 키는 RLS를 우회하므로 Edge Function 은 전체 접근 가능.
CREATE POLICY "billing_subscriptions_service_all" ON public.billing_subscriptions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 자동갱신 cron 조회용 (만기 임박 active 구독)
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_period_end
  ON public.billing_subscriptions (current_period_end) WHERE status = 'active';

-- 2. 결제 원장
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL UNIQUE,
  plan TEXT,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,                             -- paid | failed | canceled
  method TEXT,
  receipt_url TEXT,
  payment_key TEXT,                                 -- 토스 paymentKey (취소/환불용)
  approved_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- 소유자(중개사)만 자신의 결제 이력 읽기
CREATE POLICY "payment_history_owner_read" ON public.payment_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agent_profiles ap
      WHERE ap.id = payment_history.agent_id AND ap.user_id = auth.uid()
    )
  );

CREATE POLICY "payment_history_service_all" ON public.payment_history
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_payment_history_agent
  ON public.payment_history (agent_id, created_at DESC);

-- 3. 안전 컬럼만 노출 (billing_key 제외). 클라이언트는 이 함수로만 구독 상태를 읽는다.
CREATE OR REPLACE FUNCTION public.get_my_subscription()
RETURNS TABLE (
  plan TEXT,
  status TEXT,
  card_company TEXT,
  card_last4 TEXT,
  pending_plan TEXT,
  cancel_at_period_end BOOLEAN,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT bs.plan, bs.status, bs.card_company, bs.card_last4,
         bs.pending_plan, bs.cancel_at_period_end,
         bs.current_period_start, bs.current_period_end
  FROM public.billing_subscriptions bs
  JOIN public.agent_profiles ap ON ap.id = bs.agent_id
  WHERE ap.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_subscription() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_subscription() TO authenticated;

-- ============================================
-- 4. 자동갱신 (pg_cron) — go-live 시 아래를 실행
-- ============================================
-- 권장: Supabase 대시보드 Database > Extensions 에서 pg_cron, pg_net 활성화 후
--       billing-cron 함수 배포 + CRON_SECRET 시크릿 설정. 그 다음 아래 스케줄 등록.
--
--   -- 매일 03:00 KST (UTC 18:00) 만기 구독 자동결제
--   SELECT cron.schedule(
--     'billing-daily-charge',
--     '0 18 * * *',
--     $$
--     SELECT net.http_post(
--       url     := 'https://<PROJECT_REF>.functions.supabase.co/billing-cron',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'x-cron-secret', '<CRON_SECRET>'
--       ),
--       body    := '{}'::jsonb
--     );
--     $$
--   );
--
--   -- 스케줄 해제:  SELECT cron.unschedule('billing-daily-charge');
--   -- 등록 확인:    SELECT * FROM cron.job;
-- ============================================
