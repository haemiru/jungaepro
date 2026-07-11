import { corsHeaders } from '../_shared/cors.ts'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
// 발신 주소: Resend 인증 도메인 주소를 RESEND_FROM 시크릿으로 설정.
// 미설정 시 onboarding@resend.dev(테스트 발신자, 계정 본인에게만 발송 가능)로 폴백.
// 예: supabase secrets set RESEND_FROM="중개프로 <noreply@jungaepro.com>"
const FROM_ADDRESS = Deno.env.get('RESEND_FROM') ?? 'onboarding@resend.dev'

interface RequestBody {
  to: string
  subject: string
  html: string
  replyTo?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY가 서버에 설정되지 않았습니다.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { to, subject, html, replyTo } = (await req.json()) as RequestBody

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'to, subject, html은 필수 항목입니다.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const payload: Record<string, unknown> = {
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    }
    if (replyTo) payload.reply_to = replyTo

    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data?.message || `Resend API 오류: HTTP ${res.status}`, statusCode: res.status }),
        { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ id: data.id }),
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
