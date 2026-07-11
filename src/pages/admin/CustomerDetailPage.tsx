import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Customer, CustomerActivity, CustomerType, ActivityType } from '@/types/database'
import { fetchCustomerById, fetchCustomerActivities, updateCustomer, updateCustomerType, addCustomerActivity, updateCustomerActivity, deleteCustomerActivity } from '@/api/customers'
import { fetchPropertyById, fetchProperties } from '@/api/properties'
import { fetchInquiriesByPhone } from '@/api/inquiries'
import { generateContent, saveGenerationLog } from '@/api/gemini'
import { isFeatureInPlan } from '@/config/planFeatures'
import { useFeatureStore } from '@/stores/featureStore'
import type { Property } from '@/types/database'
import { customerTypeLabel, customerTypeColor, customerSourceLabel, activityTypeLabel, formatDateTime, formatRelativeTime, formatPrice } from '@/utils/format'
import { Button } from '@/components/common'
import toast from 'react-hot-toast'

type TabKey = 'profile' | 'activity' | 'matching' | 'memo' | 'analysis'
const tabs: { key: TabKey; label: string }[] = [
  { key: 'profile', label: '프로필' },
  { key: 'activity', label: '상담일지' },
  { key: 'matching', label: '매칭매물' },
  { key: 'analysis', label: '진성 분석' },
  { key: 'memo', label: '메모' },
]

const pipelineStages: CustomerType[] = ['lead', 'interest', 'consulting', 'contracting', 'completed']

