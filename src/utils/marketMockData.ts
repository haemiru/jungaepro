// Realistic mock market data for Korean real estate analytics

// ============================================================
// Price Trend Data (실거래가 추이)
// ============================================================

export type PriceTrendPoint = {
  date: string       // YYYY-MM
  avgPrice: number   // 만원
  minPrice: number
  maxPrice: number
  txCount: number    // 거래건수
}

export type ComplexInfo = {
  id: string
  name: string
  region: string     // 구
  dong: string       // 동
  builtYear: number
  totalUnits: number
  pyeongs: number[]  // 평형대
  lawdCd: string     // 법정동코드 5자리(시군구) — MOLIT 실거래가 조회용
  matchName: string  // MOLIT aptNm 매칭용 정규화 이름(공백 제거)
}

// 서울 주요 아파트 단지 (lawdCd = 시군구 5자리, matchName = MOLIT 아파트명 매칭용)
export const complexList: ComplexInfo[] = [
  { id: 'cx-1', name: '래미안 레이카운티', region: '강남구', dong: '도곡동', builtYear: 2017, totalUnits: 1244, pyeongs: [34, 49, 59], lawdCd: '11680', matchName: '래미안레이카운티' },
  { id: 'cx-2', name: '힐스테이트 클래시안', region: '서초구', dong: '반포동', builtYear: 2020, totalUnits: 888, pyeongs: [34, 46, 59], lawdCd: '11650', matchName: '힐스테이트클래시안' },
  { id: 'cx-3', name: '잠실 엘스', region: '송파구', dong: '잠실동', builtYear: 2008, totalUnits: 5678, pyeongs: [33, 44, 59], lawdCd: '11710', matchName: '잠실엘스' },
  { id: 'cx-4', name: '잠실 리센츠', region: '송파구', dong: '잠실동', builtYear: 2008, totalUnits: 5563, pyeongs: [33, 44, 59], lawdCd: '11710', matchName: '리센츠' },
  { id: 'cx-5', name: '반포 자이', region: '서초구', dong: '반포동', builtYear: 2009, totalUnits: 3410, pyeongs: [33, 46, 59], lawdCd: '11650', matchName: '반포자이' },
  { id: 'cx-6', name: '대치 래미안 대치팰리스', region: '강남구', dong: '대치동', builtYear: 2015, totalUnits: 1608, pyeongs: [34, 49, 59], lawdCd: '11680', matchName: '래미안대치팰리스' },
  { id: 'cx-7', name: '마포 래미안 푸르지오', region: '마포구', dong: '아현동', builtYear: 2014, totalUnits: 3885, pyeongs: [25, 34, 46], lawdCd: '11440', matchName: '마포래미안푸르지오' },
  { id: 'cx-8', name: '올림픽파크 포레온', region: '강동구', dong: '둔촌동', builtYear: 2024, totalUnits: 12032, pyeongs: [34, 49, 59, 84], lawdCd: '11740', matchName: '올림픽파크포레온' },
]

// Generate price trend data for a complex
function generatePriceTrend(basePrice: number, volatility: number, months: number): PriceTrendPoint[] {
  const data: PriceTrendPoint[] = []
  let price = basePrice
  const now = new Date(2026, 1) // Feb 2026

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    // Simulate market movement
    const trend = Math.sin(i / 6) * volatility * 0.3
    const random = (Math.random() - 0.5) * volatility
    price = Math.round(price + trend + random)
    const spread = Math.round(volatility * 1.5)

    data.push({
      date: dateStr,
      avgPrice: price,
      minPrice: price - spread,
      maxPrice: price + spread,
      txCount: Math.floor(Math.random() * 15) + 3,
    })
  }
  return data
}

// Pre-generated data for key complexes
const _trendCache = new Map<string, PriceTrendPoint[]>()

export function getComplexPriceTrend(complexId: string, months: 6 | 12 | 36 = 12): PriceTrendPoint[] {
  const key = `${complexId}-${months}`
  if (_trendCache.has(key)) return _trendCache.get(key)!

  const basePrices: Record<string, number> = {
    'cx-1': 185000, 'cx-2': 195000, 'cx-3': 240000, 'cx-4': 235000,
    'cx-5': 280000, 'cx-6': 220000, 'cx-7': 105000, 'cx-8': 145000,
  }
  const base = basePrices[complexId] ?? 150000
  const vol = base * 0.015
  const data = generatePriceTrend(base, vol, months)
  _trendCache.set(key, data)
  return data
}

// ============================================================
// Pyeong Comparison Data (동일 단지·평형 비교)
// ============================================================

export type PyeongComparison = {
  pyeong: number
  avgPrice: number
  perPyeong: number  // 평당가
  recentTxDate: string
  txCount: number
}

