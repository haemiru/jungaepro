import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Property } from '@/types/database'
import { fetchPropertyById } from '@/api/properties'
import { useTenantStore } from '@/stores/tenantStore'
import { useCategories } from '@/hooks/useCategories'
import { formatPropertyPrice, formatPrice, transactionTypeLabel, formatPhone, parsePhone } from '@/utils/format'
import { getInfoFieldsForCategory } from '@/utils/propertyInfoFields'
import { formatAreaByUnit } from '@/utils/areaFormat'
import { Button, Input } from '@/components/common'
import { AreaUnitToggle } from '@/components/common/AreaUnitToggle'
import { useAreaUnitStore } from '@/stores/areaUnitStore'
import { KakaoMap } from '@/components/common/KakaoMap'
import { Modal } from '@/components/common/Modal'
import { createInquiry } from '@/api/inquiries'
import { addFavorite, removeFavorite, checkIsFavorite } from '@/api/favorites'
import { useAuthStore } from '@/stores/authStore'
import { isFeatureInPlan } from '@/config/planFeatures'
import { NearbyTradePrice } from '@/components/property/NearbyTradePrice'
import type { InquiryType } from '@/types/database'
import toast from 'react-hot-toast'

export function PropertyDetailPage() {
  const { id } = useParams()
  const { findCategory } = useCategories()
  // Subscribe to area unit changes so info fields re-render
  useAreaUnitStore((s) => s.unit)
  const tenant = useTenantStore((s) => s.tenant)
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [isInquiryOpen, setIsInquiryOpen] = useState(false)
  const [isFav, setIsFav] = useState(false)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetchPropertyById(id)
      .then((p) => { if (!cancelled) setProperty(p) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    if (!id || !user) return
    checkIsFavorite(id).then(setIsFav).catch(() => {})
  }, [id, user])

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
  }

  if (!property) {
    return <div className="py-20 text-center"><p className="text-gray-500">매물을 찾을 수 없습니다.</p><Link to="/search" className="mt-3 inline-block text-sm text-primary-600 hover:underline">검색으로 돌아가기</Link></div>
  }

  const p = property
  const cat = findCategory(p.category_id)
  const photos = p.photos?.length ? p.photos : ['https://placehold.co/800x600/e2e8f0/94a3b8?text=No+Image']

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
        <Link to="/" className="hover:text-gray-600">홈</Link>
        <span>/</span>
        <Link to="/search" className="hover:text-gray-600">매물검색</Link>
        <span>/</span>
        <span className="text-gray-600">{p.title}</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left: Photos + Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Photo Gallery */}
          <div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-gray-100">
              <img src={photos[currentPhoto]} alt={p.title} className="h-full w-full object-cover" />
              {photos.length > 1 && (
                <>
                  <button onClick={() => setCurrentPhoto((c) => (c - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={() => setCurrentPhoto((c) => (c + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                  <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1 text-xs text-white">{currentPhoto + 1} / {photos.length}</div>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {photos.map((url, i) => (
                  <button key={i} onClick={() => setCurrentPhoto(i)} className={`h-16 w-20 shrink-0 overflow-hidden rounded-lg ${i === currentPhoto ? 'ring-2 ring-primary-500' : 'opacity-70'}`}>
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title & Price */}
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${p.transaction_type === 'sale' ? 'bg-blue-100 text-blue-700' : p.transaction_type === 'jeonse' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                {transactionTypeLabel[p.transaction_type]}
              </span>
              {cat && <span className="text-sm text-gray-500">{cat.icon} {cat.name}</span>}
              {p.is_urgent && <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">급매</span>}
            </div>
            <h1 className="mt-2 text-2xl font-bold">{p.title}</h1>
            <p className="mt-1 text-sm text-gray-500">{p.address}</p>
            <p className="mt-3 text-3xl font-bold text-primary-700">
              {formatPropertyPrice(p.transaction_type, p.sale_price, p.deposit, p.monthly_rent)}
            </p>
            {p.maintenance_fee && <p className="mt-1 text-sm text-gray-500">관리비 {formatPrice(p.maintenance_fee)}</p>}
          </div>

          {/* Info Table */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold">기본 정보</h2>
              <AreaUnitToggle />
            </div>
            <div className="grid grid-cols-2 gap-px bg-gray-100 sm:grid-cols-3">
              {getInfoFieldsForCategory(cat?.name)
                .filter((field) => field.key !== 'buildings_detail')
                .map((field) => (
                <div key={field.key} className="bg-white px-5 py-3">
                  <p className="text-xs text-gray-400">{field.label}</p>
                  <p className="mt-0.5 text-sm font-medium">{field.getValue(p)}</p>
                </div>
              ))}
            </div>
            {/* 공장/창고 복수 건물 상세 */}
            {p.extra_info?.buildings && p.extra_info.buildings.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-3">
                <p className="mb-2 text-xs text-gray-400">건물 상세</p>
                <div className="space-y-2">
                  {p.extra_info.buildings.map((b, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span className="font-medium text-gray-700">{b.name || `건물 ${i + 1}`}</span>
                      <span className="text-gray-500">{formatAreaByUnit(b.building_area_m2)}</span>
                      {b.gross_floor_area_m2 && <span className="text-gray-500">연면적 {formatAreaByUnit(b.gross_floor_area_m2)}</span>}
                      {b.ceiling_height && <span className="text-gray-500">층고 {b.ceiling_height}m</span>}
                      {b.building_structure && <span className="text-gray-500">{b.building_structure}</span>}
                      {b.floors && <span className="text-gray-500">{b.floors}층</span>}
                      {b.built_year && <span className="text-gray-500">준공 {b.built_year}</span>}
                      {b.usage && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">{b.usage}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {p.options && p.options.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-3">
                <p className="text-xs text-gray-400">옵션</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.options.map((opt) => <span key={opt} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{opt}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {p.description && (
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <h2 className="mb-3 text-sm font-semibold">상세 설명</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{p.description}</p>
            </div>
          )}

          {/* Map */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-3 text-sm font-semibold">위치 정보</h2>
            {p.latitude && p.longitude ? (
              <KakaoMap latitude={p.latitude} longitude={p.longitude} readOnly />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50">
                <p className="text-sm text-gray-400">{p.address}</p>
              </div>
            )}
          </div>

          {/* 주변 시세 (국토부 실거래가) */}
          <NearbyTradePrice property={p} categoryName={cat?.name} />
        </div>

        {/* Right: Agent Card + Actions (sticky) */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            {/* Agent Card */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
                  {tenant?.office_name?.[0] ?? 'S'}
                </div>
                <div>
                  <p className="font-semibold">{tenant?.office_name ?? '중개사무소'}</p>
                  <p className="text-xs text-gray-500">{tenant?.address ?? ''}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-400">대표: {tenant?.representative ?? '-'} · 연락처: {tenant?.phone ?? '-'}</p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button className="w-full" onClick={() => setIsInquiryOpen(true)}>
                🔥 이 매물 문의하기
              </Button>
              <Button variant="outline" className="w-full" onClick={() => {
                if (!isFeatureInPlan('inspection_booking', (tenant?.subscription_plan ?? 'free') as import('@/types/database').PlanType)) {
                  toast('Basic 플랜에서 사용 가능한 기능입니다.', { icon: '🔒' })
                  return
                }
                toast('임장 예약 기능 준비 중입니다.')
              }}>
                📅 임장 예약
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={async () => {
                  if (!user) { toast.error('로그인이 필요합니다.'); return }
                  try {
                    if (isFav) {
                      await removeFavorite(property.id)
                      setIsFav(false)
                      toast.success('관심 매물에서 삭제했습니다.')
                    } else {
                      await addFavorite(property.id)
                      setIsFav(true)
                      toast.success('관심 매물에 저장했습니다.')
                    }
                  } catch { toast.error('처리에 실패했습니다.') }
                }}>{isFav ? '💔 관심 해제' : '❤️ 관심 저장'}</Button>
                <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('링크가 복사되었습니다.') }}>🔗 공유하기</Button>
              </div>
            </div>

            {/* Tags */}
            {p.tags && p.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {p.tags.map((tag) => <span key={tag} className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">#{tag}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inquiry Modal */}
      <PropertyInquiryModal isOpen={isInquiryOpen} onClose={() => setIsInquiryOpen(false)} property={p} />
    </div>
  )
}

function PropertyInquiryModal({ isOpen, onClose, property }: { isOpen: boolean; onClose: () => void; property: Property }) {
  const [form, setForm] = useState({ name: '', phone: '', inquiryType: '', visitDate: '', content: '', privacy: false })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.privacy) { toast.error('개인정보 수집에 동의해주세요.'); return }
    setIsSubmitting(true)
    const typeMap: Record<string, InquiryType> = { buy: 'property', rent: 'property', price: 'price', other: 'other' }
    const inquiry = await createInquiry({
      name: form.name,
      phone: form.phone,
      inquiry_type: typeMap[form.inquiryType] ?? 'property',
      property_id: property.id,
      preferred_visit_date: form.visitDate || undefined,
      content: form.content,
    })
    setIsSubmitting(false)
    toast.success(`문의가 접수되었습니다. 접수번호: ${inquiry.inquiry_number}`)
    setForm({ name: '', phone: '', inquiryType: '', visitDate: '', content: '', privacy: false })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="매물 문의하기" size="md">
      {/* Auto-attached property info */}
      <div className="mb-4 rounded-lg bg-gray-50 p-3">
        <p className="text-sm font-medium">{property.title}</p>
        <p className="text-xs text-gray-500">{property.address} · {formatPropertyPrice(property.transaction_type, property.sale_price, property.deposit, property.monthly_rent)}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="inq-name" label="이름 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input id="inq-phone" label="연락처 *" type="tel" value={formatPhone(form.phone)} onChange={(e) => setForm({ ...form, phone: parsePhone(e.target.value) })} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">문의유형</label>
            <select value={form.inquiryType} onChange={(e) => setForm({ ...form, inquiryType: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">선택</option>
              <option value="buy">매수희망</option>
              <option value="rent">임차희망</option>
              <option value="price">시세문의</option>
              <option value="other">기타</option>
            </select>
          </div>
          <Input id="inq-visit" label="희망 방문일" type="date" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">문의내용</label>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="문의하실 내용을 입력하세요" />
        </div>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={form.privacy} onChange={(e) => setForm({ ...form, privacy: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600" />
          <span className="text-xs text-gray-500">개인정보 수집 및 이용에 동의합니다.</span>
        </label>
        <Button type="submit" className="w-full" isLoading={isSubmitting}>문의 접수하기</Button>
      </form>
    </Modal>
  )
}