export function CustomerDetailPage() {
  const { id } = useParams()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [activities, setActivities] = useState<CustomerActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('profile')
  const [propertyCache, setPropertyCache] = useState<Record<string, Property>>({})

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      fetchCustomerById(id),
      fetchCustomerActivities(id),
    ]).then(([cust, acts]) => {
      if (cancelled) return
      setCustomer(cust)
      setActivities(acts)

      const pids = [...new Set(acts.filter((a) => a.property_id).map((a) => a.property_id!))]
      for (const pid of pids) {
        fetchPropertyById(pid).then((p) => {
          if (p && !cancelled) setPropertyCache((prev) => ({ ...prev, [pid]: p }))
        }).catch(() => {})
      }
    })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const handleStageChange = async (type: CustomerType) => {
    if (!customer) return
    await updateCustomerType(customer.id, type)
    setCustomer((prev) => prev ? { ...prev, customer_type: type } : prev)
    toast.success(`단계를 "${customerTypeLabel[type]}"(으)로 변경했습니다.`)
  }

  const handleSaveMemo = async (newMemo: string) => {
    if (!customer) return
    await updateCustomer(customer.id, { memo: newMemo })
    setCustomer((prev) => prev ? { ...prev, memo: newMemo } : prev)
    toast.success('메모가 저장되었습니다.')
  }

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
  }

  if (!customer) {
    return <div className="py-20 text-center"><p className="text-gray-500">고객을 찾을 수 없습니다.</p><Link to="/admin/customers" className="mt-3 inline-block text-sm text-primary-600 hover:underline">목록으로</Link></div>
  }

  const prefs = customer.preferences as Record<string, string>

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/admin/customers" className="hover:text-gray-600">고객 관리</Link>
        <span>/</span>
        <span className="text-gray-600">{customer.name}</span>
      </div>

      {/* Header Card */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
              {customer.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{customer.name}</h1>
                <span className={`rounded-md px-2.5 py-0.5 text-xs font-semibold ${customerTypeColor[customer.customer_type]}`}>
                  {customerTypeLabel[customer.customer_type]}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-500">{customer.phone}{customer.email ? ` · ${customer.email}` : ''}</p>
              <p className="text-xs text-gray-400">{customerSourceLabel[customer.source]} · 등록 {formatRelativeTime(customer.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Score */}
            <div className="text-center">
              <p className="text-xs text-gray-400">스코어</p>
              <p className="text-2xl font-bold text-primary-700">{customer.score}</p>
            </div>
            {/* Stage dropdown */}
            <select
              value={customer.customer_type}
              onChange={(e) => handleStageChange(e.target.value as CustomerType)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {pipelineStages.map((s) => <option key={s} value={s}>{customerTypeLabel[s]}</option>)}
            </select>
            <Link to="/admin/customers" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
              목록보기
            </Link>
          </div>
        </div>

        {/* Score Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>스코어</span>
            <span>{customer.score}/200</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all"
              style={{ width: `${Math.min(100, (customer.score / 200) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="scrollbar-hide flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' && (
        <ProfileTab customer={customer} prefs={prefs}
          onUpdateBasic={async (data) => {
            await updateCustomer(customer.id, data)
            setCustomer((prev) => prev ? { ...prev, ...data } : prev)
            toast.success('기본 정보가 저장되었습니다.')
          }}
          onUpdatePrefs={async (newPrefs) => {
            await updateCustomer(customer.id, { preferences: newPrefs })
            setCustomer((prev) => prev ? { ...prev, preferences: newPrefs } : prev)
            toast.success('선호 조건이 저장되었습니다.')
          }}
        />
      )}
      {activeTab === 'activity' && (
        <ActivityTab
          customerId={customer.id}
          activities={activities}
          propertyCache={propertyCache}
          onActivityAdded={async () => {
            const [cust, acts] = await Promise.all([fetchCustomerById(customer.id), fetchCustomerActivities(customer.id)])
            if (cust) setCustomer(cust)
            setActivities(acts)
          }}
        />
      )}
      {activeTab === 'matching' && (
        <MatchingTab customer={customer} prefs={prefs} activities={activities} />
      )}
      {activeTab === 'analysis' && (
        isFeatureInPlan('sincerity_analysis', useFeatureStore.getState().plan)
          ? <AnalysisTab customer={customer} activities={activities} />
          : <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
              <p className="text-lg font-semibold text-gray-700">Basic 요금제 이상에서 사용 가능합니다</p>
              <p className="mt-2 text-sm text-gray-500">AI가 고객의 활동 데이터를 분석하여 진성도, 전환 확률, 추천 액션을 제공합니다.</p>
              <a href="/admin/settings/billing" className="mt-4 inline-block rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700">요금제 업그레이드</a>
            </div>
      )}
      {activeTab === 'memo' && (
        <MemoTab initialMemo={customer.memo ?? ''} onSave={handleSaveMemo} />
      )}
    </div>
  )
}

// ============================================================
// Profile Tab
// ============================================================
function ProfileTab({ customer, prefs, onUpdateBasic, onUpdatePrefs }: {
  customer: Customer; prefs: Record<string, string>;
  onUpdateBasic: (data: Partial<Customer>) => void;
  onUpdatePrefs: (prefs: Record<string, string>) => void;
}) {
  const [editingBasic, setEditingBasic] = useState(false)
  const [editBasic, setEditBasic] = useState({ name: '', phone: '', email: '' })
  const [editing, setEditing] = useState(false)
  const [editPrefs, setEditPrefs] = useState({ region: '', propertyType: '', priceRange: '', area: '', note: '' })
  const [regionHint, setRegionHint] = useState('강남구, 서초구')
  const [specialtyHint, setSpecialtyHint] = useState('아파트, 오피스텔')

  useEffect(() => {
    // Load region settings for placeholder
    import('@/api/settings').then(({ fetchRegionSettings }) => {
      fetchRegionSettings().then((regions) => {
        if (regions.length > 0) {
          setRegionHint(regions.slice(0, 3).map((r: { name: string }) => r.name).join(', '))
        }
      }).catch(() => {})
    })
    // Load specialties for placeholder
    import('@/api/settings').then(({ fetchOfficeSettings }) => {
      fetchOfficeSettings().then((data) => {
        const specs = data?.specialties as string[] | undefined
        if (specs && specs.length > 0) {
          setSpecialtyHint(specs.slice(0, 3).join(', '))
        }
      }).catch(() => {})
    })
  }, [])

  const prefFields = [
    { key: 'region', label: '선호 지역', placeholder: regionHint },
    { key: 'propertyType', label: '매물 유형', placeholder: specialtyHint },
    { key: 'priceRange', label: '가격대', placeholder: '3억~5억' },
    { key: 'area', label: '면적', placeholder: '25평~35평' },
  ]

  const startEdit = () => {
    setEditPrefs({
      region: prefs.region || '',
      propertyType: prefs.propertyType || '',
      note: prefs.note || '',
      priceRange: prefs.priceRange || '',
      area: prefs.area || '',
    })
    setEditing(true)
  }

  const handleSave = () => {
    const newPrefs: Record<string, string> = {}
    if (editPrefs.region.trim()) newPrefs.region = editPrefs.region.trim()
    if (editPrefs.propertyType.trim()) newPrefs.propertyType = editPrefs.propertyType.trim()
    if (editPrefs.priceRange.trim()) newPrefs.priceRange = editPrefs.priceRange.trim()
    if (editPrefs.area.trim()) newPrefs.area = editPrefs.area.trim()
    if (editPrefs.note.trim()) newPrefs.note = editPrefs.note.trim()
    onUpdatePrefs(newPrefs)
    setEditing(false)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">기본 정보</h3>
          {!editingBasic && (
            <button onClick={() => {
              setEditBasic({ name: customer.name, phone: customer.phone, email: customer.email || '' })
              setEditingBasic(true)
            }} className="text-xs font-medium text-primary-600 hover:text-primary-700">편집</button>
          )}
        </div>
        {editingBasic ? (
          <div className="space-y-3">
            {[
              { key: 'name', label: '이름' },
              { key: 'phone', label: '연락처' },
              { key: 'email', label: '이메일' },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-semibold text-primary-600">{f.label}</label>
                <input
                  value={editBasic[f.key as keyof typeof editBasic]}
                  onChange={(e) => setEditBasic((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditingBasic(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">취소</button>
              <button onClick={() => {
                if (!editBasic.name.trim()) { toast.error('이름을 입력해주세요.'); return }
                if (!editBasic.phone.trim()) { toast.error('연락처를 입력해주세요.'); return }
                onUpdateBasic({ name: editBasic.name.trim(), phone: editBasic.phone.trim(), email: editBasic.email.trim() || null })
                setEditingBasic(false)
              }} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700">저장</button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-300"><table className="w-full border-collapse text-sm">
            <tbody>
              {([
                ['이름', customer.name],
                ['연락처', customer.phone],
                ['이메일', customer.email || '-'],
                ['소스', customerSourceLabel[customer.source]],
                ['등록일', formatDateTime(customer.created_at)],
                ['최근 업데이트', formatDateTime(customer.updated_at)],
              ] as [string, string][]).map(([label, value]) => (
                <tr key={label} className="border-b border-gray-300 last:border-0">
                  <td className="w-32 border-r border-gray-300 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-primary-600">{label}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{value}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">선호 조건</h3>
          {!editing && (
            <button onClick={startEdit} className="text-xs font-medium text-primary-600 hover:text-primary-700">
              {Object.keys(prefs).length === 0 ? '+ 추가' : '편집'}
            </button>
          )}
        </div>
        {editing ? (
          <div className="space-y-3 p-5">
            {prefFields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs text-gray-400">{f.label}</label>
                <input
                  value={editPrefs[f.key as keyof typeof editPrefs]}
                  onChange={(e) => setEditPrefs((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs text-gray-400">비고</label>
              <textarea
                value={editPrefs.note}
                onChange={(e) => setEditPrefs((p) => ({ ...p, note: e.target.value }))}
                placeholder="기타 특이사항, 요청사항 등"
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">취소</button>
              <button onClick={handleSave} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700">저장</button>
            </div>
          </div>
        ) : Object.keys(prefs).length === 0 ? (
          <p className="p-5 text-sm text-gray-400">등록된 선호 조건이 없습니다.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-300"><table className="w-full border-collapse text-sm">
            <tbody>
              {prefFields.filter((f) => prefs[f.key]).map((f) => (
                <tr key={f.key} className="border-b border-gray-300 last:border-0">
                  <td className="w-32 border-r border-gray-300 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-primary-600">{f.label}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{prefs[f.key]}</td>
                </tr>
              ))}
              {prefs.note && (
                <tr className="border-b border-gray-300 last:border-0">
                  <td className="w-32 border-r border-gray-300 bg-gray-50 px-4 py-2.5 align-top text-xs font-semibold text-primary-600">비고</td>
                  <td className="whitespace-pre-wrap px-4 py-2.5 font-medium text-gray-800">{prefs.note}</td>
                </tr>
              )}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Score Breakdown */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200 lg:col-span-2">
        <h3 className="mb-4 text-sm font-semibold">스코어 산정 기준</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {([
            ['문의 접수', '+10점'],
            ['전화 상담', '+10점'],
            ['방문 상담', '+20점'],
            ['현장 안내', '+30점'],
            ['계약 상담', '+40점'],
          ] as [string, string][]).map(([label, score]) => (
            <div key={label} className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-xs text-gray-400">{label}</p>
              <p className="mt-1 text-sm font-bold text-primary-700">{score}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Activity (Consultation Log) Tab — 개공이 직접 기록하는 상담일지
// ============================================================
const consultTypes: { key: ActivityType; label: string; icon: string }[] = [
  { key: 'phone_call', label: '전화 상담', icon: '📞' },
  { key: 'visit', label: '방문 상담', icon: '🏢' },
  { key: 'site_tour', label: '현장 안내', icon: '🏠' },
  { key: 'contract_consult', label: '계약 상담', icon: '📝' },
  { key: 'other', label: '기타', icon: '📋' },
]

const activityIcons: Record<string, string> = {
  inquiry: '📩',
  phone_call: '📞',
  visit: '🏢',
  site_tour: '🏠',
  contract_consult: '📝',
  other: '📋',
}

function ActivityTab({ customerId, activities, propertyCache, onActivityAdded }: {
  customerId: string
  activities: CustomerActivity[]
  propertyCache: Record<string, Property>
  onActivityAdded: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<ActivityType>('phone_call')
  const [formMemo, setFormMemo] = useState('')
  const [formDatetime, setFormDatetime] = useState('')
  const [formPropertyId, setFormPropertyId] = useState<string | null>(null)
  const [propertySearch, setPropertySearch] = useState('')
  const [propertyResults, setPropertyResults] = useState<Property[]>([])
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const nowDatetimeLocal = () => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  }

  // Property search with debounce
  useEffect(() => {
    if (!propertySearch.trim()) { setPropertyResults([]); return }
    const timer = setTimeout(() => {
      fetchProperties({ search: propertySearch, status: 'active' }, 'newest', 1, 5)
        .then(({ data }) => setPropertyResults(data))
        .catch(() => setPropertyResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [propertySearch])

  const handleAdd = async () => {
    if (!formMemo.trim()) { toast.error('내용을 입력해주세요.'); return }
    setIsSaving(true)
    try {
      await addCustomerActivity({
        customer_id: customerId,
        activity_type: formType,
        property_id: formPropertyId ?? undefined,
        metadata: { memo: formMemo.trim() },
        created_at: formDatetime ? new Date(formDatetime).toISOString() : undefined,
      })
      toast.success('상담 기록이 추가되었습니다.')
      setFormMemo('')
      setFormPropertyId(null)
      setSelectedProperty(null)
      setPropertySearch('')
      setShowForm(false)
      onActivityAdded()
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">상담일지</h3>
          {!showForm && (
            <button
              onClick={() => { setFormDatetime(nowDatetimeLocal()); setShowForm(true) }}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
            >
              + 상담 기록 추가
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <div className="mb-5 rounded-lg border border-primary-200 bg-primary-50/30 p-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {consultTypes.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFormType(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    formType === t.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">상담 일시</label>
                <input
                  type="datetime-local"
                  value={formDatetime}
                  onChange={(e) => setFormDatetime(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
              <div className="relative flex-1">
                <label className="mb-1 block text-xs text-gray-500">관련 매물 (선택)</label>
                {selectedProperty ? (
                  <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5">
                    <span className="flex-1 truncate text-sm text-primary-700">{selectedProperty.title}</span>
                    <button onClick={() => { setSelectedProperty(null); setFormPropertyId(null); setPropertySearch('') }} className="text-xs text-gray-400 hover:text-red-500">✕</button>
                  </div>
                ) : (
                  <>
                    <input
                      value={propertySearch}
                      onChange={(e) => setPropertySearch(e.target.value)}
                      placeholder="매물명 또는 주소 검색..."
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    {propertyResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {propertyResults.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => { setFormPropertyId(p.id); setSelectedProperty(p); setPropertySearch(''); setPropertyResults([]) }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            <span className="flex-1 truncate font-medium">{p.title}</span>
                            <span className="shrink-0 text-xs text-gray-400">{p.address}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <textarea
              value={formMemo}
              onChange={(e) => { if (e.target.value.length <= 500) setFormMemo(e.target.value) }}
              placeholder="상담 내용을 기록하세요..."
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <div className="mt-1 text-right text-xs text-gray-400">{formMemo.length}/500</div>
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setFormMemo(''); setFormDatetime(''); setFormPropertyId(null); setSelectedProperty(null); setPropertySearch('') }} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">취소</button>
              <button onClick={handleAdd} disabled={isSaving} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        {activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">상담 기록이 없습니다.</p>
        ) : (
          <div className="relative space-y-4 pl-6">
            <div className="absolute bottom-0 left-2.5 top-0 w-px bg-gray-200" />

            {activities.map((act) => (
              <ActivityItem
                key={act.id}
                activity={act}
                property={act.property_id ? propertyCache[act.property_id] : null}
                onUpdated={onActivityAdded}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 상담 기록 (Activity)
// ============================================================
/** 개별 상담 기록 항목 — 보기/편집/삭제 */
function ActivityItem({ activity: act, property: prop, onUpdated }: {
  activity: CustomerActivity
  property: Property | null
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editType, setEditType] = useState(act.activity_type)
  const [editMemo, setEditMemo] = useState('')
  const [editDatetime, setEditDatetime] = useState('')
  const [editPropertyId, setEditPropertyId] = useState<string | null>(act.property_id)
  const [editSelectedProperty, setEditSelectedProperty] = useState<Property | null>(prop)
  const [editPropertySearch, setEditPropertySearch] = useState('')
  const [editPropertyResults, setEditPropertyResults] = useState<Property[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const toLocalDatetime = (iso: string) => {
    const d = new Date(iso)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  }

  // Property search for edit mode
  useEffect(() => {
    if (!editing || !editPropertySearch.trim()) { setEditPropertyResults([]); return }
    const timer = setTimeout(() => {
      fetchProperties({ search: editPropertySearch, status: 'active' }, 'newest', 1, 5)
        .then(({ data }) => setEditPropertyResults(data))
        .catch(() => setEditPropertyResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [editing, editPropertySearch])

  const startEdit = () => {
    const memo = (act.metadata as Record<string, unknown>)?.memo as string || ''
    setEditMemo(memo)
    setEditType(act.activity_type)
    setEditDatetime(toLocalDatetime(act.created_at))
    setEditPropertyId(act.property_id)
    setEditSelectedProperty(prop)
    setEditPropertySearch('')
    setEditing(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateCustomerActivity(act.id, {
        activity_type: editType,
        property_id: editPropertyId,
        metadata: { ...(act.metadata as Record<string, unknown>), memo: editMemo.trim() },
        created_at: new Date(editDatetime).toISOString(),
      })
      toast.success('수정되었습니다.')
      setEditing(false)
      onUpdated()
    } catch {
      toast.error('수정에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 상담 기록을 삭제하시겠습니까?')) return
    try {
      await deleteCustomerActivity(act.id)
      toast.success('삭제되었습니다.')
      onUpdated()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  const memo = (act.metadata as Record<string, unknown>)?.memo as string | undefined

  if (editing) {
    return (
      <div className="relative">
        <div className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-xs ring-2 ring-primary-300">✏️</div>
        <div className="rounded-lg border border-primary-200 bg-primary-50/30 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {consultTypes.map((t) => (
              <button
                key={t.key}
                onClick={() => setEditType(t.key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  editType === t.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <div className="mb-2 flex flex-wrap gap-3">
            <div>
              <input
                type="datetime-local"
                value={editDatetime}
                onChange={(e) => setEditDatetime(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
            <div className="relative flex-1">
              <label className="mb-1 block text-xs text-gray-500">관련 매물</label>
              {editSelectedProperty ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5">
                  <span className="flex-1 truncate text-sm text-primary-700">{editSelectedProperty.title}</span>
                  <button onClick={() => { setEditSelectedProperty(null); setEditPropertyId(null); setEditPropertySearch('') }} className="text-xs text-gray-400 hover:text-red-500">✕</button>
                </div>
              ) : (
                <>
                  <input
                    value={editPropertySearch}
                    onChange={(e) => setEditPropertySearch(e.target.value)}
                    placeholder="매물명 또는 주소 검색..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  />
                  {editPropertyResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {editPropertyResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setEditPropertyId(p.id); setEditSelectedProperty(p); setEditPropertySearch(''); setEditPropertyResults([]) }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="flex-1 truncate font-medium">{p.title}</span>
                          <span className="shrink-0 text-xs text-gray-400">{p.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <textarea
            value={editMemo}
            onChange={(e) => { if (e.target.value.length <= 500) setEditMemo(e.target.value) }}
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-gray-400">{editMemo.length}/500</span>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100">취소</button>
              <button onClick={handleSave} disabled={isSaving} className="rounded-lg bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group relative">
      <div className="absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs ring-2 ring-gray-200">
        {activityIcons[act.activity_type] || '•'}
      </div>
      <div>
        <div className="flex items-start justify-between">
          <p className="text-sm text-gray-700">
            <span className="font-medium">{activityTypeLabel[act.activity_type]}</span>
            {prop && (
              <Link to={`/admin/properties/${prop.id}`} className="ml-1 text-primary-600 hover:underline">
                {prop.title}
              </Link>
            )}
          </p>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={startEdit} className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-primary-600">수정</button>
            <button onClick={handleDelete} className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-red-50 hover:text-red-500">삭제</button>
          </div>
        </div>
        {memo && <p className="mt-0.5 text-sm text-gray-600">{memo}</p>}
        <p className="mt-0.5 text-xs text-gray-400">{formatDateTime(act.created_at)}</p>
      </div>
    </div>
  )
}

function MatchingTab({ customer, prefs, activities }: { customer: Customer; prefs: Record<string, string>; activities: CustomerActivity[] }) {
  const [interestProperties, setInterestProperties] = useState<Property[]>([])
  const [recommendedProperties, setRecommendedProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      // 1. 관심 매물: 문의 연결 매물 + 상담일지 태그 매물
      const propertyIds = new Set<string>()

      // 문의에서 연결된 매물
      try {
        const inquiries = await fetchInquiriesByPhone(customer.phone)
        for (const inq of inquiries) {
          if (inq.property_id) propertyIds.add(inq.property_id)
        }
      } catch { /* ignore */ }

      // 상담일지에서 태그된 매물
      for (const act of activities) {
        if (act.property_id) propertyIds.add(act.property_id)
      }

      const interestList: Property[] = []
      for (const pid of propertyIds) {
        try {
          const p = await fetchPropertyById(pid)
          if (p && !cancelled) interestList.push(p)
        } catch { /* ignore */ }
      }

      // 2. 추천 매물: 선호조건 기반 검색
      let recommended: Property[] = []
      if (prefs.region || prefs.propertyType) {
        try {
          const { data } = await fetchProperties(
            { search: prefs.region || undefined, status: 'active' },
            'newest', 1, 10,
          )
          // 관심 매물과 중복 제거
          recommended = data.filter((p) => !propertyIds.has(p.id))
        } catch { /* ignore */ }
      }

      if (!cancelled) {
        setInterestProperties(interestList)
        setRecommendedProperties(recommended)
        setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [customer.phone, activities, prefs])

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
  }

  return (
    <div className="space-y-6">
      {/* 관심 매물 */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h3 className="mb-4 text-sm font-semibold">🏷️ 관심 매물</h3>
        <p className="mb-3 text-xs text-gray-400">문의 시 연결된 매물 + 상담 중 태그한 매물</p>
        {interestProperties.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">관심 매물이 없습니다.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {interestProperties.map((p) => (
              <PropertyMiniCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </div>

      {/* 추천 매물 */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h3 className="mb-4 text-sm font-semibold">✨ 선호조건 기반 추천</h3>
        <div className="mb-3 flex flex-wrap gap-2">
          {prefs.region && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-600">{prefs.region}</span>}
          {prefs.propertyType && <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-600">{prefs.propertyType}</span>}
          {prefs.priceRange && <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-600">{prefs.priceRange}</span>}
          {prefs.area && <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-600">{prefs.area}</span>}
        </div>
        {!prefs.region && !prefs.propertyType ? (
          <p className="py-6 text-center text-sm text-gray-400">선호 조건을 등록하면 매칭 매물이 표시됩니다.</p>
        ) : recommendedProperties.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">조건에 맞는 매물이 없습니다.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendedProperties.map((p) => (
              <PropertyMiniCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** 매물 미니 카드 — 매칭매물 탭 전용 */
function PropertyMiniCard({ property: p }: { property: Property }) {
  const thumb = p.photos?.[0]
  const price = p.transaction_type === 'sale'
    ? formatPrice(p.sale_price)
    : p.transaction_type === 'jeonse'
      ? formatPrice(p.deposit)
      : p.deposit && p.monthly_rent
        ? `${formatPrice(p.deposit)} / 월${formatPrice(p.monthly_rent)}`
        : formatPrice(p.monthly_rent)
  const txLabel = { sale: '매매', jeonse: '전세', monthly: '월세' }[p.transaction_type] || ''

  return (
    <Link
      to={`/admin/properties/${p.id}`}
      className="flex gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-primary-300 hover:bg-primary-50/30"
    >
      {thumb ? (
        <img src={thumb} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-gray-100 text-lg text-gray-300">🏠</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-800">{p.title}</p>
        <p className="truncate text-xs text-gray-500">{p.address}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">{txLabel}</span>
          <span className="text-xs font-medium text-gray-700">{price}</span>
          {p.exclusive_area_m2 && <span className="text-xs text-gray-400">{p.exclusive_area_m2}㎡</span>}
        </div>
      </div>
    </Link>
  )
}


// ============================================================
// AI Analysis Tab
// ============================================================
function AnalysisTab({ customer, activities }: { customer: Customer; activities: CustomerActivity[] }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setAnalysisResult(null)

    try {
      const prefs = customer.preferences as Record<string, string>

      // Aggregate activity data
      const activitySummary = activities.reduce<Record<string, number>>((acc, act) => {
        acc[act.activity_type] = (acc[act.activity_type] || 0) + 1
        return acc
      }, {})

      // Collect consultation memos for richer analysis
      const recentMemos = activities.slice(0, 10).map((a) => {
        const m = (a.metadata as Record<string, unknown>)?.memo as string | undefined
        return m ? `[${activityTypeLabel[a.activity_type]}] ${m}` : null
      }).filter(Boolean)

      const prompt = `아래 고객 데이터를 분석하여 진성 고객 분석 리포트를 작성해주세요.

고객 정보:
- 이름: ${customer.name}
- 현재 단계: ${customerTypeLabel[customer.customer_type]}
- 스코어: ${customer.score}점
- 소스: ${customerSourceLabel[customer.source]}
- 등록일: ${customer.created_at}
- 최근 업데이트: ${customer.updated_at}
- 선호 조건: ${Object.entries(prefs).map(([k, v]) => `${k}: ${v}`).join(', ') || '없음'}
- 메모: ${customer.memo || '없음'}

상담 기록 집계:
${Object.entries(activitySummary).map(([type, count]) => `- ${activityTypeLabel[type]}: ${count}회`).join('\n')}
- 총 상담: ${activities.length}건
- 첫 상담: ${activities.length > 0 ? activities[activities.length - 1].created_at : '없음'}
- 최근 상담: ${activities.length > 0 ? activities[0].created_at : '없음'}
${recentMemos.length > 0 ? `\n최근 상담 내용:\n${recentMemos.join('\n')}` : ''}

분석 결과를 다음 형식으로 작성해주세요:

## 진성도 스코어: __/100점
## 계약전환확률: __%

## 추정 프로필
- 추정 연령대: (신뢰도 %)
- 추정 목적: (신뢰도 %)
- 추정 가족구성: (신뢰도 %)
- 추정 예산: (신뢰도 %)
- 관심 지역: (신뢰도 %)

## 상담 패턴 분석
(상담 기록 기반 분석 3-5개)

## AI 추천 액션
1. (구체적 액션)
2. (구체적 액션)
3. (구체적 액션)`

      const systemPrompt = '당신은 부동산 CRM 분석 전문가입니다. 고객 행동 데이터를 분석하여 진성 고객 여부를 판단하고, 계약 전환 가능성을 예측합니다. 객관적이고 데이터에 근거한 분석을 제공하세요.'

      const text = await generateContent(prompt, systemPrompt)
      setAnalysisResult(text)

      await saveGenerationLog({
        type: 'customer_analysis',
        input_data: { customer_id: customer.id, customer_name: customer.name },
        output_text: text,
      })

      toast.success('AI 분석이 완료되었습니다.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI 분석 중 오류가 발생했습니다.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">AI 고객 성향 분석</h3>
          <Button size="sm" onClick={handleAnalyze} isLoading={isAnalyzing}>
            {isAnalyzing ? '분석 중...' : '분석 실행'}
          </Button>
        </div>

        {!analysisResult && !isAnalyzing && (
          <div className="flex h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
            <div className="text-center">
              <p className="text-3xl">🧠</p>
              <p className="mt-2 text-sm text-gray-500">AI가 고객의 활동 이력과 선호 조건을 분석하여</p>
              <p className="text-sm text-gray-500">진성도, 계약전환확률, 추천 액션을 제공합니다.</p>
              <button
                onClick={handleAnalyze}
                className="mt-3 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                분석 시작하기
              </button>
            </div>
          </div>
        )}

        {analysisResult && (
          <div className="space-y-4">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {analysisResult}
            </div>

            {/* 맞춤 매물 추천 발송·상담 스크립트 생성 버튼은 기능 구현 후 노출 */}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Memo Tab
// ============================================================
function MemoTab({ initialMemo, onSave }: { initialMemo: string; onSave: (memo: string) => void }) {
  const [memo, setMemo] = useState(initialMemo)

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      <h3 className="mb-4 text-sm font-semibold">내부 메모</h3>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={8}
        placeholder="고객에 대한 내부 메모를 입력하세요..."
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={() => onSave(memo)}>메모 저장</Button>
      </div>
    </div>
  )
}
