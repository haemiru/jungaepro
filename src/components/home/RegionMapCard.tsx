import { use, useMemo } from 'react'
import type { RegionMapData } from '@/data/regionMaps'

type Props = {
  name: string
  nameEn?: string
  selected: boolean
  onClick: () => void
}

/* ── 지역 지도 데이터(약 1.2MB SVG path)는 동적 import로 분리해
      RegionMapCard 컴포넌트 청크에서 제외하고, 카드가 실제 렌더될 때만
      별도 캐시 가능한 청크로 로드한다. 모듈 레벨에서 프로미스를 캐시해
      여러 카드가 한 번의 로드를 공유한다. ── */

type RegionModule = typeof import('@/data/regionMaps')
let regionDataPromise: Promise<RegionModule> | null = null

function loadRegionData(): Promise<RegionModule> {
  if (!regionDataPromise) regionDataPromise = import('@/data/regionMaps')
  return regionDataPromise
}

/* ── SVG path bounding box helper ── */

function pathBBox(d: string) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const cmds = d.match(/[MLCSQTAHVZmlcsqtahvz][^MLCSQTAHVZmlcsqtahvz]*/g) || []
  for (const c of cmds) {
    const letter = c[0]
    if (letter === 'Z' || letter === 'z') continue
    const nums = c.slice(1).match(/[-+]?\d*\.?\d+/g)?.map(Number) || []
    if (letter === 'H') { for (const n of nums) { minX = Math.min(minX, n); maxX = Math.max(maxX, n) } }
    else if (letter === 'V') { for (const n of nums) { minY = Math.min(minY, n); maxY = Math.max(maxY, n) } }
    else { for (let i = 0; i < nums.length - 1; i += 2) { minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]); minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]) } }
  }
  return { minX, minY, maxX, maxY }
}

function buildCityMap(cityPrefix: string, parentData: RegionMapData): RegionMapData {
  const regions: Record<string, string> = {}
  for (const [rName, path] of Object.entries(parentData.regions)) {
    if (rName.startsWith(cityPrefix)) regions[rName] = path
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const path of Object.values(regions)) {
    const bb = pathBBox(path)
    minX = Math.min(minX, bb.minX); minY = Math.min(minY, bb.minY)
    maxX = Math.max(maxX, bb.maxX); maxY = Math.max(maxY, bb.maxY)
  }
  const pad = ((maxX - minX) + (maxY - minY)) * 0.05
  return {
    viewBox: `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + pad * 2).toFixed(1)} ${(maxY - minY + pad * 2).toFixed(1)}`,
    regions,
  }
}

/* ── City-level map cache (e.g. "청주시" → map of its 구s) ── */

const cityMapCache: Record<string, RegionMapData> = {}

function getCityMap(
  cityPrefix: string,
  regionMaps: RegionModule['regionMaps'],
  regionParents: RegionModule['regionParents'],
): RegionMapData | null {
  if (cityMapCache[cityPrefix]) return cityMapCache[cityPrefix]
  for (const [region, parent] of Object.entries(regionParents)) {
    if (region.startsWith(cityPrefix + ' ') && /구$/.test(region)) {
      const parentData = regionMaps[parent]
      if (parentData) {
        const map = buildCityMap(cityPrefix, parentData)
        if (Object.keys(map.regions).length > 0) {
          cityMapCache[cityPrefix] = map
          return map
        }
      }
    }
  }
  return null
}

/* ── Region → map data lookup ── */

