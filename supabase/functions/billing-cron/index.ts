// 정기결제 자동갱신 — pg_cron 이 매일 호출 (verify_jwt=false, x-cron-secret 헤더로 보호)
// 만기(current_period_end <= now)인 active 구독을 순회하며:
//   - pending_plan='free' → Free 전환 + 구독 canceled
//   - 그 외             → (pending_plan ?? plan) 금액 자동결제 → 성공 시 기간 연장/전환, 실패 시 past_due
// 배포: supabase functions deploy billing-cron --no-verify-jwt
// 필요 시크릿: TOSS_SECRET_KEY, CRON_SECRET
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import { PLAN_PRICE, PLAN_LABEL, chargeBilling, addOneMonth, TossError } from '../_shared/toss.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const secretKey = Deno.env.get('TOSS_SECRET_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!secretKey || !supabaseUrl || !serviceKey) return json({ error: 'config missing' }, 500)
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) return json({ error: 'unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceKey)
  const nowIso = new Date().toISOString()

  const { data: due, error } = await admin
    .from('billing_subscriptions')
    .select('*')
    .eq('status', 'active')
    .lte('current_period_end', nowIso)
  if (error) return json({ error: error.message }, 500)

  let charged = 0, downgraded = 0, canceled = 0, failed = 0

  for (const sub of due ?? []) {
    try {
      const now = new Date()

      // 해지 예약 → Free 전환
      if (sub.pending_plan === 'free') {
        await admin.from('agent_profiles').update({ subscription_plan: 'free' }).eq('id', sub.agent_id)
        await admin.from('billing_subscriptions')
          .update({ status: 'canceled', updated_at: now.toISOString() })
          .eq('agent_id', sub.agent_id)
        canceled++
        continue
      }

      // 갱신 또는 유료 다운그레이드 → 대상 플랜 금액 청구
      const targetPlan = (sub.pending_plan ?? sub.plan) as 'basic' | 'pro'
      const amount = PLAN_PRICE[targetPlan]
      const orderId = `sub_${crypto.randomUUID()}`
      const payment = await chargeBilling(secretKey, sub.billing_key, {
        customerKey: sub.customer_key,
        amount,
        orderId,
        orderName: `중개프로 ${PLAN_LABEL[targetPlan]} 구독 (자동갱신)`,
      })
      if (payment.status !== 'DONE') throw new TossError('결제 미완료', payment.status)

      const periodEnd = addOneMonth(now)
      await admin.from('payment_history').insert({
        agent_id: sub.agent_id, order_id: orderId, plan: targetPlan, amount, status: 'paid',
        method: payment.method ?? null, receipt_url: payment.receipt?.url ?? null,
        payment_key: payment.paymentKey ?? null, approved_at: payment.approvedAt ?? null, raw: payment,
      })
      await admin.from('billing_subscriptions').update({
        plan: targetPlan, pending_plan: null, cancel_at_period_end: false,
        current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(), updated_at: now.toISOString(),
      }).eq('agent_id', sub.agent_id)
      await admin.from('agent_profiles').update({ subscription_plan: targetPlan }).eq('id', sub.agent_id)

      if (sub.pending_plan) downgraded++
      else charged++
    } catch (e) {
      failed++
      const targetPlan = (sub.pending_plan ?? sub.plan) as string
      await admin.from('billing_subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('agent_id', sub.agent_id)
      await admin.from('payment_history').insert({
        agent_id: sub.agent_id, order_id: `fail_${crypto.randomUUID()}`,
        plan: targetPlan, amount: PLAN_PRICE[targetPlan] ?? 0, status: 'failed',
        raw: { error: e instanceof Error ? e.message : String(e) },
      })
    }
  }

  return json({ ok: true, processed: due?.length ?? 0, charged, downgraded, canceled, failed })
})