export function getComplexPyeongComparison(complexId: string): PyeongComparison[] {
  const complex = complexList.find((c) => c.id === complexId)
  if (!complex) return []

  const basePrices: Record<string, number> = {
    'cx-1': 185000, 'cx-2': 195000, 'cx-3': 240000, 'cx-4': 235000,
    'cx-5': 280000, 'cx-6': 220000, 'cx-7': 105000, 'cx-8': 145000,
  }
  const base = basePrices[complexId] ?? 150000
  const perPyeongBase = Math.round(base / complex.pyeongs[1])

  return complex.pyeongs.map((py) => ({
    pyeong: py,
    avgPrice: Math.round(perPyeongBase * py * (0.95 + Math.random() * 0.1)),
    perPyeong: Math.round(perPyeongBase * (0.95 + Math.random() * 0.1)),
    recentTxDate: '2026-02',
    txCount: Math.floor(Math.random() * 10) + 2,
  }))
}

// ============================================================
// Fair Value Range (적정 시세 범위)
// ============================================================

export type FairValueRange = {
  date: string
  actual: number
  lowerBound: number
  upperBound: number
  median: number
}

export function getFairValueRange(complexId: string): FairValueRange[] {
  const trend = getComplexPriceTrend(complexId, 12)
  return trend.map((t) => {
    const spread = t.avgPrice * 0.05
    return {
      date: t.date,
      actual: t.avgPrice,
      lowerBound: Math.round(t.avgPrice - spread * 1.2),
      upperBound: Math.round(t.avgPrice + spread * 0.8),
      median: Math.round(t.avgPrice - spread * 0.2),
    }
  })
}

// ============================================================
// Location Analysis Data (상권·입지 분석)
// ============================================================

export type LocationCategory = 'transport' | 'school' | 'amenity' | 'foot_traffic' | 'development' | 'safety'

export type LocationScore = {
  category: LocationCategory
  label: string
  score: number    // 0-100
  details: string
}

export type LocationAnalysis = {
  address: string
  scores: LocationScore[]
  totalScore: number
  grade: string   // A+ ~ F
}

const locationProfiles: Record<string, LocationScore[]> = {
  '강남구': [
    { category: 'transport', label: '교통', score: 92, details: '지하철 2호선·신분당선 도보 5분, 버스 노선 15개' },
    { category: 'school', label: '학군', score: 95, details: '대치초·대치중·휘문고, 학원가 밀집' },
    { category: 'amenity', label: '편의시설', score: 88, details: '이마트·롯데백화점·강남세브란스 등' },
    { category: 'foot_traffic', label: '유동인구', score: 90, details: '일 평균 유동인구 약 45만명' },
    { category: 'development', label: '개발호재', score: 72, details: 'GTX-A 삼성역 개통 예정, 영동대로 복합환승센터' },
    { category: 'safety', label: '치안', score: 85, details: 'CCTV 밀집, 자치경찰 순찰 강화 지역' },
  ],
  '서초구': [
    { category: 'transport', label: '교통', score: 88, details: '지하철 3·9호선, 고속버스터미널 인접' },
    { category: 'school', label: '학군', score: 90, details: '반포초·서초중·세화고, 학원가 인접' },
    { category: 'amenity', label: '편의시설', score: 85, details: '센트럴시티·고속터미널 지하상가' },
    { category: 'foot_traffic', label: '유동인구', score: 82, details: '일 평균 유동인구 약 35만명' },
    { category: 'development', label: '개발호재', score: 85, details: '반포 재건축, 신반포로 정비사업' },
    { category: 'safety', label: '치안', score: 88, details: '서초경찰서 관할, 안전지수 상위' },
  ],
  '송파구': [
    { category: 'transport', label: '교통', score: 85, details: '지하철 2·8·9호선, 잠실역 환승' },
    { category: 'school', label: '학군', score: 80, details: '잠실초·잠실중·잠실고' },
    { category: 'amenity', label: '편의시설', score: 90, details: '롯데월드몰·롯데타워·올림픽공원' },
    { category: 'foot_traffic', label: '유동인구', score: 95, details: '일 평균 유동인구 약 52만명 (잠실역 일대)' },
    { category: 'development', label: '개발호재', score: 78, details: 'MICE 복합단지, 잠실 스포츠 MICE 개발' },
    { category: 'safety', label: '치안', score: 82, details: '송파경찰서 관할, CCTV 확충 지역' },
  ],
  '마포구': [
    { category: 'transport', label: '교통', score: 82, details: '지하철 2·5·6호선·공항철도, 마포역 일대' },
    { category: 'school', label: '학군', score: 65, details: '아현초·서강중·서강대 인접' },
    { category: 'amenity', label: '편의시설', score: 78, details: '홍대입구 상권, 이마트 마포점' },
    { category: 'foot_traffic', label: '유동인구', score: 88, details: '일 평균 유동인구 약 40만명 (홍대 일대)' },
    { category: 'development', label: '개발호재', score: 70, details: '용산정비창 개발 수혜, 마포로 정비사업' },
    { category: 'safety', label: '치안', score: 75, details: '마포경찰서 관할' },
  ],
  '강동구': [
    { category: 'transport', label: '교통', score: 75, details: '지하철 5·9호선, 둔촌오륜역' },
    { category: 'school', label: '학군', score: 68, details: '둔촌초·배재중·배재고' },
    { category: 'amenity', label: '편의시설', score: 72, details: '현대백화점·강동경희대병원' },
    { category: 'foot_traffic', label: '유동인구', score: 65, details: '일 평균 유동인구 약 20만명' },
    { category: 'development', label: '개발호재', score: 90, details: '둔촌주공 재건축 완료(1.2만 세대), 고덕 신도시' },
    { category: 'safety', label: '치안', score: 78, details: '강동경찰서 관할, 신축 단지 보안 강화' },
  ],
}

function getGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 80) return 'B+'
  if (score >= 75) return 'B'
  if (score >= 70) return 'C+'
  if (score >= 65) return 'C'
  if (score >= 55) return 'D'
  return 'F'
}

export function analyzeLocation(address: string): LocationAnalysis {
  // Find matching region from address
  const region = Object.keys(locationProfiles).find((r) => address.includes(r))
  const scores = region
    ? locationProfiles[region]
    : [
        { category: 'transport' as LocationCategory, label: '교통', score: 70 + Math.floor(Math.random() * 20), details: '지하철·버스 접근성 보통' },
        { category: 'school' as LocationCategory, label: '학군', score: 60 + Math.floor(Math.random() * 25), details: '인근 학교 배정' },
        { category: 'amenity' as LocationCategory, label: '편의시설', score: 65 + Math.floor(Math.random() * 20), details: '생활편의시설 양호' },
        { category: 'foot_traffic' as LocationCategory, label: '유동인구', score: 55 + Math.floor(Math.random() * 30), details: '유동인구 보통 수준' },
        { category: 'development' as LocationCategory, label: '개발호재', score: 40 + Math.floor(Math.random() * 40), details: '특이 개발 사항 없음' },
        { category: 'safety' as LocationCategory, label: '치안', score: 70 + Math.floor(Math.random() * 20), details: '치안 상태 양호' },
      ]

  const totalScore = Math.round(scores.reduce((s, c) => s + c.score, 0) / scores.length)

  return {
    address,
    scores,
    totalScore,
    grade: getGrade(totalScore),
  }
}

// ============================================================
// Buy/Sell Signal Data (매수/매도 적기 신호등)
// ============================================================

export type SignalColor = 'green' | 'yellow' | 'red' | 'gray'

export type SignalIndicator = {
  key: string
  label: string
  value: number     // -100 ~ +100 (negative=bearish, positive=bullish)
  weight: number    // 0~1
  description: string
}

export type RegionSignal = {
  region: string
  signal: SignalColor
  score: number     // -100 ~ +100
  indicators: SignalIndicator[]
  aiComment?: string
}

type RegionSignalSeed = {
  region: string
  txVolume: number
  priceChange: number
  supplyChange: number
  interestRate: number
  unsold: number
}

const signalSeeds: RegionSignalSeed[] = [
  // Seoul
  { region: '강남구', txVolume: 35, priceChange: 20, supplyChange: -15, interestRate: -10, unsold: -25 },
  { region: '서초구', txVolume: 30, priceChange: 18, supplyChange: -10, interestRate: -10, unsold: -20 },
  { region: '송파구', txVolume: 25, priceChange: 12, supplyChange: -5, interestRate: -10, unsold: -15 },
  { region: '강동구', txVolume: 40, priceChange: 25, supplyChange: -20, interestRate: -10, unsold: -30 },
  { region: '마포구', txVolume: 20, priceChange: 8, supplyChange: 5, interestRate: -10, unsold: -10 },
  { region: '용산구', txVolume: 45, priceChange: 30, supplyChange: -25, interestRate: -10, unsold: -20 },
  { region: '성동구', txVolume: 15, priceChange: 5, supplyChange: 10, interestRate: -10, unsold: -5 },
  { region: '광진구', txVolume: 10, priceChange: 3, supplyChange: 8, interestRate: -10, unsold: 0 },
  { region: '동작구', txVolume: -5, priceChange: -3, supplyChange: 15, interestRate: -10, unsold: 10 },
  { region: '영등포구', txVolume: -10, priceChange: -8, supplyChange: 20, interestRate: -10, unsold: 15 },
  { region: '관악구', txVolume: -15, priceChange: -12, supplyChange: 25, interestRate: -10, unsold: 20 },
  { region: '노원구', txVolume: -20, priceChange: -15, supplyChange: 30, interestRate: -10, unsold: 25 },
  // Gyeonggi
  { region: '성남시 분당구', txVolume: 30, priceChange: 15, supplyChange: -10, interestRate: -10, unsold: -15 },
  { region: '수원시 영통구', txVolume: 10, priceChange: 5, supplyChange: 5, interestRate: -10, unsold: 0 },
  { region: '고양시 일산동구', txVolume: -10, priceChange: -5, supplyChange: 15, interestRate: -10, unsold: 10 },
  { region: '용인시 수지구', txVolume: 15, priceChange: 8, supplyChange: 0, interestRate: -10, unsold: -5 },
  { region: '화성시 동탄', txVolume: -25, priceChange: -18, supplyChange: 35, interestRate: -10, unsold: 30 },
  { region: '하남시', txVolume: 20, priceChange: 10, supplyChange: -5, interestRate: -10, unsold: -10 },
  { region: '과천시', txVolume: 35, priceChange: 22, supplyChange: -15, interestRate: -10, unsold: -20 },
  { region: '광명시', txVolume: 25, priceChange: 12, supplyChange: -8, interestRate: -10, unsold: -12 },
]

