import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getRegionSignals, getRegionSignalDetail } from '@/utils/marketMockData'
import type { RegionSignal, SignalColor } from '@/utils/marketMockData'

const signalEmoji: Record<SignalColor, string> = { green: '🟢', yellow: '🟡', red: '🔴', gray: '⚪' }
const signalLabel: Record<SignalColor, string> = { green: '매수적기', yellow: '관망', red: '매도적기', gray: '데이터부족' }
const signalBg: Record<SignalColor, string> = {
  green: 'bg-green-50 ring-green-200',
  yellow: 'bg-yellow-50 ring-yellow-200',
  red: 'bg-red-50 ring-red-200',
  gray: 'bg-gray-50 ring-gray-200',
}

function gaugeColor(value: number): string {
  if (value >= 20) return '#22c55e'
  if (value >= 0) return '#eab308'
  if (value >= -20) return '#f97316'
  return '#ef4444'
}

function gaugeLabel(value: number): string {
  if (value >= 30) return '매우 긍정'
  if (value >= 10) return '긍정'
  if (value >= -10) return '보합'
  if (value >= -30) return '부정'
  return '매우 부정'
}

export function SignalPage() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'seoul' | 'gyeonggi'>('all')

  const allSignals = getRegionSignals()
  const seoulRegions = ['강남구', '서초구', '송파구', '강동구', '마포구', '용산구', '성동구', '광진구', '동작구', '영등포구', '관악구', '노원구']

  const filteredSignals = filter === 'seoul'
    ? allSignals.filter((s) => seoulRegions.includes(s.region))
    : filter === 'gyeonggi'
      ? allSignals.filter((s) => !seoulRegions.includes(s.region))
      : allSignals

  const detail = selectedRegion ? getRegionSignalDetail(selectedRegion) : null

  // Summary counts
  const greenCount = filteredSignals.filter((s) => s.signal === 'green').length
  const yellowCount = filteredSignals.filter((s) => s.signal === 'yellow').length
  const redCount = filteredSignals.filter((s) => s.signal === 'red').length

  // Chart data for selected region
  const indicatorChartData = detail?.indicators.map((ind) => ({
    name: ind.label,
    value: ind.value,
    weightedValue: Math.round(ind.value * ind.weight),
  })) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">
          매수/매도 적기 신호등
          <span className="ml-2 align-middle rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">참고용 추정</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">5개 지표의 가중 평균으로 지역별 매수/매도 시점을 추정하는 참고용 모델입니다.</p>
      </div>

      {/* Filter + Summary */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1">
          {(['all', 'seoul', 'gyeonggi'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                filter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? '전체' : f === 'seoul' ? '서울' : '경기'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">🟢 매수적기 <strong>{greenCount}</strong></span>
          <span className="flex items-center gap-1">🟡 관망 <strong>{yellowCount}</strong></span>
          <span className="flex items-center gap-1">🔴 매도적기 <strong>{redCount}</strong></span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Region Grid */}
        <div className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSignals.map((s) => (
              <button
                key={s.region}
                onClick={() => setSelectedRegion(s.region)}
                className={`rounded-xl p-4 text-left ring-1 transition-shadow hover:shadow-md ${signalBg[s.signal]} ${
                  selectedRegion === s.region ? 'ring-2 ring-primary-400 shadow-md' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{s.region}</span>
                  <span className="text-xl">{signalEmoji[s.signal]}</span>
                </div>
                <p className={`mt-1 text-xs font-semibold ${
                  s.signal === 'green' ? 'text-green-700' : s.signal === 'red' ? 'text-red-700' : 'text-yellow-700'
                }`}>
                  {signalLabel[s.signal]}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(5, (s.score + 100) / 2)}%`,
                        backgroundColor: gaugeColor(s.score),
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">{s.score > 0 ? '+' : ''}{s.score}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          {detail ? (
            <DetailPanel signal={detail} indicatorChartData={indicatorChartData} />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50">
              <div className="text-center">
                <p className="text-2xl">🗺️</p>
                <p className="mt-2 text-sm text-gray-400">지역을 선택하면</p>
                <p className="text-sm text-gray-400">상세 분석을 확인할 수 있습니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Methodology */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-3 text-sm font-bold">지표 산정 방법</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-400">
                <th className="pb-2 pr-4">지표</th>
                <th className="pb-2 pr-4 text-right">가중치</th>
                <th className="pb-2">설명</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium">거래량 추이</td>
                <td className="py-2 pr-4 text-right text-primary-600">25%</td>
                <td className="py-2 text-gray-500">전월 대비 거래량 변화율</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium">매매가격 변동률</td>
                <td className="py-2 pr-4 text-right text-primary-600">25%</td>
                <td className="py-2 text-gray-500">전월 대비 실거래 매매가 변동률</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium">매물 증감 추이</td>
                <td className="py-2 pr-4 text-right text-primary-600">20%</td>
                <td className="py-2 text-gray-500">매물 수 변화 (감소=긍정, 증가=부정)</td>
              </tr>
              <tr className="border-b border-gray-50">
                <td className="py-2 pr-4 font-medium">기준금리 방향</td>
                <td className="py-2 pr-4 text-right text-primary-600">15%</td>
                <td className="py-2 text-gray-500">한국은행 기준금리 동향</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium">미분양 추이</td>
                <td className="py-2 pr-4 text-right text-primary-600">15%</td>
                <td className="py-2 text-gray-500">미분양 물량 변화 (감소=긍정)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <span>종합점수 ≥ 15: 🟢매수적기</span>
          <span>-15 ~ 15: 🟡관망</span>
          <span>≤ -15: 🔴매도적기</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg bg-amber-50 p-4">
        <p className="text-xs text-amber-700">
          본 지표는 AI 분석 참고자료이며, 투자 결정의 근거로 사용할 수 없습니다.
          실제 투자 시 전문가 자문과 종합적인 시장 분석을 권장합니다.
        </p>
      </div>
    </div>
  )
}

function DetailPanel({ signal, indicatorChartData }: { signal: RegionSignal; indicatorChartData: { name: string; value: number; weightedValue: number }[] }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`rounded-xl p-5 ring-1 ${signalBg[signal.signal]}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{signal.region}</h3>
            <p className={`text-sm font-semibold ${
              signal.signal === 'green' ? 'text-green-700' : signal.signal === 'red' ? 'text-red-700' : 'text-yellow-700'
            }`}>
              {signalEmoji[signal.signal]} {signalLabel[signal.signal]}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400">종합점수</p>
            <p className="text-3xl font-bold" style={{ color: gaugeColor(signal.score) }}>
              {signal.score > 0 ? '+' : ''}{signal.score}
            </p>
          </div>
        </div>
      </div>

      {/* Indicators */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <h4 className="mb-3 text-xs font-bold text-gray-500">지표별 분석</h4>
        <div className="space-y-3">
          {signal.indicators.map((ind) => (
            <div key={ind.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{ind.label} <span className="text-gray-400">({(ind.weight * 100).toFixed(0)}%)</span></span>
                <span className="font-medium" style={{ color: gaugeColor(ind.value) }}>{gaugeLabel(ind.value)}</span>
              </div>
              {/* Gauge: center-based bar */}
              <div className="relative h-3 overflow-hidden rounded-full bg-gray-100">
                <div className="absolute left-1/2 top-0 h-full w-px bg-gray-300" />
                {ind.value >= 0 ? (
                  <div
                    className="absolute left-1/2 top-0 h-full rounded-r-full transition-all"
                    style={{ width: `${Math.abs(ind.value) / 2}%`, backgroundColor: gaugeColor(ind.value) }}
                  />
                ) : (
                  <div
                    className="absolute top-0 h-full rounded-l-full transition-all"
                    style={{
                      width: `${Math.abs(ind.value) / 2}%`,
                      right: '50%',
                      backgroundColor: gaugeColor(ind.value),
                    }}
                  />
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-gray-400">{ind.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Indicator Chart */}
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <h4 className="mb-3 text-xs font-bold text-gray-500">가중 점수 차트</h4>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={indicatorChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} domain={[-30, 30]} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
              <Tooltip formatter={(v) => `${(v as number) > 0 ? '+' : ''}${v}`} />
              <Bar dataKey="weightedValue" name="가중 점수" radius={[0, 4, 4, 0]}>
                {indicatorChartData.map((entry, index) => (
                  <Cell key={index} fill={gaugeColor(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
