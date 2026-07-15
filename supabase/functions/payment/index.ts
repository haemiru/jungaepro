// 토스페이먼츠 정기결제 — 로그인 중개사가 호출 (verify_jwt=true)
//   action=issue  : authKey → billingKey 발급 + 첫 결제 + 플랜 적용
//   action=change : 업그레이드(즉시 청구+적용) / 다운그레이드(만기 전환 예약) / 예약 취소(현재 플랜 재선택)
//   action=cancel : 만기 시 Free 전환 예약 (기간 끝까지 현재 플랜 유지)
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import {
  PLAN_PRICE, PLAN_LABEL, PLAN_RANK,
  issueBillingKey, chargeBilling, addOneMonth, cardLast4, TossError,
} from '../_shared/toss.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const secretKey = Deno.env.get('TOSS_SECRET_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!secretKey || !supabaseUrl || !serviceKey) {
      return json({ error: '결제 서버 설정이 누락되었습니다. (TOSS_SECRET_KEY)' }, 500)
    }

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    if (!token) return json({ error: '로그인이 필요합니다.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) return json({ error: '인증에 실패했습니다.' }, 401)
    const userEmail = userData.user.email ?? undefined

    // 결제 관리는 중개사 본인(agent_profiles 소유자)만
    const { data: agent, error: agentErr } = await admin
      .from('agent_profiles')
      .select('id, subscription_plan, office_name, representative')
      .eq('user_id', userData.user.id)
      .single()
    if (agentErr || !agent) return json({ error: '중개사만 결제를 관리할 수 있습니다.' }, 403)

    const body = await req.json()
    const action = body.action as string

    // 공용: 청구 + payment_history 기록
    async function chargeAndRecord(plan: 'basic' | 'pro', billingKey: string, customerKey: string) {
      const amount = PLAN_PRICE[plan]
      const orderId = `sub_${crypto.randomUUID()}`
      const payment = await chargeBilling(secretKey!, billingKey, {
        customerKey,
        amount,
        orderId,
        orderName: `중개프로 ${PLAN_LABEL[plan]} 구독`,
        customerEmail: userEmail,
        customerName: agent!.representative || agent!.office_name,
      })
      if (payment.status !== 'DONE') throw new TossError('결제가 완료되지 않았습니다.', payment.status)
      await admin.from('payment_history').insert({
        agent_id: agent!.id, order_id: orderId, plan, amount, status: 'paid',
        method: payment.method ?? null, receipt_url: payment.receipt?.url ?? null,
        payment_key: payment.paymentKey ?? null, approved_at: payment.approvedAt ?? null, raw: payment,
      })
      return payment
    }

    // ── issue: 카드 등록 후 첫 결제 ──
    if (action === 'issue') {
      const { authKey, customerKey, plan } = body
      if (!authKey || !customerKey || (plan !== 'basic' && plan !== 'pro')) {
        return json({ error: '잘못된 요청입니다.' }, 400)
      }
      if (customerKey !== agent.id) return json({ error: '고객 식별자가 일치하지 않습니다.' }, 403)

      const issued = await issueBillingKey(secretKey, authKey, customerKey)
      const company = issued.cardCompany ?? issued.card?.company ?? null
      const last4 = cardLast4(issued.card?.number)

      const now = new Date()
      const periodEnd = addOneMonth(now)

      await chargeAndRecord(plan, issued.billingKey, customerKey)

      await admin.from('billing_subscriptions').upsert({
        agent_id: agent.id, customer_key: customerKey, billing_key: issued.billingKey,
        card_company: company, card_last4: last4, plan, status: 'active',
        pending_plan: null, cancel_at_period_end: false,
        current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: 'agent_id' })

      await admin.from('agent_profiles')
        .update({ subscription_plan: plan, subscription_started_at: now.toISOString() })
        .eq('id', agent.id)

      return json({ ok: true, plan, card_company: company, card_last4: last4, current_period_end: periodEnd.toISOString() })
    }

    // change / cancel 은 기존 구독 필요
    const { data: sub } = await admin.from('billing_subscriptions').select('*').eq('agent_id', agent.id).single()

    // ── change: 플랜 변경 ──
    if (action === 'change') {
      const plan = body.plan
      if (plan !== 'free' && plan !== 'basic' && plan !== 'pro') return json({ error: '잘못된 플랜입니다.' }, 400)
      if (!sub) return json({ error: '등록된 결제 수단이 없습니다. 먼저 카드를 등록해주세요.' }, 400)

      const current = agent.subscription_plan as string
      const now = new Date()

      // 현재 플랜 재선택 → 예약된 다운그레이드/해지 취소 (구독 재개)
      if (plan === current) {
        if (sub.pending_plan || sub.cancel_at_period_end) {
          await admin.from('billing_subscriptions')
            .update({ pending_plan: null, cancel_at_period_end: false, status: 'active', updated_at: now.toISOString() })
            .eq('agent_id', agent.id)
        }
        return json({ ok: true, plan, resumed: true })
      }

      if (PLAN_RANK[plan] > PLAN_RANK[current]) {
        // 업그레이드 — 즉시 청구 + 즉시 적용 + 기간 리셋
        await chargeAndRecord(plan as 'basic' | 'pro', sub.billing_key, sub.customer_key)
        const periodEnd = addOneMonth(now)
        await admin.from('billing_subscriptions').update({
          plan, status: 'active', pending_plan: null, cancel_at_period_end: false,
          current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(), updated_at: now.toISOString(),
        }).eq('agent_id', agent.id)
        await admin.from('agent_profiles')
          .update({ subscription_plan: plan, subscription_started_at: now.toISOString() })
          .eq('id', agent.id)
        return json({ ok: true, plan, immediate: true, current_period_end: periodEnd.toISOString() })
      }

      // 다운그레이드 — 만기 시 전환 예약 (기간 끝까지 현재 플랜 유지, 환불 없음)
      await admin.from('billing_subscriptions').update({
        pending_plan: plan, cancel_at_period_end: plan === 'free', updated_at: now.toISOString(),
      }).eq('agent_id', agent.id)
      return json({ ok: true, plan: current, pending_plan: plan, effective_at: sub.current_period_end })
    }

    // ── cancel: 해지 예약 ──
    if (action === 'cancel') {
      if (!sub) return json({ error: '구독 정보가 없습니다.' }, 400)
      await admin.from('billing_subscriptions').update({
        pending_plan: 'free', cancel_at_period_end: true, updated_at: new Date().toISOString(),
      }).eq('agent_id', agent.id)
      return json({ ok: true, canceled_at_period_end: sub.current_period_end })
    }

    return json({ error: '알 수 없는 요청입니다.' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const code = (err as TossError)?.statusCode
    const status = typeof code === 'number' && code >= 400 && code < 600 ? code : 500
    return json({ error: message }, status)
  }
})
