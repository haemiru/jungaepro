import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Customer, CustomerType, CustomerSource } from '@/types/database'
import { fetchCustomers, updateCustomerType, getCustomerCountByType, createCustomer } from '@/api/customers'
import { customerTypeLabel, customerTypeColor, customerSourceLabel, formatRelativeTime } from '@/utils/format'
import { Button } from '@/components/common'
import toast from 'react-hot-toast'

type ViewMode = 'pipeline' | 'list'

const pipelineStages: CustomerType[] = ['lead', 'interest', 'consulting', 'contracting', 'completed']
const sourceOptions: { key: CustomerSource | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'inquiry', label: '문의접수' },
  { key: 'direct', label: '직접등록' },
  { key: 'referral', label: '소개' },
  { key: 'website', label: '웹사이트' },
]

const customerSourceOptions: { key: CustomerSource; label: string }[] = [
  { key: 'direct', label: '직접등록' },
  { key: 'inquiry', label: '문의접수' },
  { key: 'referral', label: '소개' },
  { key: 'website', label: '웹사이트' },
]

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [counts, setCounts] = useState<Record<CustomerType, number>>({ lead: 0, interest: 0, consulting: 0, contracting: 0, completed: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline')
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<CustomerSource | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<CustomerType | 'all'>('all')
  const [showAddModal, setShowAddModal] = useState(false)

  const load = useCallback(async () => {
    try {
      const [data, countData] = await Promise.all([
        fetchCustomers({ search: search || undefined, source: sourceFilter, customerType: typeFilter }),
        getCustomerCountByType(),
      ])
      setCustomers(data)
      setCounts(countData)
    } catch { /* ignore */ }
    setIsLoading(false)
  }, [search, sourceFilter, typeFilter])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const [data, countData] = await Promise.all([
          fetchCustomers({ search: search || undefined, source: sourceFilter, customerType: typeFilter }),
          getCustomerCountByType(),
        ])
        if (cancelled) return
        setCustomers(data)
        setCounts(countData)
      } catch { /* ignore */ } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [search, sourceFilter, typeFilter])

  const handleStageChange = async (customerId: string, newType: CustomerType) => {
    await updateCustomerType(customerId, newType)
    toast.success(`고객 단계를 "${customerTypeLabel[newType]}"(으)로 변경했습니다.`)
    void load()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">고객 관리 (CRM)</h1>
        <Button onClick={() => setShowAddModal(true)}>+ 고객 등록</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {pipelineStages.map((stage) => (
          <div key={stage} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
            <p className="text-xs text-gray-400">{customerTypeLabel[stage]}</p>
            <p className="mt-1 text-2xl font-bold">{counts[stage]}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명, 연락처, 이메일 검색"
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as CustomerSource | 'all')}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          {sourceOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {viewMode === 'list' && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CustomerType | 'all')}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="all">전체 단계</option>
            {pipelineStages.map((s) => <option key={s} value={s}>{customerTypeLabel[s]}</option>)}
          </select>
        )}
        <div className="flex rounded-lg border border-gray-200">
          <button
            onClick={() => setViewMode('pipeline')}
            className={`px-3 py-2 text-xs font-medium ${viewMode === 'pipeline' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
          >
            파이프라인
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-xs font-medium ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
          >
            리스트
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
      ) : viewMode === 'pipeline' ? (
        <PipelineView customers={customers} onStageChange={handleStageChange} />
      ) : (
        <ListView customers={customers} onStageChange={handleStageChange} />
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); void load() }}
        />
      )}
    </div>
  )
}

// ============================================================
// Pipeline (Kanban) View
// ============================================================
const PIPELINE_PAGE_SIZE = 20

function PipelineView({ customers, onStageChange }: { customers: Customer[]; onStageChange: (id: string, type: CustomerType) => void }) {
  const [expanded, setExpanded] = useState<Record<string, number>>({})

  const stageColors: Record<CustomerType, string> = {
    lead: 'border-t-gray-400',
    interest: 'border-t-blue-400',
    consulting: 'border-t-yellow-400',
    contracting: 'border-t-purple-400',
    completed: 'border-t-green-400',
  }

  return (
    <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-4">
      {pipelineStages.map((stage) => {
        const stageCustomers = customers.filter((c) => c.customer_type === stage)
        const visibleCount = expanded[stage] || PIPELINE_PAGE_SIZE
        const visible = stageCustomers.slice(0, visibleCount)
        const hasMore = stageCustomers.length > visibleCount

        return (
          <div key={stage} className="w-64 shrink-0">
            <div className={`mb-3 rounded-t-lg border-t-4 ${stageColors[stage]} bg-white px-3 py-2 shadow-sm ring-1 ring-gray-200`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{customerTypeLabel[stage]}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{stageCustomers.length}</span>
              </div>
            </div>
            <div className="space-y-2">
              {visible.map((c) => (
                <KanbanCard key={c.id} customer={c} onStageChange={onStageChange} />
              ))}
              {stageCustomers.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center text-xs text-gray-400">
                  고객 없음
                </div>
              )}
              {hasMore && (
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [stage]: visibleCount + PIPELINE_PAGE_SIZE }))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100"
                >
                  더보기 ({stageCustomers.length - visibleCount}명 남음)
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ customer: c, onStageChange }: { customer: Customer; onStageChange: (id: string, type: CustomerType) => void }) {
  const prefs = c.preferences as Record<string, string>
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
      <div className="flex items-start justify-between">
        <Link to={`/admin/customers/${c.id}`} className="text-sm font-semibold text-gray-800 hover:text-primary-700">
          {c.name}
        </Link>
        <div className="flex items-center gap-1">
          <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">{c.score}점</span>
        </div>
      </div>
      {prefs.propertyType && (
        <p className="mt-1 text-xs text-gray-500">{prefs.propertyType}{prefs.region ? ` · ${prefs.region}` : ''}</p>
      )}
      {prefs.priceRange && (
        <p className="text-xs text-gray-400">{prefs.priceRange}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{formatRelativeTime(c.updated_at)}</span>
        <select
          value={c.customer_type}
          onChange={(e) => onStageChange(c.id, e.target.value as CustomerType)}
          className="rounded border border-gray-200 px-1 py-0.5 text-[10px]"
        >
          {pipelineStages.map((s) => <option key={s} value={s}>{customerTypeLabel[s]}</option>)}
        </select>
      </div>
    </div>
  )
}

// ============================================================
// List (Table) View
// ============================================================
function ListView({ customers, onStageChange }: { customers: Customer[]; onStageChange: (id: string, type: CustomerType) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500">
            <th className="px-4 py-3">이름</th>
            <th className="px-4 py-3">연락처</th>
            <th className="hidden px-4 py-3 sm:table-cell">단계</th>
            <th className="hidden px-4 py-3 md:table-cell">소스</th>
            <th className="hidden px-4 py-3 lg:table-cell">선호조건</th>
            <th className="px-4 py-3">스코어</th>
            <th className="px-4 py-3">최근 활동</th>
            <th className="px-4 py-3">액션</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {customers.map((c) => {
            const prefs = c.preferences as Record<string, string>
            return (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/admin/customers/${c.id}`} className="font-medium text-gray-800 hover:text-primary-700">{c.name}</Link>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{c.phone}</td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <select
                    value={c.customer_type}
                    onChange={(e) => onStageChange(c.id, e.target.value as CustomerType)}
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${customerTypeColor[c.customer_type]}`}
                  >
                    {pipelineStages.map((s) => <option key={s} value={s}>{customerTypeLabel[s]}</option>)}
                  </select>
                </td>
                <td className="hidden px-4 py-3 text-xs text-gray-500 md:table-cell">{customerSourceLabel[c.source]}</td>
                <td className="hidden max-w-xs truncate px-4 py-3 text-xs text-gray-500 lg:table-cell">
                  {prefs.propertyType}{prefs.region ? ` · ${prefs.region}` : ''}{prefs.priceRange ? ` · ${prefs.priceRange}` : ''}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">{c.score}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{formatRelativeTime(c.updated_at)}</td>
                <td className="px-4 py-3">
                  <Link to={`/admin/customers/${c.id}`} className="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100">
                    상세
                  </Link>
                </td>
              </tr>
            )
          })}
          {customers.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-16 text-center text-sm text-gray-400">고객이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
// Add Customer Modal
// ============================================================
function AddCustomerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false)
  const [regionHint, setRegionHint] = useState('강남구, 서초구')
  const [specialtyHint, setSpecialtyHint] = useState('아파트, 오피스텔')

  useEffect(() => {
    import('@/api/settings').then(({ fetchRegionSettings }) => {
      fetchRegionSettings().then((regions) => {
        if (regions.length > 0) setRegionHint(regions.slice(0, 3).map((r: { name: string }) => r.name).join(', '))
      }).catch(() => {})
    })
    import('@/api/settings').then(({ fetchOfficeSettings }) => {
      fetchOfficeSettings().then((data) => {
        const specs = data?.specialties as string[] | undefined
        if (specs && specs.length > 0) setSpecialtyHint(specs.slice(0, 3).join(', '))
      }).catch(() => {})
    })
  }, [])

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    source: 'direct' as CustomerSource,
    customer_type: 'lead' as CustomerType,
    memo: '',
    region: '',
    propertyType: '',
    priceRange: '',
    area: '',
    prefNote: '',
  })

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('이름을 입력해주세요.'); return }
    if (!form.phone.trim()) { toast.error('연락처를 입력해주세요.'); return }
    setSaving(true)
    try {
      const preferences: Record<string, string> = {}
      if (form.region) preferences.region = form.region
      if (form.propertyType) preferences.propertyType = form.propertyType
      if (form.priceRange) preferences.priceRange = form.priceRange
      if (form.area) preferences.area = form.area
      if (form.prefNote) preferences.note = form.prefNote

      await createCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        source: form.source,
        customer_type: form.customer_type,
        preferences,
        memo: form.memo.trim() || undefined,
      })
      toast.success('고객이 등록되었습니다.')
      onCreated()
    } catch {
      toast.error('고객 등록에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">고객 등록</h2>
        <div className="mt-4 space-y-4">
          {/* 기본 정보 */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">이름 <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="홍길동" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">연락처 <span className="text-red-500">*</span></label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="010-0000-0000" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">이메일</label>
              <input value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="email@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">유입 경로</label>
              <select value={form.source} onChange={(e) => set('source', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                {customerSourceOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* 선호 조건 */}
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-500">선호 조건</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">선호 지역</label>
                <input value={form.region} onChange={(e) => set('region', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder={regionHint} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">매물 유형</label>
                <input value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder={specialtyHint} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">가격대</label>
                <input value={form.priceRange} onChange={(e) => set('priceRange', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="3억~5억" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">면적</label>
                <input value={form.area} onChange={(e) => set('area', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="25평~35평" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">비고</label>
              <textarea value={form.prefNote} onChange={(e) => set('prefNote', e.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="기타 특이사항, 요청사항 등" />
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">메모</label>
            <textarea value={form.memo} onChange={(e) => set('memo', e.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" placeholder="고객 관련 메모" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">취소</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            {saving ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}
