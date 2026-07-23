// 문의 채널 이메일 알림 (발송 실패는 non-fatal — 문의/답변 자체는 유지)
// - 개공이 문의/답장 → 슈퍼관리자에게 알림
// - 슈퍼관리자가 답변 → 개공에게 알림
import { sendEmail } from '@/api/email'

/** 문의 알림을 받을 플랫폼 운영자 주소 (알림 수신용 — 권한 게이트 아님) */
const PLATFORM_ADMIN_EMAIL = 'junominu@gmail.com'

const SUPER_ADMIN_URL = 'https://jungaepro.com/super-admin'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 본문 미리보기 (줄바꿈 보존, 최대 500자) */
function bodyPreview(body: string): string {
  const trimmed = body.length > 500 ? body.slice(0, 500) + '…' : body
  return escapeHtml(trimmed).replace(/\n/g, '<br/>')
}

const wrap = (inner: string) => `<div style="font-family:'Malgun Gothic',sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
  <div style="background:#1e40af;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold">중개프로 고객지원</span>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    ${inner}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
    <p style="color:#94a3b8;font-size:12px;margin:0">중개프로 · https://jungaepro.com</p>
  </div>
</div>`

const quoteBox = (body: string) => `<div style="margin:12px 0;padding:14px 16px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:6px;font-size:14px;line-height:1.7;color:#334155">${bodyPreview(body)}</div>`

interface NewTicketInfo {
  officeName: string
  representative: string
  email: string
  subject: string
  categoryLabel: string
  body: string
}

/** 개공이 새 문의를 등록함 → 슈퍼관리자 알림 */
export async function notifyNewSupportTicket(info: NewTicketInfo): Promise<void> {
  await sendEmail({
    to: PLATFORM_ADMIN_EMAIL,
    subject: `[중개프로 문의] ${info.subject} — ${info.officeName}`,
    replyTo: info.email,
    html: wrap(`
      <h2 style="font-size:16px;margin:0 0 12px">새 문의가 접수되었습니다</h2>
      <table style="font-size:14px;line-height:1.9;border-collapse:collapse">
        <tr><td style="color:#64748b;padding-right:16px">사무소</td><td><strong>${escapeHtml(info.officeName)}</strong></td></tr>
        <tr><td style="color:#64748b;padding-right:16px">대표자</td><td>${escapeHtml(info.representative)}</td></tr>
        <tr><td style="color:#64748b;padding-right:16px">이메일</td><td>${escapeHtml(info.email)}</td></tr>
        <tr><td style="color:#64748b;padding-right:16px">분류</td><td>${escapeHtml(info.categoryLabel)}</td></tr>
        <tr><td style="color:#64748b;padding-right:16px">제목</td><td>${escapeHtml(info.subject)}</td></tr>
      </table>
      ${quoteBox(info.body)}
      <a href="${SUPER_ADMIN_URL}" style="display:inline-block;margin-top:8px;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:8px">문의함에서 답변하기</a>
    `),
  })
}

interface AgentReplyInfo {
  officeName: string
  subject: string
  body: string
}

/** 개공이 기존 스레드에 답장함 → 슈퍼관리자 알림 */
export async function notifyAdminOfAgentReply(info: AgentReplyInfo): Promise<void> {
  await sendEmail({
    to: PLATFORM_ADMIN_EMAIL,
    subject: `[중개프로 문의] 답장 — ${info.subject} (${info.officeName})`,
    html: wrap(`
      <h2 style="font-size:16px;margin:0 0 12px">${escapeHtml(info.officeName)}님이 답장을 보냈습니다</h2>
      <p style="font-size:14px;color:#64748b;margin:0 0 4px">문의: ${escapeHtml(info.subject)}</p>
      ${quoteBox(info.body)}
      <a href="${SUPER_ADMIN_URL}" style="display:inline-block;margin-top:8px;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:8px">문의함에서 확인하기</a>
    `),
  })
}

interface AdminReplyInfo {
  toEmail: string
  officeName: string
  representative: string
  subject: string
  body: string
  slug: string | null
}

/** 슈퍼관리자가 답변함 → 개공 알림 */
export async function notifyAgentOfSupportReply(info: AdminReplyInfo): Promise<void> {
  const loginUrl = info.slug ? `https://${info.slug}.jungaepro.com/admin/support` : 'https://jungaepro.com/admin/support'
  await sendEmail({
    to: info.toEmail,
    subject: `[중개프로] 문의하신 "${info.subject}"에 답변이 등록되었습니다`,
    html: wrap(`
      <h2 style="font-size:16px;margin:0 0 12px">${escapeHtml(info.representative || info.officeName)}님, 문의에 답변이 등록되었습니다</h2>
      <p style="font-size:14px;color:#64748b;margin:0 0 4px">문의: ${escapeHtml(info.subject)}</p>
      ${quoteBox(info.body)}
      <p style="font-size:13px;line-height:1.7;color:#334155;margin:0 0 16px">관리자 포털의 <strong>고객지원</strong>에서 전체 내용을 확인하고 이어서 답장하실 수 있습니다.</p>
      <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:8px">답변 확인하기</a>
    `),
  })
}
