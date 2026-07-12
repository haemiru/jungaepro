import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 국토부 실거래가 API 엔드포인트
const API_ENDPOINTS: Record<string, string> = {
  apt_trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  apt_rent: 'http://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
  officetel_trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade',
  officetel_rent: 'http://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent',
  row_house_trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade',
  row_house_rent: 'http://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
  house_trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade',
  house_rent: 'http://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent',
  land_trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade',
  commercial_trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade',
  factory_trade: 'http://apis.data.go.kr/1613000/RTMSDataSvcInduTrade/getRTMSDataSvcInduTrade',
}

interface RequestBody {
  lawdCd: string        // 5-digit 시군구코드
  dealYmd: string        // YYYYMM
  apiType: string        // key from API_ENDPOINTS
}

interface TradeRecord {
  dealDate: string
  name: string
  dong: string
  exclusiveArea: number
  floor: number | null
  dealAmount: number
  builtYear: number | null
  dealType: 'trade' | 'rent'
  deposit: number | null
  monthlyRent: number | null
}

/** Extract text content from an XML tag */
function xmlTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)
  const m = xml.match(re)
  return m ? m[1].trim() : ''
}

/** Try multiple tag names, return first match */
function xmlTagAny(xml: string, ...tags: string[]): string {
  for (const t of tags) {
    const v = xmlTag(xml, t)
    if (v) return v
  }
  return ''
}

/** Parse XML items into TradeRecord array */
function parseItems(xml: string, apiType: string): TradeRecord[] {
  const items: TradeRecord[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null

  const isRent = apiType.includes('rent')

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const year = xmlTagAny(item, 'dealYear', '년')
    const month = xmlTagAny(item, 'dealMonth', '월')
    const day = xmlTagAny(item, 'dealDay', '일')
    const dealDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

    const name = xmlTagAny(item, 'aptNm', 'mhouseNm', 'offiNm', 'houseNm', '아파트', '연립다세대')
    const dong = xmlTagAny(item, 'umdNm', 'sggNm', '법정동')
    const exclusiveArea = parseFloat(xmlTagAny(item, 'excluUseAr', 'buildingAr', 'plottageAr', '전용면적') || '0')
    const floor = parseInt(xmlTagAny(item, 'floor', '층')) || null
    const builtYear = parseInt(xmlTagAny(item, 'buildYear', '건축년도')) || null

    if (isRent) {
      const deposit = parseInt(xmlTagAny(item, 'deposit', '보증금액')?.replace(/,/g, '')) || 0
      const monthly = parseInt(xmlTagAny(item, 'monthlyRent', '월세금액')?.replace(/,/g, '')) || 0
      items.push({
        dealDate, name, dong, exclusiveArea, floor, builtYear,
        dealAmount: deposit,
        dealType: 'rent',
        deposit,
        monthlyRent: monthly || null,
      })
    } else {
      const amount = parseInt(xmlTagAny(item, 'dealAmount', '거래금액')?.replace(/,/g, '').trim()) || 0
      items.push({
        dealDate, name, dong, exclusiveArea, floor, builtYear,
        dealAmount: amount,
        dealType: 'trade',
        deposit: null,
        monthlyRent: null,
      })
    }
  }

  return items
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('MOLIT_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'MOLIT_API_KEY가 서버에 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { lawdCd, dealYmd, apiType } = (await req.json()) as RequestBody

    if (!lawdCd || !dealYmd || !apiType) {
      return new Response(
        JSON.stringify({ error: 'lawdCd, dealYmd, apiType은 필수 항목입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const endpoint = API_ENDPOINTS[apiType]
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: `지원하지 않는 API 유형입니다: ${apiType}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 캐시 확인 ──
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const sb = createClient(supabaseUrl, supabaseKey)

    // 당월은 24시간, 과거 월은 7일 캐시
    const now = new Date()
    const currentYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const isCurrentMonth = dealYmd === currentYm
    const cacheTtlHours = isCurrentMonth ? 24 : 168 // 24h vs 7days

    const { data: cached } = await sb
      .from('real_trade_cache')
      .select('data, cached_at')
      .eq('lawd_cd', lawdCd)
      .eq('deal_ymd', dealYmd)
      .eq('api_type', apiType)
      .maybeSingle()

    if (cached) {
      const cachedAge = (Date.now() - new Date(cached.cached_at).getTime()) / (1000 * 60 * 60)
      if (cachedAge < cacheTtlHours) {
        const items = cached.data as TradeRecord[]
        return new Response(
          JSON.stringify({ items, totalCount: items.length, cached: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    // ── API 호출 ──
    const params = new URLSearchParams({
      serviceKey: apiKey,
      LAWD_CD: lawdCd,
      DEAL_YMD: dealYmd,
      pageNo: '1',
      numOfRows: '1000', // 거래 많은 시군구(예: 강남구) 월간 표본 절단 방지
    })

    const res = await fetch(`${endpoint}?${params}`)
    const xml = await res.text()

    const resultCode = xmlTag(xml, 'resultCode')
    // 국토부 성공 코드: 구형 '00', 신형(RTMSDataSvc…Dev) '000'
    if (resultCode && resultCode !== '00' && resultCode !== '000') {
      const resultMsg = xmlTag(xml, 'resultMsg')
      return new Response(
        JSON.stringify({ error: `국토부 API 오류: ${resultMsg} (${resultCode})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const items = parseItems(xml, apiType)

    // ── 캐시 저장 ──
    await sb
      .from('real_trade_cache')
      .upsert(
        { lawd_cd: lawdCd, deal_ymd: dealYmd, api_type: apiType, data: items, cached_at: new Date().toISOString() },
        { onConflict: 'lawd_cd,deal_ymd,api_type' },
      )

    return new Response(
      JSON.stringify({ items, totalCount: items.length, cached: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
