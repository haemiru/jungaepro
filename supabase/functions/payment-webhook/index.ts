// 토스페이먼츠 결제상태 웹훅 수신 (verify_jwt=false — 토스가 직접 호출)
// order_id 로 payment_history 상태를 멱등 갱신한다.
// 배포: supabase functions deploy payment-webhook --no-verify-jwt
// 토스 대시보드 > 웹훅에 이 함수 URL 등록 (go-live 시).
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

// 토스 결제 status → 내부 status
const STATUS_MAP: Record<string, string> = {
  DONE: 'paid',
  CANCELED: 'canceled',
  PARTIAL_CANCELED: 'canceled',
  ABORTED: 'failed',
  EXPIRED: 'failed',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const event = await req.json()
    // 토스 웹훅 페이로드는 { eventType, data: {...} } 또는 결제객체 그대로일 수 있음
    const data = event?.data ?? event
    const orderId = data?.orderId
    const mapped = data?.status ? STATUS_MAP[data.status] : null

    if (orderId && mapped) {
      const patch: Record<string, unknown> = { status: mapped, raw: data }
      if (data.paymentKey) patch.payment_key = data.paymentKey
      if (data.receipt?.url) patch.receipt_url = data.receipt.url
      if (data.approvedAt) patch.approved_at = data.approvedAt
      await admin.from('payment_history').update(patch).eq('order_id', orderId)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    // 웹훅은 항상 200 — 토스 재시도 폭주 방지, 에러는 로그로만
    console.error('payment-webhook error:', err instanceof Error ? err.message : String(err))
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
