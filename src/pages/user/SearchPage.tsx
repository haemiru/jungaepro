import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Property, TransactionType } from '@/types/database'
import { fetchProperties, type SortOption, type PropertyFilters } from '@/api/properties'
import { fetchSearchSettings, type QuickSearchCard } from '@/api/settings'
import { resolveConditions, type ResolvedConditions } from '@/utils/conditionResolver'
import { useCategories } from '@/hooks/useCategories'
import { useTenantStore } from '@/stores/tenantStore'
import { formatPropertyPrice, transactionTypeLabel } from '@/utils/format'
import { useFormatArea } from '@/utils/areaFormat'

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '최신등록순' },
  { value: 'price_asc', label: '가격낮은순' },
  { value: 'price_desc', label: '가격높은순' },
  { value: 'area_desc', label: '면적순' },
  { value: 'popular', label: '인기순' },
]

const directionOptions = ['남향', '남동향', '남서향', '동향', '서향', '북향']

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { categories } = useCategories()
  const agentId = useTenantStore((s) => s.agentId)
  const [properties, setProperties] = useState<Property[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

  // Quick search state
  const [activeQuickCard, setActiveQuickCard] = useState<QuickSearchCard | null>(null)
  const [resolvedQuick, setResolvedQuick] = useState<ResolvedConditions | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [txType, setTxType] = useState<TransactionType | ''>('')
  const [sort, setSort] = useState<SortOption>('newest')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minArea, setMinArea] = useState('')
  const [maxArea, setMaxArea] = useState('')
  const [rooms, setRooms] = useState('')
  const [direction, setDirection] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const pageSize = 12
  const totalPages = Math.ceil(total / pageSize)

  // Region filter from URL
  const activeRegion = searchParams.get('region')

  // Resolve quick search param on mount
  useEffect(() => {
    const quickKey = searchParams.get('quick')
    if (!quickKey) {
      setActiveQuickCard(null)
      setResolvedQuick(null)
      return
    }

    fetchSearchSettings()
      .then((settings) => {
        const card = settings.quick_cards.find((c) => c.key === quickKey)
        if (!card) return
        setActiveQuickCard(card)
        const resolved = resolveConditions(card.conditions, card.label, card.is_custom)
        setResolvedQuick(resolved)
      })
      .catch(() => {})
  }, [searchParams])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const filters: PropertyFilters = {
        search: search || undefined,
        categoryId: categoryId || undefined,
        transactionType: (txType as TransactionType) || undefined,
        minPrice: minPrice ? parseInt(minPrice) : undefined,
        maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
        minArea: minArea ? parseFloat(minArea) : undefined,
        maxArea: maxArea ? parseFloat(maxArea) : undefined,
        rooms: rooms ? parseInt(rooms) : undefined,
        direction: direction || undefined,
        addressSearch: activeRegion || undefined,
      }

      // Merge quick search filters
      if (resolvedQuick) {
        Object.assign(filters, resolvedQuick.filters)
        if (resolvedQuick.tags.length > 0) {
          filters.tags = [...(filters.tags || []), ...resolvedQuick.tags]
        }
      }

      const res = await fetchProperties(filters, sort, page, pageSize, agentId ?? undefined)

      // Apply client-side filters (e.g. top floor)
      let data = res.data
      if (resolvedQuick?.clientFilters.length) {
        data = data.filter((p) => resolvedQuick.clientFilters.every((fn) => fn(p)))
      }

      setProperties(data)
      setTotal(resolvedQuick?.clientFilters.length ? data.length : res.total)
    } catch {
      setProperties([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [search, categoryId, txType, sort, page, minPrice, maxPrice, minArea, maxArea, rooms, direction, resolvedQuick, activeRegion, agentId])

  useEffect(() => { void load() }, [load])

  // Reset page to 1 when filters change
  const isFirstRender = useState(() => ({ current: true }))[0]
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, txType, sort, minPrice, maxPrice, minArea, maxArea, rooms, direction, resolvedQuick, activeRegion])

  const clearQuickSearch = () => {
    setSearchParams({})
    setActiveQuickCard(null)
    setResolvedQuick(null)
  }

  const clearRegion = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('region')
    setSearchParams(next)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Active Quick Search Banner */}
      {activeQuickCard && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3 ring-1 ring-primary-200">
          <span className="text-2xl">{activeQuickCard.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-primary-800">{activeQuickCard.label} 검색 중</p>
            {activeQuickCard.description && (
              <p className="text-xs text-primary-600">{activeQuickCard.description}</p>
            )}
          </div>
          <button
            onClick={clearQuickSearch}
            className="shrink-0 rounded-lg border border-primary-300 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50"
          >
            조건 해제
          </button>
        </div>
      )}

      {/* Active Region Banner */}
      {activeRegion && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-200">
          <span className="text-2xl">📍</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800">{activeRegion} 지역 매물 검색 중</p>
            <p className="text-xs text-blue-600">해당 지역의 매물만 표시됩니다</p>
          </div>
          <button
            onClick={clearRegion}
            className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
          >
            지역 해제
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="지역, 단지명, 주소를 검색하세요"
              className="w-full rounded-xl border border-gray-200 py-3 pl-12 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`shrink-0 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${showFilters ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            필터 {showFilters ? '▲' : '▼'}
          </button>
        </div>

        {/* Quick category chips */}
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">
          <button onClick={() => setCategoryId('')}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!categoryId ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            전체
          </button>
          {categories.map((c) => (
            <button key={c.id} onClick={() => setCategoryId(c.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${categoryId === c.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">거래유형</label>
              <select value={txType} onChange={(e) => setTxType(e.target.value as TransactionType | '')} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">전체</option>
                <option value="sale">매매</option>
                <option value="jeonse">전세</option>
                <option value="monthly">월세</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">가격 (만원)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="최소" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <span className="text-gray-400">~</span>
                <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="최대" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">전용면적 (㎡)</label>
              <div className="flex items-center gap-2">
                <input type="number" value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="최소" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <span className="text-gray-400">~</span>
                <input type="number" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} placeholder="최대" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">방수</label>
              <select value={rooms} onChange={(e) => setRooms(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">전체</option>
                {[1,2,3,4].map((r) => <option key={r} value={r}>{r}룸 이상</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">방향</label>
              <select value={direction} onChange={(e) => setDirection(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">전체</option>
                {directionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          총 <span className="font-semibold text-gray-900">{total}</span>건
        </p>
        <div className="flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-200">
            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>목록</button>
            <button onClick={() => setViewMode('map')} className={`px-3 py-1.5 text-xs font-medium ${viewMode === 'map' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>지도</button>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
      ) : viewMode === 'map' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {properties.map((p) => <SearchResultCard key={p.id} property={p} />)}
          </div>
          <div className="sticky top-32 h-[600px] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
            <p className="text-sm text-gray-400">카카오맵 API 연동 예정</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map((p) => <SearchResultCard key={p.id} property={p} />)}
          {properties.length === 0 && <div className="col-span-full py-20 text-center text-sm text-gray-400">검색 결과가 없습니다.</div>}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-1">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50">이전</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-2 text-sm font-medium ${p === page ? 'bg-primary-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{p}</button>
          ))}
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50">다음</button>
        </div>
      )}
    </div>
  )
}

function SearchResultCard({ property: p }: { property: Property }) {
  const formatArea = useFormatArea()
  const { findCategory } = useCategories()
  const cat = findCategory(p.category_id)
  const txBadge: Record<string, string> = { sale: 'bg-blue-100 text-blue-700', jeonse: 'bg-green-100 text-green-700', monthly: 'bg-orange-100 text-orange-700' }

  return (
    <a href={`/properties/${p.id}`} className="group block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img src={p.photos?.[0] || 'https://placehold.co/400x300/e2e8f0/94a3b8?text=No+Image'} alt={p.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
        <div className="absolute left-2 top-2 flex gap-1">
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${txBadge[p.transaction_type]}`}>{transactionTypeLabel[p.transaction_type]}</span>
          {p.is_urgent && <span className="rounded-md bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">급매</span>}
        </div>
      </div>
      <div className="p-3">
        <p className="text-lg font-bold text-gray-900">{formatPropertyPrice(p.transaction_type, p.sale_price, p.deposit, p.monthly_rent)}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-700">{p.title}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {cat?.name} · {formatArea(p.exclusive_area_m2)}
          {p.floor && p.total_floors ? ` · ${p.floor}/${p.total_floors}층` : ''}
          {p.direction ? ` · ${p.direction}` : ''}
        </p>
        <p className="truncate text-xs text-gray-400">{p.address}</p>
      </div>
    </a>
  )
}
