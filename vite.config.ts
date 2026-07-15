import { defineConfig, loadEnv, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import path from 'path'

// Load all env vars (including non-VITE_ ones) for server-side plugins
const env = loadEnv('', process.cwd(), '')

/** Vite dev server plugin: proxies /api/generate-content → Gemini API (key stays server-side) */
function geminiProxy(): PluginOption {
  return {
    name: 'gemini-proxy',
    configureServer(server) {
      server.middlewares.use('/api/generate-content', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' })
          res.end()
          return
        }
        const apiKey = env.GEMINI_API_KEY
        if (!apiKey) { res.writeHead(500); res.end(JSON.stringify({ error: 'GEMINI_API_KEY not set' })); return }

        let rawBody = ''
        for await (const chunk of req) rawBody += chunk
        const { prompt, systemPrompt } = JSON.parse(rawBody)

        const model = 'gemini-3.1-pro-preview'
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
        const body: Record<string, unknown> = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, topP: 0.95, topK: 40, maxOutputTokens: 4096 },
        }
        if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }

        try {
          const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          const data = await resp.json() as Record<string, unknown>
          if (!resp.ok) { res.writeHead(resp.status); res.end(JSON.stringify({ error: (data?.error as Record<string, unknown>)?.message || `HTTP ${resp.status}` })); return }
          const text = ((data.candidates as Array<Record<string, unknown>>)?.[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>> | undefined
          const resultText = text?.[0]?.text as string | undefined
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ text: resultText || '' }))
        } catch (e) {
          res.writeHead(502)
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
        }
      })
    },
  }
}

/** Vite dev server plugin: proxies /api/geocode → Kakao Local API */
function kakaoGeoProxy(): PluginOption {
  return {
    name: 'kakao-geo-proxy',
    configureServer(server) {
      server.middlewares.use('/api/geocode', async (req, res) => {
        const restKey = env.KAKAO_REST_KEY
        if (!restKey) { res.writeHead(500); res.end(JSON.stringify({ error: 'KAKAO_REST_KEY not set' })); return }

        const url = new URL(req.url || '/', 'http://localhost')
        const query = url.searchParams.get('query')
        if (!query) { res.writeHead(400); res.end(JSON.stringify({ error: 'query required' })); return }

        try {
          const resp = await fetch(
            `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`,
            { headers: { Authorization: `KakaoAK ${restKey}` } },
          )
          const data = await resp.json()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(data))
        } catch (e) {
          res.writeHead(502)
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
        }
      })

      server.middlewares.use('/api/reverse-geocode', async (req, res) => {
        const restKey = env.KAKAO_REST_KEY
        if (!restKey) { res.writeHead(500); res.end(JSON.stringify({ error: 'KAKAO_REST_KEY not set' })); return }

        const url = new URL(req.url || '/', 'http://localhost')
        const x = url.searchParams.get('x')
        const y = url.searchParams.get('y')
        if (!x || !y) { res.writeHead(400); res.end(JSON.stringify({ error: 'x, y required' })); return }

        try {
          const resp = await fetch(
            `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${x}&y=${y}`,
            { headers: { Authorization: `KakaoAK ${restKey}` } },
          )
          const data = await resp.json()
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(data))
        } catch (e) {
          res.writeHead(502)
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
        }
      })
    },
  }
}

/** Vite dev server plugin: proxies /api/send-email → Resend API (key stays server-side) */
function resendEmailProxy(): PluginOption {
  return {
    name: 'resend-email-proxy',
    configureServer(server) {
      server.middlewares.use('/api/send-email', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' })
          res.end()
          return
        }
        const apiKey = env.RESEND_API_KEY
        if (!apiKey) { res.writeHead(500); res.end(JSON.stringify({ error: 'RESEND_API_KEY not set' })); return }

        let rawBody = ''
        for await (const chunk of req) rawBody += chunk
        const { to, subject, html, replyTo } = JSON.parse(rawBody)

        const payload: Record<string, unknown> = {
          from: 'onboarding@resend.dev',
          to,
          subject,
          html,
        }
        if (replyTo) payload.reply_to = replyTo

        try {
          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(payload),
          })
          const data = await resp.json() as Record<string, unknown>
          if (!resp.ok) {
            res.writeHead(resp.status, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: (data?.message as string) || `HTTP ${resp.status}` }))
            return
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(data))
        } catch (e) {
          res.writeHead(502)
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
        }
      })
    },
  }
}