function findMap(
  name: string,
  regionMaps: RegionModule['regionMaps'],
  regionParents: RegionModule['regionParents'],
): { data: RegionMapData; highlights: string[] } | null {
  // 1. Exact match in regionParents (e.g. "청주시 흥덕구" → "충청북도")
  //    But if it's a "시 구" pattern, show city-level map instead of province
  if (regionParents[name]) {
    const cityMatch = name.match(/^(.+시)\s+.+구$/)
    if (cityMatch) {
      const cityMap = getCityMap(cityMatch[1], regionMaps, regionParents)
      if (cityMap) return { data: cityMap, highlights: [name] }
    }
    const d = regionMaps[regionParents[name]]
    if (d) return { data: d, highlights: [name] }
  }

  // 2. Name is a province itself (e.g. "세종특별자치시")
  if (regionMaps[name]) {
    return { data: regionMaps[name], highlights: Object.keys(regionMaps[name].regions) }
  }

  // 3. Partial match in province/metro names only (e.g. "세종시" → "세종특별자치시")
  //    Skip 구-level map keys like "청주시 흥덕구" — only match top-level 시/도
  for (const prov of Object.keys(regionMaps)) {
    if (/구$/.test(prov) || /[시군]\s/.test(prov)) continue
    const short = prov.replace(/특별자치시$|특별자치도$|특별시$|광역시$|도$/, '')
    if (name.includes(short) || short.includes(name.replace(/시$|도$/, ''))) {
      return { data: regionMaps[prov], highlights: Object.keys(regionMaps[prov].regions) }
    }
  }

  // 4. Prefix match (e.g. "청주시" → city-level map of its 구s)
  for (const [region, parent] of Object.entries(regionParents)) {
    if (region.startsWith(name) || name.startsWith(region)) {
      // If "XX시" matches "XX시 YY구", build a city-level map
      if (/시$/.test(name)) {
        const cityMap = getCityMap(name, regionMaps, regionParents)
        if (cityMap) {
          const hl = Object.keys(cityMap.regions).filter(r => r.startsWith(name))
          if (hl.length > 0) return { data: cityMap, highlights: hl }
        }
      }
      const d = regionMaps[parent]
      if (d) {
        const hl = Object.keys(d.regions).filter(r => r.startsWith(name) || name.startsWith(r))
        if (hl.length > 0) return { data: d, highlights: hl }
      }
    }
  }

  // 5. Suffix/contains match (e.g. "흥덕구" → "청주시 흥덕구")
  //    For 구 under 시, show city-level map
  for (const [region, parent] of Object.entries(regionParents)) {
    if (region.endsWith(name) || region.includes(name)) {
      const cityMatch = region.match(/^(.+시)\s+.+구$/)
      if (cityMatch) {
        const cityMap = getCityMap(cityMatch[1], regionMaps, regionParents)
        if (cityMap) {
          const hl = Object.keys(cityMap.regions).filter(r => r.endsWith(name) || r.includes(name))
          if (hl.length > 0) return { data: cityMap, highlights: hl }
        }
      }
      const d = regionMaps[parent]
      if (d) {
        const hl = Object.keys(d.regions).filter(r => r.endsWith(name) || r.includes(name))
        if (hl.length > 0) return { data: d, highlights: hl }
      }
    }
  }

  // 6. 동 base name match (e.g. "도마동" → "도마1동", "도마2동")
  const dongBase = name.match(/^(.+)동$/)?.[1]
  if (dongBase) {
    for (const [region, parent] of Object.entries(regionParents)) {
      const rBase = region.match(/^(.+?)(\d+)동$/)?.[1]
      if (rBase === dongBase) {
        const d = regionMaps[parent]
        if (d) {
          const hl = Object.keys(d.regions).filter(r => r.startsWith(dongBase) && r.endsWith('동'))
          if (hl.length > 0) return { data: d, highlights: hl }
        }
      }
    }
  }

  return null
}

/* ── Component ── */

export function RegionMapCard({ name, nameEn, selected, onClick }: Props) {
  // 캐시된 프로미스를 use()로 소비 → 데이터 로딩 동안 부모 Suspense fallback 표시
  const { regionMaps, regionParents } = use(loadRegionData())
  const match = useMemo(
    () => findMap(name, regionMaps, regionParents),
    [name, regionMaps, regionParents],
  )

  if (!match) return null

  const { data, highlights } = match
  const hlSet = new Set(highlights)

  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 flex-col items-center rounded-2xl px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.03] ${
        selected ? 'bg-white shadow-lg ring-2 ring-blue-500' : 'bg-gray-50 hover:bg-white hover:shadow-lg'
      }`}
      style={{ minWidth: 235 }}
    >
      <svg viewBox={data.viewBox} className="h-[173px] w-[202px]">
        {Object.entries(data.regions).map(([rName, path]) => (
          <path
            key={rName}
            d={path}
            fill={hlSet.has(rName) ? '#1D4ED8' : '#DBEAFE'}
            stroke="#93C5FD"
            strokeWidth={0.4}
          />
        ))}
      </svg>
      {nameEn && (
        <span className="mt-1 text-[10px] font-medium tracking-widest text-gray-400">
          {nameEn.toUpperCase()}
        </span>
      )}
      <span className={`${nameEn ? '' : 'mt-1 '}text-base font-bold text-gray-800`}>{name}</span>
    </button>
  )
}
