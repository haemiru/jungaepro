import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { fetchAllAgents, updateAgentPlan, verifyAgent } from '@/api/superAdmin'
import type { AdminAgent } from '@/api/superAdmin'
import { sendEmail } from '@/api/email'
import toast from 'react-hot-toast'

function buildVerificationEmailHtml(agent: AdminAgent): string {
  const portalUrl = agent.slug
    ? `https://${agent.slug}.jungaepro.com`
    : 'https://www.jungaepro.com'
  return `
    <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1f2937;">
      <h1 style="font-size:20px;font-weight:700;color:#2563eb;margin:0 0 16px;">사무소 인증이 승인되었습니다</h1>
      <p style="font-size:14px;line-height:1.7;margin:0 0 12px;">안녕하세요, <strong>${agent.representative || agent.office_name || '대표자'}</strong> 님.</p>
      <p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
        <strong>${agent.office_name || '귀 사무소'}</strong>의 중개프로 가입이 정식 승인되었습니다.
        이제 모든 기능을 이용하실 수 있으며, 고객은 아래 주소로 사무소에 접속할 수 있습니다.
      </p>
      <div style="margin:20px 0;padding:16px;background:#f3f4f6;border-radius:8px;font-size:14px;">
        <div style="color:#6b7280;font-size:12px;margin-bottom:4px;">사무소 홈페이지</div>
        <a href="${portalUrl}" style="color:#2563eb;font-weight:600;text-decoration:none;">${portalUrl}</a>
      </div>
      <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:16px 0 0;">
        문의사항이 있으시면 이 메일에 회신해 주세요.<br/>
        — 중개프로 운영팀
      </p>
    </div>
  `.trim()
}

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free', color: 'bg-gray-100 text-gray-700' },
  { value: 'basic', label: 'Basic', color: 'bg-blue-100 text-blue-700' },
  { value: 'pro', label: 'Pro', color: 'bg-purple-100 text-purple-700' },
] as const

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function SuperAdminPage() {
  const { user, isLoading: authLoading, isInitialized } = useAuthStore()
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [verifyTarget, setVerifyTarget] = useState<AdminAgent | null>(null)
  const [verifyBusy, setVerifyBusy] = useState(false)

  const email = user?.email ?? ''
  const isSuperAdmin = email === 'junominu@gmail.com'


  const loadAgents = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllAgents()
      setAgents(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '데이터를 불러올 수 없습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isInitialized || authLoading) return
    if (isSuperAdmin) {
      loadAgents()
    } else {
      setLoading(false)
    }
  }, [isInitialized, authLoading, isSuperAdmin])

  const handleConfirmVerify = async () => {
    if (!verifyTarget) return
    const agent = verifyTarget
    const nextVerified = !agent.is_verified
    setVerifyBusy(true)
    try {
      await verifyAgent(agent.agent_id, nextVerified)
      setAgents((prev) =>
        prev.map((a) => (a.agent_id === agent.agent_id ? { ...a, is_verified: nextVerified } : a))
      )

      if (nextVerified) {
        try {
          await sendEmail({
            to: agent.email,
            subject: '[중개프로] 사무소 인증이 승인되었습니다',
            html: buildVerificationEmailHtml({ ...agent, is_verified: true }),
          })
          toast.success('승인 완료 — 안내 메일을 발송했습니다.')
        } catch (mailErr) {
          const msg = mailErr instanceof Error ? mailErr.message : '이메일 발송 실패'
          toast.error(`승인은 완료됐지만 메일 발송 실패: ${msg}`)
        }
      } else {
        toast.success('승인이 취소되었습니다.')
      }

      setVerifyTarget(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '처리에 실패했습니다.'
      toast.error(msg)
    } finally {
      setVerifyBusy(false)
    }
  }

  const handlePlanChange = async (agentId: string, newPlan: string) => {
    setUpdatingId(agentId)
    try {
      await updateAgentPlan(agentId, newPlan)
      setAgents((prev) =>
        prev.map((a) => (a.agent_id === agentId ? { ...a, subscription_plan: newPlan } : a))
      )
      toast.success('플랜이 변경되었습니다.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '플랜 변경에 실패했습니다.'
      toast.error(msg)
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return agents
    const q = search.toLowerCase()
    return agents.filter(
      (a) =>
        a.email.toLowerCase().includes(q) ||
        (a.office_name ?? '').toLowerCase().includes(q) ||
        (a.representative ?? '').toLowerCase().includes(q) ||
        (a.slug ?? '').toLowerCase().includes(q)
    )
  }, [agents, search])

  const stats = useMemo(() => {
    const total = agents.length
    const free = agents.filter((a) => a.subscription_plan === 'free').length
    const basic = agents.filter((a) => a.subscription_plan === 'basic').length
    const pro = agents.filter((a) => a.subscription_plan === 'pro').length
    const properties = agents.reduce((sum, a) => sum + (a.property_count ?? 0), 0)
    return { total, free, basic, pro, properties }
  }, [agents])

  // Wait for auth to initialize
  if (!isInitialized || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    )
  }

  // Not logged in → show login prompt
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">로그인이 필요합니다</h2>
          <p className="mt-2 text-sm text-gray-500">슈퍼 관리자 계정으로 로그인해주세요.</p>
          <a href="/auth/login" className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">로그인</a>
        </div>
      </div>
    )
  }

  // Unauthorized
  if (!isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">접근 권한이 없습니다</h2>
          <p className="mt-2 text-sm text-gray-500">이 페이지는 슈퍼 관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                슈퍼 관리자
                <span className="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">ADMIN</span>
              </h1>
              <p className="mt-1 text-sm text-gray-500">가입자 관리 — 전체 중개사 계정 현황</p>
            </div>
            <button
              onClick={loadAgents}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
              새로고침
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: '전체 가입자', value: `${stats.total}명`, bg: 'bg-white' },
            { label: 'Free', value: `${stats.free}명`, bg: 'bg-gray-50' },
            { label: 'Basic', value: `${stats.basic}명`, bg: 'bg-blue-50' },
            { label: 'Pro', value: `${stats.pro}명`, bg: 'bg-purple-50' },
            { label: '총 매물', value: `${stats.properties.toLocaleString()}건`, bg: 'bg-green-50' },
          ].map((card) => (
            <div key={card.label} className={`rounded-xl ${card.bg} border border-gray-200 p-4 shadow-sm`}>
              <p className="text-xs font-medium text-gray-500">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="이메일, 사무소명, 대표자, Slug 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['이메일', '사무소명', '대표자', 'Slug', '플랜', '매물수', '가입일', '인증', '플랜 변경'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="mx-auto h-6 w-6 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                      {search ? '검색 결과가 없습니다.' : '등록된 가입자가 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((agent) => {
                    const planInfo = PLAN_OPTIONS.find((p) => p.value === agent.subscription_plan) ?? PLAN_OPTIONS[0]
                    return (
                      <tr key={agent.agent_id} className="hover:bg-gray-50 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{agent.email}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{agent.office_name || '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{agent.representative || '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          {agent.slug ? (
                            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{agent.slug}</code>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${planInfo.color}`}>
                            {planInfo.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 text-right tabular-nums">
                          {agent.property_count.toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                          {formatDate(agent.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          {agent.is_verified ? (
                            <button
                              type="button"
                              onClick={() => setVerifyTarget(agent)}
                              className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 transition hover:bg-green-200"
                              title="승인 취소"
                            >
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              인증됨
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setVerifyTarget(agent)}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-blue-700"
                              title="이 사무소를 승인합니다"
                            >
                              승인하기
                            </button>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <select
                            value={agent.subscription_plan}
                            onChange={(e) => handlePlanChange(agent.agent_id, e.target.value)}
                            disabled={updatingId === agent.agent_id}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                          >
                            {PLAN_OPTIONS.map((p) => (
                              <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-xs text-gray-500">
              {search ? `검색 결과: ${filtered.length}명` : `전체: ${agents.length}명`}
            </div>
          )}
        </div>
      </div>

      {/* Verify confirmation modal */}
      {verifyTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !verifyBusy && setVerifyTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900">
              {verifyTarget.is_verified ? '승인을 취소하시겠습니까?' : '사무소를 승인하시겠습니까?'}
            </h3>
            <div className="mt-4 space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
              <div className="flex">
                <span className="w-20 shrink-0 text-gray-500">사무소</span>
                <span className="font-medium text-gray-900">{verifyTarget.office_name || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-20 shrink-0 text-gray-500">대표자</span>
                <span className="text-gray-700">{verifyTarget.representative || '-'}</span>
              </div>
              <div className="flex">
                <span className="w-20 shrink-0 text-gray-500">이메일</span>
                <span className="text-gray-700">{verifyTarget.email}</span>
              </div>
              <div className="flex">
                <span className="w-20 shrink-0 text-gray-500">Slug</span>
                <span className="text-gray-700">{verifyTarget.slug || '-'}</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              {verifyTarget.is_verified ? (
                <>승인을 취소하면 해당 사무소의 서브도메인이 비활성화되어 고객 접속이 차단됩니다.</>
              ) : (
                <>승인하면 서브도메인이 활성화되고, 가입자에게 안내 메일이 발송됩니다.</>
              )}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVerifyTarget(null)}
                disabled={verifyBusy}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmVerify}
                disabled={verifyBusy}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  verifyTarget.is_verified
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {verifyBusy && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" className="opacity-75" />
                  </svg>
                )}
                {verifyTarget.is_verified ? '승인 취소' : '승인하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