/** Vite dev server plugin: proxies /api/real-trade-price → 국토부 실거래가 API */
function molitProxy(): PluginOption {
  // 인메모리 캐시 (dev 전용): key = "lawdCd|dealYmd|apiType", value = { data, cachedAt }
  const cache = new Map<string, { data: Record<string, unknown>[]; cachedAt: number }>()

  return {
    name: 'molit-proxy',
    configureServer(server) {
      server.middlewares.use('/api/real-trade-price', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' })
          res.end()
          return
        }
        const apiKey = env.MOLIT_API_KEY
        if (!apiKey) { res.writeHead(500); res.end(JSON.stringify({ error: 'MOLIT_API_KEY not set' })); return }

        let rawBody = ''
        for await (const chunk of req) rawBody += chunk
        const { lawdCd, dealYmd, apiType } = JSON.parse(rawBody)

        const endpoints: Record<string, string> = {
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

        const endpoint = endpoints[apiType]
        if (!endpoint) { res.writeHead(400); res.end(JSON.stringify({ error: `Unknown apiType: ${apiType}` })); return }

        // 캐시 확인 (당월 24h, 과거 월 7일)
        const cacheKey = `${lawdCd}|${dealYmd}|${apiType}`
        const now = new Date()
        const currentYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
        const cacheTtlMs = (dealYmd === currentYm ? 24 : 168) * 60 * 60 * 1000
        const hit = cache.get(cacheKey)
        if (hit && (Date.now() - hit.cachedAt) < cacheTtlMs) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ items: hit.data, totalCount: hit.data.length, cached: true }))
          return
        }

        const params = new URLSearchParams({ serviceKey: apiKey, LAWD_CD: lawdCd, DEAL_YMD: dealYmd, pageNo: '1', numOfRows: '1000' })

        try {
          const resp = await fetch(`${endpoint}?${params}`)
          const xml = await resp.text()

          const tag = (src: string, t: string) => { const m = src.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? m[1].trim() : '' }

          // #7: Edge Function과 동일하게 resultCode 검사 — dev에서 키/쿼터 오류를 빈 결과로 위장하지 않도록
          const resultCode = tag(xml, 'resultCode')
          if (resultCode && resultCode !== '00' && resultCode !== '000') {
            const resultMsg = tag(xml, 'resultMsg')
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: `국토부 API 오류: ${resultMsg} (${resultCode})` }))
            return
          }

          // Parse XML items
          const items: Record<string, unknown>[] = []
          const itemRegex = /<item>([\s\S]*?)<\/item>/g
          let match: RegExpExecArray | null
          const isRent = apiType.includes('rent')

          while ((match = itemRegex.exec(xml)) !== null) {
            const it = match[1]
            // 영문 태그: dealYear, dealMonth, dealDay
            const year = tag(it, 'dealYear') || tag(it, '년')
            const month = tag(it, 'dealMonth') || tag(it, '월')
            const day = tag(it, 'dealDay') || tag(it, '일')
            const dealDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            // 이름: aptNm(아파트), mhouseNm(연립다세대), offiNm(오피스텔) 등
            const name = tag(it, 'aptNm') || tag(it, 'mhouseNm') || tag(it, 'offiNm') || tag(it, 'houseNm') || tag(it, '아파트') || tag(it, '연립다세대') || ''
            const dong = tag(it, 'umdNm') || tag(it, 'sggNm') || tag(it, '법정동')
            const exclusiveArea = parseFloat(tag(it, 'excluUseAr') || tag(it, 'buildingAr') || tag(it, 'plottageAr') || tag(it, '전용면적') || '0')
            const floor = parseInt(tag(it, 'floor') || tag(it, '층')) || null
            const builtYear = parseInt(tag(it, 'buildYear') || tag(it, '건축년도')) || null

            if (isRent) {
              const deposit = parseInt((tag(it, 'deposit') || tag(it, '보증금액'))?.replace(/,/g, '')) || 0
              const monthly = parseInt((tag(it, 'monthlyRent') || tag(it, '월세금액'))?.replace(/,/g, '')) || 0
              items.push({ dealDate, name, dong, exclusiveArea, floor, builtYear, dealAmount: deposit, dealType: 'rent', deposit, monthlyRent: monthly || null })
            } else {
              const amount = parseInt((tag(it, 'dealAmount') || tag(it, '거래금액'))?.replace(/,/g, '').trim()) || 0
              items.push({ dealDate, name, dong, exclusiveArea, floor, builtYear, dealAmount: amount, dealType: 'trade', deposit: null, monthlyRent: null })
            }
          }

          // 캐시 저장
          cache.set(cacheKey, { data: items, cachedAt: Date.now() })

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ items, totalCount: items.length, cached: false }))
        } catch (e) {
          res.writeHead(502)
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
        }
      })
    },
  }
}

