import { useState, useEffect, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHomeFilterStore } from '@/stores/homeFilterStore'
import { useTenantStore } from '@/stores/tenantStore'
import { fetchProperties } from '@/api/properties'
import { fetchPublicRegionSettings } from '@/api/settings'
import type { RegionSetting } from '@/api/settings'
import type { Property, TransactionType } from '@/types/database'
import { PropertyCard } from './PropertyCard'
import { QuickSearchGrid } from './QuickSearchGrid'

const RegionMapCard = lazy(() => import('./RegionMapCard').then(m => ({ default: m.RegionMapCard })))

const dealTypeMap: Record<string, TransactionType> = { sale: 'sale', jeonse: 'jeonse', monthly: 'monthly' }

export function PropertyGrid() {
  const navigate = useNavigate()
  const { selectedCategory, selectedDealType } = useHomeFilterStore()
  const agentId = useTenantStore((s) => s.agentId)
  const [properties, setProperties] = useState<Property[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [regions, setRegions] = useState<RegionSetting[]>([])

  // Load region settings once
  useEffect(() => {
    fetchPublicRegionSettings(agentId ?? undefined).then(setRegions).catch(() => setRegions([]))
  }, [agentId])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const { data, total } = await fetchProperties({
          categoryId: selectedCategory || undefined,
          transactionType: selectedDealType ? dealTypeMap[selectedDealType] : undefined,
        }, 'newest', 1, 12, agentId ?? undefined)
        if (!cancelled) {
          setProperties(data)
          setTotal(total)
        }
      } catch {
        if (!cancelled) {
          setProperties([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()

    return () => { cancelled = true }
  }, [selectedCategory, selectedDealType, agentId])

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">지역별 인기 매물</h2>
      </div>

      {regions.length > 0 && (
        <Suspense fallback={<div className="mb-6 h-[220px] animate-pulse rounded-2xl bg-gray-100" />}>
          <div className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {regions.map((region) => (
              <RegionMapCard
                key={region.name}
                name={region.name}
                nameEn={region.nameEn}
                selected={false}
                onClick={() => navigate(`/search?region=${encodeURIComponent(region.name)}`)}
              />
            ))}
          </div>
        </Suspense>
      )}

      {/* 원클릭 조건별 검색 — 지도 바로 아래 */}
      <QuickSearchGrid />

      {/* 매물 리스트 */}
      <div className="mb-4 mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">추천 매물</h2>
        <span className="text-sm text-gray-500">{total}건</span>
      </div>

      {loading ? (
        <div className="rounded-xl bg-gray-50 py-16 text-center">
          <p className="text-gray-400">매물을 불러오는 중...</p>
        </div>
      ) : properties.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-gray-50 py-16 text-center">
          <p className="text-gray-400">해당 조건의 매물이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-400">다른 카테고리나 필터를 선택해보세요.</p>
        </div>
      )}
    </div>
  )
}
