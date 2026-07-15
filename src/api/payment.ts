// 토스페이먼츠 정기결제 클라이언트 API
// - dev : Vite 프록시(/api/payment) — 서버 키/빌링키는 서버측에만
// - prod: Supabase Edge Function 'payment'
// 카드정보는 토스 결제창에서만 입력되고, billingKey 는 서버(Edge Function/프록시)에만 저장된다.

import { supabase } from '@/api/supabase'
import { getAgentProfileId } from '@/api/helpers'
import { useAuthStore } from '@/stores/authStore'
import { PLAN_INFO } from '@/config/planFeatures'
import type { PlanType } from '@/types/database'

const CLIENT_KEY = import.meta.env.VITE_TOSS_CLIENT_KEY as string | undefined

export type BillingInfo = {
  current_plan: PlanType
  plan_label: string
  price: number
  next_billing_date: string
  status: 'none' | 'active' | 'canceled' | 'past_due'
  pending_plan: PlanType | null
  cancel_at_period_end: boolean
  card_company: string | null
  card_last4: string | null
  payment_history: { date: string; amount: number; description: string; status: string }[]
}

/** payment Edge Function / dev 프록시 호출 */
async function callPayment(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (import.meta.env.DEV) {
    let token = ''
    try {
      const rawAuth = localStorage.getItem('jungaepro-auth')
      token = rawAuth ? (JSON.parse(rawAuth) as { access_token?: string }).access_token ?? '' : ''
    } catch { /* ignore */ }
    const res = await fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok || data.error) throw new Error(data.error || `결제 요청 실패 (HTTP ${res.status})`)
    return data
  }

  const { data, error } = await supabase.functions.invoke('payment', { body: payload })
  if (error) throw new Error(error.message || '결제 요청에 실패했습니다.')
  if (data?.error) throw new Error(data.error)
  return data
}

/** 카드 등록(빌링 인증) 시작 — 토스 결제창으로 리다이렉트된다 */
export async function startCardRegistration(plan: 'basic' | 'pro'): Promise<void> {
  if (!CLIENT_KEY) throw new Error('토스 클라이언트 키가 설정되지 않았습니다. (VITE_TOSS_CLIENT_KEY)')
  const customerKey = await getAgentProfileId()
  const { user, agentProfile } = useAuthStore.getState()

  const { loadTossPayments } = await import('@tosspayments/tosspayments-sdk')
  const tossPayments = await loadTossPayments(CLIENT_KEY)
  const payment = tossPayments.payment({ customerKey })
  const origin = window.location.origin
  await payment.requestBillingAuth({
    method: 'CARD',
    successUrl: `${origin}/admin/settings/billing?billing=success&plan=${plan}`,
    failUrl: `${origin}/admin/settings/billing?billing=fail`,
    customerEmail: user?.email,
    customerName: agentProfile?.representative || agentProfile?.office_name,
  })
}

/** 결제창 성공 리다이렉트 후 — billingKey 발급 + 첫 결제 */
export async function completeBillingAuth(authKey: string, customerKey: string, plan: 'basic' | 'pro') {
  return callPayment({ action: 'issue', authKey, customerKey, plan })
}

/** 플랜 변경 (업그레이드=즉시 청구 / 다운그레이드=만기 전환 예약 / 현재 플랜 재선택=예약 취소) */
export async function changePlan(plan: PlanType) {
  return callPayment({ action: 'change', plan })
}

/** 구독 해지 (만기까지 현재 플랜 유지 후 Free 전환) */
export async function cancelSubscription() {
  return callPayment({ action: 'cancel' })
}

/** 구독 상태 + 결제 이력 조회 (실데이터) */
export async function fetchBillingInfo(): Promise<BillingInfo> {
  const [{ data: subRows }, { data: history }] = await Promise.all([
    supabase.rpc('get_my_subscription'),
    supabase.from('payment_history').select('*').order('created_at', { ascending: false }).limit(24),
  ])
  const sub = Array.isArray(subRows) && subRows.length > 0 ? subRows[0] : null

  const currentPlan = (useAuthStore.getState().agentProfile?.subscription_plan ?? 'free') as PlanType
  const info = PLAN_INFO[currentPlan]

  const statusLabel = (s: string) =>
    s === 'paid' ? '결제완료' : s === 'failed' ? '실패' : s === 'canceled' ? '취소' : s

  return {
    current_plan: currentPlan,
    plan_label: info.label,
    price: info.price,
    next_billing_date: sub?.current_period_end ?? '',
    status: (sub?.status as BillingInfo['status']) ?? 'none',
    pending_plan: (sub?.pending_plan ?? null) as PlanType | null,
    cancel_at_period_end: sub?.cancel_at_period_end ?? false,
    card_company: sub?.card_company ?? null,
    card_last4: sub?.card_last4 ?? null,
    payment_history: (history ?? []).map((h) => ({
      date: h.approved_at ?? h.created_at,
      amount: h.amount,
      description: h.plan ? `${PLAN_INFO[h.plan as PlanType]?.label ?? h.plan} 요금제` : '구독 결제',
      status: statusLabel(h.status),
    })),
  }
}
