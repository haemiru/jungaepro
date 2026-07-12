// 단지별 실거래가 집계 (MOLIT 국토부 실거래가 기반)
// mock(marketMockData)의 단지 시세를 실데이터로 대체. 매칭 실패 시 null 반환 → 호출측 fallback.
import { fetchRecentTrades, type TradeRecord } from '@/api/realTradePrice'
import { complexList, type ComplexInfo, type PriceTrendPoint, type PyeongComparison } from '@/utils/marketMockData'

const PYEONG = 3.305785
const norm = (s: string) => s.replace(/\s+/g, '')

function findComplex(complexId: string): ComplexInfo | undefined {
  return complexList.find((c) => c.id === complexId)
}

/** aptNm 정규화 부분일치로 단지 실거래만 추출 */
function filterByComplex(trades: TradeRecord[], complex: ComplexInfo): TradeRecord[] {
  const key = norm(complex.matchName)
  return trades.filter((t) => norm(t.name).includes(key))
}

/** 실거래 기반 월별 시세 추이. 매칭 데이터 없으면 null. */
export async function fetchComplexPriceTrend(complexId: string, months: number): Promise<PriceTrendPoint[] | null> {
  const complex = findComplex(complexId)
  if (!complex) return null
  const all = await fetchRecentTrades({ lawdCd: complex.lawdCd, months, apiType: 'apt_trade' })
  const trades = filterByComplex(all, complex)
  if (trades.length === 0) return null

  const byMonth = new Map<string, number[]>()
  for (const t of trades) {
    const ym = t.dealDate.slice(0, 7)
    const arr = byMonth.get(ym) ?? []
    arr.push(t.dealAmount)
    byMonth.set(ym, arr)
  }
  return [...byMonth.entries()]
    .map(([date, prices]) => ({
      date,
      avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      txCount: prices.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** 실거래 기반 평형별 비교. 매칭 데이터 없으면 null. */
export async function fetchComplexPyeongComparison(complexId: string): Promise<PyeongComparison[] | null> {
  const complex = findComplex(complexId)
  if (!complex) return null
  const all = await fetchRecentTrades({ lawdCd: complex.lawdCd, months: 12, apiType: 'apt_trade' })
  const trades = filterByComplex(all, complex)
  if (trades.length === 0) return null

  const byPyeong = new Map<number, { prices: number[]; latest: string }>()
  for (const t of trades) {
    if (!t.exclusiveArea) continue
    const py = Math.round(t.exclusiveArea / PYEONG)
    const g = byPyeong.get(py) ?? { prices: [], latest: '' }
    g.prices.push(t.dealAmount)
    if (t.dealDate > g.latest) g.latest = t.dealDate
    byPyeong.set(py, g)
  }
  return [...byPyeong.entries()]
    .map(([pyeong, g]) => {
      const avgPrice = Math.round(g.prices.reduce((a, b) => a + b, 0) / g.prices.length)
      return {
        pyeong,
        avgPrice,
        perPyeong: pyeong > 0 ? Math.round(avgPrice / pyeong) : 0,
        recentTxDate: g.latest.slice(0, 7),
        txCount: g.prices.length,
      }
    })
    .sort((a, b) => a.pyeong - b.pyeong)
}
