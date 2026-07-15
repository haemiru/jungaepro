// 토스페이먼츠 정기결제(빌링) 공용 헬퍼 — payment / billing-cron 함수가 공유
// 카드정보는 토스 결제창에서만 입력되고, 서버는 authKey → billingKey 발급 후
// billingKey 로 자동결제를 승인한다. (https://docs.tosspayments.com/guides/v2/billing/integration)

const TOSS_API = 'https://api.tosspayments.com'

export const PLAN_PRICE: Record<string, number> = { free: 0, basic: 3000, pro: 5000 }
export const PLAN_LABEL: Record<string, string> = { free: 'Free', basic: 'Basic', pro: 'Pro' }
export const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2 }

export class TossError extends Error {
  code?: string
  statusCode?: number
  constructor(message: string, code?: string, statusCode?: number) {
    super(message)
    this.name = 'TossError'
    this.code = code
    this.statusCode = statusCode
  }
}

// 시크릿 키 + ":" 를 Base64 로 인코딩한 Basic 인증 헤더
function authHeader(secretKey: string): string {
  return 'Basic ' + btoa(secretKey + ':')
}

/** authKey → billingKey 발급 */
export async function issueBillingKey(secretKey: string, authKey: string, customerKey: string) {
  const res = await fetch(`${TOSS_API}/v1/billing/authorizations/issue`, {
    method: 'POST',
    headers: { Authorization: authHeader(secretKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ authKey, customerKey }),
  })
  const data = await res.json()
  if (!res.ok) throw new TossError(data?.message || '빌링키 발급에 실패했습니다.', data?.code, res.status)
  return data as {
    billingKey: string
    cardCompany?: string
    card?: { company?: string; number?: string }
    customerKey: string
  }
}

/** billingKey 로 자동결제 승인 */
export async function chargeBilling(
  secretKey: string,
  billingKey: string,
  params: {
    customerKey: string
    amount: number
    orderId: string
    orderName: string
    customerEmail?: string
    customerName?: string
  },
) {
  const res = await fetch(`${TOSS_API}/v1/billing/${billingKey}`, {
    method: 'POST',
    headers: { Authorization: authHeader(secretKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await res.json()
  if (!res.ok) throw new TossError(data?.message || '결제 승인에 실패했습니다.', data?.code, res.status)
  return data as {
    status: string
    paymentKey?: string
    method?: string
    approvedAt?: string
    receipt?: { url?: string }
  }
}

/** 결제 기간 +1개월 */
export function addOneMonth(from: Date): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + 1)
  return d
}

/** 마스킹된 카드번호에서 끝 4자리 추출 */
export function cardLast4(masked: string | undefined): string {
  if (!masked) return ''
  const m = masked.match(/(\d{4})\D*$/)
  return m ? m[1] : masked.slice(-4)
}
