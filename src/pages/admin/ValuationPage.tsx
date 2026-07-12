import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, ComposedChart, Legend } from 'recharts'
import { complexList, getComplexPriceTrend, getComplexPyeongComparison, getRegionalPriceSummary } from '@/utils/marketMockData'
import type { PriceTrendPoint, PyeongComparison } from '@/utils/marketMockData'
import { fetchComplexPriceTrend, fetchComplexPyeongComparison } from '@/api/complexTrades'
import { formatPrice } from '@/utils/format'

type Period = 6 | 12 | 36

export function ValuationPage() {
  const [selectedComplex, setSelectedComplex] = useState(complexList[0])
  const [period, setPeriod] = useState<Period>(12)
  const [compareComplex, setCompareComplex] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [trendData, setTrendData] = useState<PriceTrendPoint[]>([])
  const [pyeongData, setPyeongData] = useState<PyeongComparison[]>([])
  const [compareTrend, setCompareTrend] = useState<PriceTrendPoint[] | null>(null)
  const [dataSource, setDataSource] = useState<'real' | 'estimate'>('estimate')

  const priceSummary = getRegionalPriceSummary()

  // 선택 단지: MOLIT 실거래 로드 → 실패/미매칭 시 추정 데이터 fallback
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let real = false
      let trend = await fetchComplexPriceTrend(selectedComplex.id, period).catch(() => null)
      if (trend && trend.length > 0) real = true
      else trend = getComplexPriceTrend(selectedComplex.id, period)
      let pyeong = await fetchComplexPyeongComparison(selectedComplex.id).catch(() => null)
      if (!pyeong || pyeong.length === 0) pyeong = getComplexPyeongComparison(selectedComplex.id)
      if (cancelled) return
      setTrendData(trend)
      setPyeongData(pyeong)
      setDataSource(real ? 'real' : 'estimate')
    }
    void load()
    return () => { cancelled = true }
  }, [selectedComplex.id, period])

  // 비교 단지 추이
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!compareComplex) { setCompareTrend(null); return }
      let trend = await fetchComplexPriceTrend(compareComplex, period).catch(() => null)
      if (!trend || trend.length === 0) trend = getComplexPriceTrend(compareComplex, period)
      if (!cancelled) setCompareTrend(trend)
    }
    void load()
    return () => { cancelled = true }
  }, [compareComplex, period])

  const compareInfo = compareComplex ? complexList.find((c) => c.id === compareComplex) : null

  const filteredComplexes = searchQuery
    ? complexList.filter((c) => c.name.includes(searchQuery) || c.region.includes(searchQuery))
    : complexList

  // date 키로 병합 — 실거래는 거래 있는 달만 존재해 배열 인덱스가 어긋날 수 있음
  const compareByDate = new Map((compareTrend ?? []).map((c) => [c.date, c.avgPrice]))
  const mergedTrendData = trendData.map((d) => ({
    ...d,
    comparePrice: compareByDate.get(d.date) ?? null,
  }))

  // 적정 시세 범위: 실거래 월별 최저·평균·최고가 기반
  const fairValueData = trendData.map((d) => ({
    date: d.date,
    actual: d.avgPrice,
    median: d.avgPrice,
    lowerBound: d.minPrice,
    upperBound: d.maxPrice,
  }))

  const latestPrice = trendData[trendData.length - 1]?.avgPrice ?? 0
  const startPrice = trendData[0]?.avgPrice ?? 0
  const changeRate = startPrice > 0 ? (((latestPrice - startPrice) / startPrice) * 100).toFixed(1) : '0'
  const totalTx = trendData.reduce((s, d) => s + d.txCount, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">시세 분석</h1>
        <p className="mt-1 text-sm text-gray-500">단지별 실거래가, 평형 비교, 적정 시세 범위를 분석합니다.</p>
      </div>

      {/* Complex Selector */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-gray-400">단지 검색</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="단지명, 지역 검색..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">비교 단지</label>
            <select
              value={compareComplex ?? ''}
              onChange={(e) => setCompareComplex(e.target.value || null)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">비교 없음</option>
              {complexList.filter((c) => c.id !== selectedComplex.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {filteredComplexes.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedComplex(c); setCompareComplex(null) }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedComplex.id === c.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">현재 시세</p>
          <p className="mt-1 text-lg font-bold text-primary-700">{formatPrice(latestPrice)}</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">기간 변동률</p>
          <p className={`mt-1 text-lg font-bold ${Number(changeRate) > 0 ? 'text-red-600' : 'text-blue-600'}`}>
            {Number(changeRate) > 0 ? '+' : ''}{changeRate}%
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">기간 거래건수</p>
          <p className="mt-1 text-lg font-bold text-gray-800">{totalTx}건</p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
          <p className="text-xs text-gray-400">단지 정보</p>
          <p className="mt-1 text-sm font-medium text-gray-700">{selectedComplex.builtYear}년 · {selectedComplex.totalUnits.toLocaleString()}세대</p>
        </div>
      </div>

      {/* Price Trend */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">
            실거래가 추이
            {compareInfo && <span className="ml-2 text-xs font-normal text-gray-400">vs {compareInfo.name}</span>}
            <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${dataSource === 'real' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {dataSource === 'real' ? '국토부 실거래가' : '추정 데이터'}
            </span>
          </h3>
          <div className="flex gap-1">
            {([6, 12, 36] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  period === p ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {p === 6 ? '6개월' : p === 12 ? '1년' : '3년'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}억`} domain={['dataMin - 3000', 'dataMax + 3000']} />
              <Tooltip formatter={(value) => formatPrice(value as number)} />
              <Legend />
              <Line type="monotone" dataKey="avgPrice" stroke="#2563eb" strokeWidth={2} dot={false} name={selectedComplex.name} />
              <Line type="monotone" dataKey="maxPrice" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 4" dot={false} name="최고가" />
              <Line type="monotone" dataKey="minPrice" stroke="#22c55e" strokeWidth={1} strokeDasharray="4 4" dot={false} name="최저가" />
              {compareComplex && (
                <Line type="monotone" dataKey="comparePrice" stroke="#f59e0b" strokeWidth={2} dot={false} name={compareInfo?.name ?? '비교'} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pyeong Comparison */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h3 className="mb-4 text-sm font-bold">평형별 시세 비교</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pyeongData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="pyeong" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}평`} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}억`} />
                <Tooltip formatter={(value) => formatPrice(value as number)} />
                <Bar dataKey="avgPrice" fill="#3b82f6" radius={[4, 4, 0, 0]} name="평균가" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400">
                  <th className="pb-2 text-left">평형</th>
                  <th className="pb-2 text-right">평균가</th>
                  <th className="pb-2 text-right">평당가</th>
                  <th className="pb-2 text-right">거래</th>
                </tr>
              </thead>
              <tbody>
                {pyeongData.map((d) => (
                  <tr key={d.pyeong} className="border-b border-gray-50">
                    <td className="py-1.5 font-medium">{d.pyeong}평</td>
                    <td className="py-1.5 text-right text-primary-700">{formatPrice(d.avgPrice)}</td>
                    <td className="py-1.5 text-right text-gray-500">{formatPrice(d.perPyeong)}</td>
                    <td className="py-1.5 text-right text-gray-400">{d.txCount}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fair Value Band */}
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
          <h3 className="mb-4 text-sm font-bold">적정 시세 범위</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fairValueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}억`} domain={['dataMin - 3000', 'dataMax + 3000']} />
                <Tooltip formatter={(value) => formatPrice(value as number)} />
                <Area type="monotone" dataKey="upperBound" stroke="none" fill="#dbeafe" name="상한" />
                <Area type="monotone" dataKey="lowerBound" stroke="none" fill="#ffffff" name="하한" />
                <Line type="monotone" dataKey="median" stroke="#93c5fd" strokeWidth={1} strokeDasharray="5 5" dot={false} name="중간값" />
                <Line type="monotone" dataKey="actual" stroke="#2563eb" strokeWidth={2.5} dot={false} name="실거래가" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">
            {dataSource === 'real'
              ? '적정 시세 범위는 해당 기간 국토부 실거래가의 월별 최저·최고가를 기반으로 표시됩니다.'
              : '적정 시세 범위는 추정 데이터 기반이며, 참고용입니다.'}
          </p>
        </div>
      </div>

      {/* Regional Summary Table */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h3 className="mb-4 text-sm font-bold">지역별 평당가 요약</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                <th className="pb-2 pr-4">지역</th>
                <th className="pb-2 pr-4 text-right">평당가</th>
                <th className="pb-2 pr-4 text-right">전월대비</th>
                <th className="pb-2 text-right">거래건수</th>
              </tr>
            </thead>
            <tbody>
              {priceSummary.map((r) => (
                <tr key={r.region} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2.5 pr-4 font-medium">{r.region}</td>
                  <td className="py-2.5 pr-4 text-right">{formatPrice(r.avgPrice)}</td>
                  <td className={`py-2.5 pr-4 text-right font-medium ${r.changeRate > 0 ? 'text-red-600' : r.changeRate < 0 ? 'text-blue-600' : 'text-gray-500'}`}>
                    {r.changeRate > 0 ? '+' : ''}{r.changeRate}%
                  </td>
                  <td className="py-2.5 text-right text-gray-500">{r.txCount}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-gray-400">
          단지 시세(위 차트)는 국토교통부 실거래가 기반이며, 지역별 요약 표는 참고용 추정치입니다.
        </p>
      </div>
    </div>
  )
}