function getSignalColor(score: number): SignalColor {
  if (score >= 15) return 'green'
  if (score >= -15) return 'yellow'
  return 'red'
}

export function getRegionSignals(): RegionSignal[] {
  return signalSeeds.map((seed) => {
    const indicators: SignalIndicator[] = [
      {
        key: 'txVolume',
        label: '거래량 추이',
        value: seed.txVolume,
        weight: 0.25,
        description: seed.txVolume > 0
          ? `전월 대비 거래량 ${Math.abs(seed.txVolume)}% 증가`
          : `전월 대비 거래량 ${Math.abs(seed.txVolume)}% 감소`,
      },
      {
        key: 'priceChange',
        label: '매매가격 변동률',
        value: seed.priceChange,
        weight: 0.25,
        description: seed.priceChange > 0
          ? `전월 대비 ${(seed.priceChange * 0.1).toFixed(1)}% 상승`
          : `전월 대비 ${(Math.abs(seed.priceChange) * 0.1).toFixed(1)}% 하락`,
      },
      {
        key: 'supplyChange',
        label: '매물 증감 추이',
        value: seed.supplyChange,
        weight: 0.20,
        description: seed.supplyChange > 0
          ? `매물 ${Math.abs(seed.supplyChange)}% 증가 (공급 과잉 우려)`
          : `매물 ${Math.abs(seed.supplyChange)}% 감소 (희소성 증가)`,
      },
      {
        key: 'interestRate',
        label: '기준금리 방향',
        value: seed.interestRate,
        weight: 0.15,
        description: '한국은행 기준금리 3.00% (인하 기조)',
      },
      {
        key: 'unsold',
        label: '미분양 추이',
        value: seed.unsold,
        weight: 0.15,
        description: seed.unsold > 0
          ? `미분양 ${Math.abs(seed.unsold)}% 증가`
          : `미분양 ${Math.abs(seed.unsold)}% 감소`,
      },
    ]

    const score = Math.round(
      indicators.reduce((sum, ind) => sum + ind.value * ind.weight, 0),
    )

    return {
      region: seed.region,
      signal: getSignalColor(score),
      score,
      indicators,
    }
  })
}

export function getRegionSignalDetail(region: string): RegionSignal | null {
  return getRegionSignals().find((s) => s.region === region) ?? null
}

// ============================================================
// Regional Price Summary (지역별 시세 요약)
// ============================================================

export type RegionalPriceSummary = {
  region: string
  avgPrice: number        // 평당가 (만원)
  changeRate: number      // 전월대비 변동률 (%)
  txCount: number         // 월 거래건수
}

export function getRegionalPriceSummary(): RegionalPriceSummary[] {
  return [
    { region: '강남구', avgPrice: 8500, changeRate: 1.2, txCount: 142 },
    { region: '서초구', avgPrice: 7800, changeRate: 0.9, txCount: 98 },
    { region: '송파구', avgPrice: 6200, changeRate: 0.5, txCount: 187 },
    { region: '강동구', avgPrice: 4800, changeRate: 1.8, txCount: 156 },
    { region: '용산구', avgPrice: 6800, changeRate: 2.1, txCount: 67 },
    { region: '마포구', avgPrice: 4200, changeRate: 0.3, txCount: 124 },
    { region: '성동구', avgPrice: 4500, changeRate: 0.2, txCount: 95 },
    { region: '광진구', avgPrice: 3800, changeRate: 0.1, txCount: 78 },
    { region: '성남시 분당구', avgPrice: 5200, changeRate: 0.8, txCount: 134 },
    { region: '과천시', avgPrice: 5800, changeRate: 1.5, txCount: 45 },
  ]
}
