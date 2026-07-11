import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Property } from '@/types/database'
import { getBjdCodeFromAddress } from '@/utils/bjdCode'
import { fetchRecentTrades, getApiTypes, getDataSourceLabel, type TradeRecord } from '@/api/realTradePrice'
import { formatPrice } from '@/utils/format'

interface Props {
  property: Property
  categoryName?: string
}

const UNSUPPORTED_CATEGORIES: string[] = []

export function NearbyTradePrice({ property, categoryName }: Props) {
  const [trades, setTrades] = useState<TradeRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [months, setMonths] = useState<3 | 6 | 12>(6)
  const [regionName, setRegionName] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      const bjd = await getBjdCodeFromAddress(property.address)
      if (!bjd) { setError('주소에서 법정동 정보를 찾을 수 없습니다.'); setIsLoading(false); return }
      if (!cancelled) setRegionName(bjd.regionName)

      const apiTypes = getApiTypes(categoryName, property.transaction_type)
      const results = await Promise.all(
        apiTypes.map((t) => fetchRecentTrades({ lawdCd: bjd.lawdCd, months, apiType: t }))
      )
      if (!cancelled) {
        setTrades(results.flat().sort((a, b) => b.dealDate.localeCompare(a.dealDate)))
        setIsLoading(false)
      }
    }

    load().catch((err) => {
      if (!cancelled) { setError(err.message || '실거래가 조회에 실패했습니다.'); setIsLoading(false) }
    })
    return () => { cancelled = true }
  }, [property.address, property.transaction_type, categoryName, months])

  // 지원하지 않는 카테고리
  if (UNSUPPORTED_CATEGORIES.includes(categoryName ?? '')) {
    return null
  }

  // 월별 평균 차트 데이터
  const monthlyAvg = (() => {
    const map = new Map<string, { sum: number; count: number }>()
    for (const t of trades) {
      const ym = t.dealDate.slice(0, 7) // YYYY-MM
      const entry = map.get(ym) || { sum: 0, count: 0 }
      entry.sum += t.dealAmount
      entry.count += 1
      map.set(ym, entry)
    }
    return [...map.entries()]
      .map(([month, { sum, count }]) => ({ month, avg: Math.round(sum / count) }))
      .sort((a, b) => a.month.localeCompare(b.month))
  })()

  // 요약 통계
  const stats = trades.length > 0 ? {
    avg: Math.round(trades.reduce((s, t) => s + t.dealAmount, 0) / trades.length),
    max: Math.max(...trades.map((t) => t.dealAmount)),
    min: Math.min(...trades.map((t) => t.dealAmount)),
    count: trades.length,
  } : null

  const isSale = property.transaction_type === 'sale'

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">주변 시세 (국토부 실거래가)</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {regionName} · {getDataSourceLabel(categoryName, property.transaction_type)}
          </p>
        </div>
        <div className="flex gap-1">
          {([3, 6, 12] as const).map((m) => (
            <button key={m} onClick={() => setMonths(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${months === m ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {m}개월
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : error ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <p className="text-sm text-gray-400">{error}</p>
          <button onClick={() => setMonths(months)} className="rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-600 hover:bg-gray-200">다시 시도</button>
        </div>
      ) : trades.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-gray-400">해당 지역의 최근 {months}개월 거래 데이터가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Cards */}
          {stats && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-[10px] text-blue-500">{isSale ? '평균 거래가' : '평균 보증금'}</p>
                <p className="mt-0.5 text-sm font-bold text-blue-700">{formatPrice(stats.avg)}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <p className="text-[10px] text-red-500">최고가</p>
                <p className="mt-0.5 text-sm font-bold text-red-700">{formatPrice(stats.max)}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-[10px] text-green-500">최저가</p>
                <p className="mt-0.5 text-sm font-bold text-green-700">{formatPrice(stats.min)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-[10px] text-gray-500">거래 건수</p>
                <p className="mt-0.5 text-sm font-bold text-gray-700">{stats.count}건</p>
              </div>
            </div>
          )}

          {/* Chart */}
          {monthlyAvg.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">월별 평균 {isSale ? '거래가' : '보증금'} 추이</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={monthlyAvg}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5) + '월'} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}억`} width={45} />
                  <Tooltip
                    formatter={(value?: number) => [formatPrice(value ?? 0), isSale ? '평균 거래가' : '평균 보증금']}
                    labelFormatter={(label) => `${label.slice(0, 4)}년 ${label.slice(5)}월`}
                  />
                  <Line type="monotone" dataKey="avg" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Transaction Table */}
          <div>
            <p className="mb-2 text-xs font-medium text-gray-500">최근 거래 내역</p>
            <div className="max-h-64 overflow-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-left text-gray-500">
                    <th className="px-3 py-2">거래일</th>
                    <th className="px-3 py-2">단지/건물명</th>
                    <th className="hidden px-3 py-2 sm:table-cell">전용면적</th>
                    <th className="hidden px-3 py-2 sm:table-cell">층</th>
                    <th className="px-3 py-2 text-right">{isSale ? '거래가' : '보증금'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {trades.slice(0, 20).map((t, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{t.dealDate}</td>
                      <td className="max-w-[120px] truncate px-3 py-2 font-medium text-gray-800">{t.name || t.dong}</td>
                      <td className="hidden px-3 py-2 text-gray-500 sm:table-cell">{t.exclusiveArea}㎡</td>
                      <td className="hidden px-3 py-2 text-gray-500 sm:table-cell">{t.floor ?? '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-800">
                        {formatPrice(t.dealAmount)}
                        {t.monthlyRent ? ` / 월${formatPrice(t.monthlyRent)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