/** Vite dev server plugin: proxies /api/naver-news → 네이버 검색 API (1시간 캐시) */
function naverNewsProxy(): PluginOption {
  const cache = new Map<string, { data: unknown; cachedAt: number }>()
  const CACHE_TTL_MS = 60 * 60 * 1000 // 1시간

  return {
    name: 'naver-news-proxy',
    configureServer(server) {
      server.middlewares.use('/api/naver-news', async (req, res) => {
        const clientId = env.NAVER_CLIENT_ID
        const clientSecret = env.NAVER_CLIENT_SECRET
        if (!clientId || !clientSecret) { res.writeHead(500); res.end(JSON.stringify({ error: 'NAVER_CLIENT_ID/SECRET not set' })); return }

        const url = new URL(req.url || '/', 'http://localhost')
        const query = url.searchParams.get('query') || '부동산'
        const display = url.searchParams.get('display') || '5'
        const sort = url.searchParams.get('sort') || 'date'

        const cacheKey = `${query}|${display}|${sort}`
        const hit = cache.get(cacheKey)
        if (hit && (Date.now() - hit.cachedAt) < CACHE_TTL_MS) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(hit.data))
          return
        }

        try {
          const resp = await fetch(
            `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`,
            { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } },
          )
          const data = await resp.json()
          cache.set(cacheKey, { data, cachedAt: Date.now() })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(data))
        } catch (e) {
          res.writeHead(502)
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'proxy error' }))
        }
      })
    },
  }
}

