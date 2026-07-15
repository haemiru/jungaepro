import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  fetchBillingInfo, changePlan, cancelSubscription, startCardRegistration, completeBillingAuth,
  type BillingInfo,
} from '@/api/payment'
import type { PlanType } from '@/types/database'
import { useFeatureStore } from '@/stores/featureStore'
import { useAuthStore } from '@/stores/authStore'
import { PLAN_INFO } from '@/config/planFeatures'
import { formatDate } from '@/utils/format'
import toast from 'react-hot-toast'

const PLAN_RANK: Record<PlanType, number> = { free: 0, basic: 1, pro: 2 }

const plans: { key: PlanType; features: string[] }[] = [
  { key: 'free', features: ['매물 20건', '고객관리', '문의 관리', '계약 관리', '서브도메인'] },
  { key: 'basic', features: ['매물 무제한', 'AI 도구', '고객 스코어링/진성 분석', '데이터 분석', '임장/임대 관리', '공동중개', '커스텀 도메인', '알림톡/SMS'] },
  { key: 'pro', features: ['Basic 전체', 'AI 가상스테이징', 'SNS 포스팅', '실시간 채팅', '전자서명'] },
]

export function BillingSettingsPage() {
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setPlan = useFeatureStore((s) => s.setPlan)
  const authProcessed = useRef(false)

  async function load() {
    try {
      setBilling(await fetchBillingInfo())
    } catch {
      setBilling({
        current_plan: 'free', plan_label: 'Free', price: 0, next_billing_date: '',
        status: 'none', pending_plan: null, cancel_at_period_end: false,
        card_company: null, card_last4: null, payment_history: [],
      })
    }
  }

  // 유효 플랜을 로컬 스토어에 즉시 반영 (사이드바/기능 게이팅)
  function applyEffectivePlan(plan: PlanType) {
    setPlan(plan)
    const cur = useAuthStore.getState().agentProfile
    if (cur) {
      useAuthStore.setState({
        agentProfile: { ...cur, subscription_plan: plan, subscription_started_at: new Date().toISOString() },
      })
    }
  }

  // 결제창 성공 리다이렉트 처리 (billingKey 발급 + 첫 결제)
  async function handleAuthRedirect(authKey: string | null, customerKey: string | null, plan: string | null) {
    navigate('/admin/settings/billing', { replace: true })
    if (authKey && customerKey && (plan === 'basic' || plan === 'pro')) {
      setBusy('auth')
      try {
        await completeBillingAuth(authKey, customerKey, plan)
        applyEffectivePlan(plan)
        toast.success('카드가 등록되고 결제가 완료되었습니다.')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '결제 처리에 실패했습니다.')
      } finally {
        setBusy(null)
        await load()
      }
    } else {
      await load()
    }
  }

  // 결제창 리다이렉트 감지 + 초기 로드
  useEffect(() => {
    const result = searchParams.get('billing')
    if (result === 'success' && !authProcessed.current) {
      authProcessed.current = true
      void handleAuthRedirect(searchParams.get('authKey'), searchParams.get('customerKey'), searchParams.get('plan'))
    } else if (result === 'fail' && !authProcessed.current) {
      authProcessed.current = true
      toast.error('카드 등록이 취소되었습니다.')
      navigate('/admin/settings/billing', { replace: true })
      void load()
    } else {
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePlanChange(newPlan: PlanType) {
    if (!billing || busy) return
    const current = billing.current_plan
    if (newPlan === current) return

    const hasCard = billing.status !== 'none'
    const label = PLAN_INFO[newPlan].label

    try {
      // 결제수단 없음 → 유료 플랜은 카드 등록부터 (토스 결제창으로 이동)
      if (!hasCard) {
        if (newPlan === 'free') return
        setBusy(newPlan)
        await startCardRegistration(newPlan as 'basic' | 'pro')
        return // 리다이렉트되므로 이후 처리 없음
      }

      // 업그레이드 — 즉시 청구
      if (PLAN_RANK[newPlan] > PLAN_RANK[current]) {
        if (!window.confirm(`지금 ${PLAN_INFO[newPlan].price.toLocaleString()}원이 결제되고 즉시 ${label} 요금제로 전환됩니다. 진행할까요?`)) return
        setBusy(newPlan)
        await changePlan(newPlan)
        applyEffectivePlan(newPlan)
        toast.success(`${label} 요금제로 업그레이드되었습니다.`)
        await load()
        return
      }

      // 해지 (→ Free)
      if (newPlan === 'free') {
        const until = billing.next_billing_date ? formatDate(billing.next_billing_date) : '결제기간 종료일'
        if (!window.confirm(`구독을 해지하면 ${until}까지 이용 후 Free로 전환됩니다. (환불 없음)\nFree 요금제는 매물을 20건까지만 신규 등록할 수 있습니다. 기존 매물은 유지됩니다.`)) return
        setBusy(newPlan)
        await cancelSubscription()
        toast.success('구독 해지가 예약되었습니다.')
        await load()
        return
      }

      // 유료 다운그레이드 (pro → basic) — 만기 전환 예약
      const until = billing.next_billing_date ? formatDate(billing.next_billing_date) : '결제기간 종료일'
      if (!window.confirm(`${until}(다음 결제일)에 ${label} 요금제로 전환됩니다. 그때까지는 현재 요금제를 그대로 이용합니다. (환불 없음)`)) return
      setBusy(newPlan)
      await changePlan(newPlan)
      toast.success(`${label} 요금제로 전환이 예약되었습니다.`)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '요금제 변경에 실패했습니다.')
    } finally {
      setBusy(null)
    }
  }

  // 예약(다운그레이드/해지) 취소 → 현재 플랜 재선택으로 pending 해제
  async function handleResume() {
    if (!billing || busy) return
    try {
      setBusy('resume')
      await changePlan(billing.current_plan)
      toast.success('예약된 변경을 취소했습니다.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '예약 취소에 실패했습니다.')
    } finally {
      setBusy(null)
    }
  }

  if (!billing) return <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>

  const hasCard = billing.status !== 'none'
  const scheduledChange = billing.cancel_at_period_end || (billing.pending_plan && billing.pending_plan !== billing.current_plan)

  function planButton(planKey: PlanType) {
    const isCurrent = planKey === billing!.current_plan
    if (isCurrent) return { label: '현재 요금제', disabled: true }
    if (!hasCard) {
      if (planKey === 'free') return { label: '—', disabled: true }
      return { label: '시작하기', disabled: false }
    }
    if (PLAN_RANK[planKey] > PLAN_RANK[billing!.current_plan]) return { label: '업그레이드', disabled: false }
    if (planKey === 'free') return { label: '해지', disabled: false }
    return { label: '다운그레이드', disabled: false }
  }

  return (
    <div className="space-y-5">
      {busy === 'auth' && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700 ring-1 ring-blue-200">
          결제를 처리하고 있습니다…
        </div>
      )}

      {/* Current Plan */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="text-sm font-bold">현재 요금제</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className={`rounded-lg px-4 py-2 ${PLAN_INFO[billing.current_plan].bgColor}`}>
            <p className={`text-lg font-bold ${PLAN_INFO[billing.current_plan].textColor}`}>{billing.plan_label}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              {billing.price === 0 ? '무료' : `월 ${billing.price.toLocaleString()}원 (VAT 별도)`}
            </p>
            {billing.price > 0 && billing.next_billing_date && (
              <p className="text-xs text-gray-400">
                {billing.cancel_at_period_end ? '이용 종료일' : '다음 결제일'}: {formatDate(billing.next_billing_date)}
              </p>
            )}
          </div>
          {billing.status === 'past_due' && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">결제 실패 · 결제수단 확인 필요</span>
          )}
        </div>

        {/* 예약된 변경 안내 */}
        {scheduledChange && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200">
            <p className="text-xs text-amber-800">
              {billing.cancel_at_period_end
                ? `${billing.next_billing_date ? formatDate(billing.next_billing_date) : '결제기간 종료 시'} 해지 예정 (이후 Free 전환)`
                : `${billing.next_billing_date ? formatDate(billing.next_billing_date) : '다음 결제일'}에 ${billing.pending_plan ? PLAN_INFO[billing.pending_plan].label : ''} 요금제로 전환 예정`}
            </p>
            <button onClick={handleResume} disabled={!!busy} className="rounded-md bg-white px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-50">
              예약 취소
            </button>
          </div>
        )}

        {/* 등록된 결제수단 */}
        {hasCard && billing.card_last4 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
            <span>{billing.card_company || '카드'} •••• {billing.card_last4}</span>
          </div>
        )}
      </div>

      {/* Plan Comparison */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-bold">요금제 비교</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const info = PLAN_INFO[plan.key]
            const isCurrent = plan.key === billing.current_plan
            const btn = planButton(plan.key)
            return (
              <div key={plan.key} className={`rounded-xl p-4 ring-1 ${isCurrent ? `${info.bgColor} ring-2` : 'ring-gray-200'}`} style={isCurrent ? { borderColor: info.color } : undefined}>
                <h3 className="text-sm font-bold">{info.label}</h3>
                <p className="mt-1 text-lg font-bold">
                  {info.price === 0 ? '무료' : `${info.price.toLocaleString()}원`}
                  {info.price > 0 && <span className="text-xs font-normal text-gray-400">/월 (VAT 별도)</span>}
                </p>
                <ul className="mt-3 space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="text-xs text-gray-600">• {f}</li>
                  ))}
                </ul>
                <button
                  onClick={() => handlePlanChange(plan.key)}
                  disabled={btn.disabled || !!busy}
                  className={`mt-3 w-full rounded-lg py-2 text-xs font-medium ${
                    btn.disabled
                      ? 'bg-gray-100 text-gray-400'
                      : busy
                        ? 'bg-gray-200 text-gray-400'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  {busy === plan.key ? '처리 중...' : btn.label}
                </button>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-[11px] text-gray-400">결제는 토스페이먼츠로 안전하게 처리됩니다. 카드정보는 당사 서버에 저장되지 않습니다.</p>
      </div>

      {/* Payment History */}
      {billing.payment_history.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-3 text-sm font-bold">결제 이력</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                  <th className="pb-2 pr-4">결제일</th>
                  <th className="pb-2 pr-4">금액</th>
                  <th className="pb-2 pr-4">내역</th>
                  <th className="pb-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {billing.payment_history.map((p, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2.5 pr-4 text-xs">{p.date ? formatDate(p.date) : '-'}</td>
                    <td className="py-2.5 pr-4">{p.amount.toLocaleString()}원</td>
                    <td className="py-2.5 pr-4 text-xs text-gray-500">{p.description}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        p.status === '결제완료' ? 'bg-green-100 text-green-700'
                          : p.status === '실패' ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
