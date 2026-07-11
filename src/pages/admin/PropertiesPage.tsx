import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { Property, PropertyStatus, PropertyCategory, TransactionType } from '@/types/database'
import { fetchAdminProperties, updatePropertyStatus, deleteProperties, fetchCategories } from '@/api/properties'
import { AdminPropertyTable } from '@/features/properties/components/AdminPropertyTable'
import { AdminPropertyCard } from '@/features/properties/components/AdminPropertyCard'
import { Button } from '@/components/common'
import { propertyStatusLabel } from '@/utils/format'
import toast from 'react-hot-toast'

const statusTabs: { key: PropertyStatus | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'draft', label: '매물등록중' },
  { key: 'active', label: '포털 공개중' },
  { key: 'contracted', label: '계약진행' },
  { key: 'completed', label: '거래완료' },
  { key: 'hold', label: '보류' },
]

type ViewMode = 'table' | 'card'

export function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [statusTab, setStatusTab] = useState<PropertyStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [categories, setCategories] = useState<PropertyCategory[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [transactionType, setTransactionType] = useState<TransactionType | ''>('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minArea, setMinArea] = useState('')
  const [maxArea, setMaxArea] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [areaUnit, setAreaUnit] = useState<'m2' | 'pyeong'>('m2')

  useEffect(() => { fetchCategories().then(setCategories).catch(() => {}) }, [])

  const buildFilters = useCallback(() => ({
    statusTab,
    search: search || undefined,
    categoryId: categoryId || undefined,
    transactionType: (transactionType || undefined) as TransactionType | undefined,
    minPrice: minPrice ? Number(minPrice) * 10000 : undefined,
    maxPrice: maxPrice ? Number(maxPrice) * 10000 : undefined,
    minArea: minArea ? (areaUnit === 'pyeong' ? Number(minArea) * 3.3058 : Number(minArea)) : undefined,
    maxArea: maxArea ? (areaUnit === 'pyeong' ? Number(maxArea) * 3.3058 : Number(maxArea)) : undefined,
    minBuiltYear: undefined,
  }), [statusTab, search, categoryId, transactionType, minPrice, maxPrice, minArea, maxArea, areaUnit])

  const load = useCallback(async () => {
    setIsLoading(true)
    const data = await fetchAdminProperties(buildFilters())
    setProperties(dateFrom || dateTo ? data.filter((p) => {
      const d = p.created_at?.slice(0, 10) || ''
      if (dateFrom && d < dateFrom) return false
      if (dateTo && d > dateTo) return false
      return true
    }) : data)
    setSelectedIds(new Set())
    setIsLoading(false)
  }, [buildFilters, dateFrom, dateTo])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setIsLoading(true)
      try {
        const data = await fetchAdminProperties(buildFilters())
        if (cancelled) return
        setProperties(dateFrom || dateTo ? data.filter((p) => {
          const d = p.created_at?.slice(0, 10) || ''
          if (dateFrom && d < dateFrom) return false
          if (dateTo && d > dateTo) return false
          return true
        }) : data)
        setSelectedIds(new Set())
      } catch {
        if (!cancelled) setProperties([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [buildFilters, dateFrom, dateTo])

  const handleResetAdvanced = () => {
    setCategoryId('')
    setTransactionType('')
    setMinPrice('')
    setMaxPrice('')
    setMinArea('')
    setMaxArea('')
    setDateFrom('')
    setDateTo('')
  }

  const selectedCategory = categories.find((c) => c.id === categoryId)
  const noJeonseCategories = ['토지', '공장', '창고', '공장/창고', '건물', '지식산업센터', '상가', '사무실']
  const isNoJeonse = selectedCategory ? noJeonseCategories.some((n) => selectedCategory.name.includes(n)) : false

  // 전세 불가 유형 선택 시 거래유형이 전세면 초기화 (렌더 중 조정 — React 권장 패턴)
  if (isNoJeonse && transactionType === 'jeonse') {
    setTransactionType('')
  }

  const activeFilterCount = [categoryId, transactionType, minPrice, maxPrice, minArea, maxArea, dateFrom, dateTo].filter(Boolean).length

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const handleSelectAll = () => {
    if (properties.every((p) => selectedIds.has(p.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(properties.map((p) => p.id)))
    }
  }

  const handleStatusChange = async (id: string, status: PropertyStatus) => {
    await updatePropertyStatus([id], status)
    toast.success(`상태를 "${propertyStatusLabel[status]}"(으)로 변경했습니다.`)
    load()
  }

  const handleBulkStatus = async (status: PropertyStatus) => {
    if (selectedIds.size === 0) return
    await updatePropertyStatus([...selectedIds], status)
    toast.success(`${selectedIds.size}건 상태를 "${propertyStatusLabel[status]}"(으)로 변경했습니다.`)
    load()
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`${selectedIds.size}건의 매물을 삭제하시겠습니까?`)) return
    await deleteProperties([...selectedIds])
    toast.success(`${selectedIds.size}건 삭제했습니다.`)
    load()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">매물 관리</h1>
        <Link to="/admin/properties/new">
          <Button>+ 매물 등록</Button>
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="scrollbar-hide flex gap-1 overflow-x-auto">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusTab === tab.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar: Search + View Toggle + Bulk Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="매물명, 주소 검색"
            className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            showAdvanced || activeFilterCount > 0
              ? 'border-primary-300 bg-primary-50 text-primary-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          상세 검색{activeFilterCount > 0 && <span className="rounded-full bg-primary-600 px-1.5 py-0.5 text-xs text-white">{activeFilterCount}</span>}
        </button>

        {/* View Toggle */}
        <div className="flex rounded-lg border border-gray-200">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-2 text-xs font-medium ${viewMode === 'table' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
          >
            테이블
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`px-3 py-2 text-xs font-medium ${viewMode === 'card' ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}
          >
            카드
          </button>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{selectedIds.size}건 선택</span>
            <select
              onChange={(e) => { if (e.target.value) handleBulkStatus(e.target.value as PropertyStatus); e.target.value = '' }}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              defaultValue=""
            >
              <option value="" disabled>상태 변경</option>
              <option value="active">포털 공개중</option>
              <option value="hold">보류</option>
              <option value="contracted">계약진행</option>
              <option value="completed">거래완료</option>
            </select>
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>삭제</Button>
          </div>
        )}
      </div>

      {/* Advanced Search Panel */}
      {showAdvanced && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 유형(카테고리) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">유형</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">전체</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
              </select>
            </div>
            {/* 거래유형 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">거래유형</label>
              <select value={transactionType} onChange={(e) => setTransactionType(e.target.value as TransactionType | '')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">전체</option>
                <option value="sale">매매</option>
                {!isNoJeonse && <option value="jeonse">전세</option>}
                <option value="monthly">월세</option>
              </select>
            </div>
            {/* 금액 범위 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">금액 (만원)</label>
              <div className="flex items-center gap-1">
                <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="최소"
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm" />
                <span className="text-gray-400">~</span>
                <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="최대"
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm" />
              </div>
            </div>
            {/* 면적 범위 */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-500">면적</label>
                <div className="flex rounded-md border border-gray-200 text-xs">
                  <button onClick={() => { setAreaUnit('m2'); setMinArea(''); setMaxArea('') }}
                    className={`px-2 py-0.5 ${areaUnit === 'm2' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>m²</button>
                  <button onClick={() => { setAreaUnit('pyeong'); setMinArea(''); setMaxArea('') }}
                    className={`px-2 py-0.5 ${areaUnit === 'pyeong' ? 'bg-primary-600 text-white' : 'text-gray-500'}`}>평</button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="최소"
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm" />
                <span className="text-gray-400">~</span>
                <input type="number" value={maxArea} onChange={(e) => setMaxArea(e.target.value)} placeholder="최대"
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm" />
              </div>
            </div>
            {/* 등록일 범위 */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-500">등록일</label>
              <div className="flex items-center gap-1">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm" />
                <span className="text-gray-400">~</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm" />
              </div>
            </div>
            {/* 초기화 */}
            <div className="flex items-end sm:col-span-2 lg:col-span-2">
              <button onClick={handleResetAdvanced}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
                필터 초기화
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="py-20 text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
      ) : viewMode === 'table' ? (
        <AdminPropertyTable properties={properties} selectedIds={selectedIds} onSelect={handleSelect} onSelectAll={handleSelectAll} onStatusChange={handleStatusChange} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map((p) => (
            <AdminPropertyCard key={p.id} property={p} isSelected={selectedIds.has(p.id)} onSelect={handleSelect} />
          ))}
          {properties.length === 0 && <div className="col-span-full py-16 text-center text-sm text-gray-400">매물이 없습니다.</div>}
        </div>
      )}
    </div>
  )
}