/** Vite dev server plugin: proxies /api/payment → 토스 정기결제 (payment Edge Function 미러링) */
function paymentProxy(): PluginOption {
  const TOSS_API = 'https://api.tosspayments.com'
  const PRICE: Record<string, number> = { free: 0, basic: 3000, pro: 5000 }
  const LABEL: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro' }
  const RANK: Record<string, number> = { free: 0, basic: 1, pro: 2 }
  const authHeader = (k: string) => 'Basic ' + Buffer.from(k + ':').toString('base64')
  const addMonth = (d: Date) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x }
  const last4 = (m?: string) => (m ? (m.match(/(\d{4})\D*$/)?.[1] ?? m.slice(-4)) : '')

  return {
    name: 'payment-proxy',
    configureServer(server) {
      server.middlewares.use('/api/payment', async (req, res) => {
        const send = (b: unknown, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(b)) }
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' })
          res.end(); return
        }

        const secretKey = env.TOSS_SECRET_KEY
        const supaUrl = env.VITE_SUPABASE_URL
        const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
        if (!secretKey || !supaUrl || !serviceKey) return send({ error: 'TOSS_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY 미설정 (.env)' }, 500)

        const token = ((req.headers['authorization'] as string | undefined) ?? '').replace('Bearer ', '')
        if (!token) return send({ error: '로그인이 필요합니다.' }, 401)

        const admin = createClient(supaUrl, serviceKey)
        const { data: userData, error: userErr } = await admin.auth.getUser(token)
        if (userErr || !userData?.user) return send({ error: '인증에 실패했습니다.' }, 401)
        const userEmail = userData.user.email ?? undefined
        const { data: agent, error: agentErr } = await admin
          .from('agent_profiles').select('id, subscription_plan, office_name, representative')
          .eq('user_id', userData.user.id).single()
        if (agentErr || !agent) return send({ error: '중개사만 결제를 관리할 수 있습니다.' }, 403)

        let raw = ''
        for await (const chunk of req) raw += chunk
        const body = JSON.parse(raw || '{}')
        const action = body.action

        type TossPayment = { status?: string; method?: string; approvedAt?: string; paymentKey?: string; receipt?: { url?: string } }
        type TossIssue = { billingKey: string; cardCompany?: string; card?: { company?: string; number?: string } }
        const tossFetch = async <T>(path: string, payload: unknown): Promise<T> => {
          const r = await fetch(`${TOSS_API}${path}`, { method: 'POST', headers: { Authorization: authHeader(secretKey), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          const d = await r.json() as T & { message?: string }
          if (!r.ok) throw new Error(d?.message || `토스 오류 (${r.status})`)
          return d
        }
        const chargeAndRecord = async (plan: 'basic' | 'pro', billingKey: string, customerKey: string) => {
          const orderId = `sub_${randomUUID()}`
          const p = await tossFetch<TossPayment>(`/v1/billing/${billingKey}`, { customerKey, amount: PRICE[plan], orderId, orderName: `중개프로 ${LABEL[plan]} 구독`, customerEmail: userEmail, customerName: agent.representative || agent.office_name })
          if (p.status !== 'DONE') throw new Error('결제가 완료되지 않았습니다.')
          await admin.from('payment_history').insert({ agent_id: agent.id, order_id: orderId, plan, amount: PRICE[plan], status: 'paid', method: p.method ?? null, receipt_url: p.receipt?.url ?? null, payment_key: p.paymentKey ?? null, approved_at: p.approvedAt ?? null, raw: p })
          return p
        }

        try {
          if (action === 'issue') {
            const { authKey, customerKey, plan } = body
            if (!authKey || !customerKey || (plan !== 'basic' && plan !== 'pro')) return send({ error: '잘못된 요청입니다.' }, 400)
            if (customerKey !== agent.id) return send({ error: '고객 식별자가 일치하지 않습니다.' }, 403)
            const issued = await tossFetch<TossIssue>('/v1/billing/authorizations/issue', { authKey, customerKey })
            const company = issued.cardCompany ?? issued.card?.company ?? null
            const now = new Date(); const periodEnd = addMonth(now)
            await chargeAndRecord(plan, issued.billingKey, customerKey)
            await admin.from('billing_subscriptions').upsert({ agent_id: agent.id, customer_key: customerKey, billing_key: issued.billingKey, card_company: company, card_last4: last4(issued.card?.number), plan, status: 'active', pending_plan: null, cancel_at_period_end: false, current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(), updated_at: now.toISOString() }, { onConflict: 'agent_id' })
            await admin.from('agent_profiles').update({ subscription_plan: plan, subscription_started_at: now.toISOString() }).eq('id', agent.id)
            return send({ ok: true, plan, card_company: company, card_last4: last4(issued.card?.number), current_period_end: periodEnd.toISOString() })
          }

          const { data: sub } = await admin.from('billing_subscriptions').select('*').eq('agent_id', agent.id).single()

          if (action === 'change') {
            const plan = body.plan
            if (!['free', 'basic', 'pro'].includes(plan)) return send({ error: '잘못된 플랜입니다.' }, 400)
            if (!sub) return send({ error: '등록된 결제 수단이 없습니다. 먼저 카드를 등록해주세요.' }, 400)
            const current = agent.subscription_plan; const now = new Date()
            if (plan === current) {
              if (sub.pending_plan || sub.cancel_at_period_end) await admin.from('billing_subscriptions').update({ pending_plan: null, cancel_at_period_end: false, status: 'active', updated_at: now.toISOString() }).eq('agent_id', agent.id)
              return send({ ok: true, plan, resumed: true })
            }
            if (RANK[plan] > RANK[current]) {
              await chargeAndRecord(plan, sub.billing_key, sub.customer_key)
              const periodEnd = addMonth(now)
              await admin.from('billing_subscriptions').update({ plan, status: 'active', pending_plan: null, cancel_at_period_end: false, current_period_start: now.toISOString(), current_period_end: periodEnd.toISOString(), updated_at: now.toISOString() }).eq('agent_id', agent.id)
              await admin.from('agent_profiles').update({ subscription_plan: plan, subscription_started_at: now.toISOString() }).eq('id', agent.id)
              return send({ ok: true, plan, immediate: true, current_period_end: periodEnd.toISOString() })
            }
            await admin.from('billing_subscriptions').update({ pending_plan: plan, cancel_at_period_end: plan === 'free', updated_at: now.toISOString() }).eq('agent_id', agent.id)
            return send({ ok: true, plan: current, pending_plan: plan, effective_at: sub.current_period_end })
          }

          if (action === 'cancel') {
            if (!sub) return send({ error: '구독 정보가 없습니다.' }, 400)
            await admin.from('billing_subscriptions').update({ pending_plan: 'free', cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq('agent_id', agent.id)
            return send({ ok: true, canceled_at_period_end: sub.current_period_end })
          }

          return send({ error: '알 수 없는 요청입니다.' }, 400)
        } catch (e) {
          return send({ error: e instanceof Error ? e.message : 'proxy error' }, 502)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), geminiProxy(), kakaoGeoProxy(), resendEmailProxy(), molitProxy(), naverNewsProxy(), paymentProxy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
  },
})
