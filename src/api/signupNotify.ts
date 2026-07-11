// 신규 개공 가입 시 알림 메일 (자동 승인 정책)
// - 관리자(플랫폼 운영자)에게 새 가입 알림
// - 가입자에게 환영 + 자동 승인 안내
// 발송 실패는 non-fatal (회원가입 자체를 막지 않는다).

import { sendEmail } from '@/api/email'

/** 새 가입 알림을 받을 플랫폼 운영자 주소 (알림 수신용 — 권한 게이트 아님) */
const PLATFORM_ADMIN_EMAIL = 'junominu@gmail.com'

interface AgentSignupInfo {
  email: string
  displayName: string
  officeName: string
  representative: string
  phone: string
}

const wrap = (inner: string) => `<div style="font-family:'Malgun Gothic',sans-serif;max-width:600px;margin:0 auto;color:#0f172a">
  <div style="background:#1e40af;padding:20px 24px;border-radius:12px 12px 0 0">
    <span style="color:#fff;font-size:18px;font-weight:bold">중개프로</span>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:24px">
    ${inner}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
    <p style="color:#94a3b8;font-size:12px;margin:0">중개프로 · https://jungaepro.com</p>
  </div>
</div>`

/** 운영자에게 새 개공 가입 알림 */
export async function notifyAdminOfSignup(info: AgentSignupInfo): Promise<void> {
  await sendEmail({
    to: PLATFORM_ADMIN_EMAIL,
    subject: `[중개프로] 새 개공 가입 — ${info.officeName}`,
    html: wrap(`
      <h2 style="font-size:16px;margin:0 0 12px">새 공인중개사가 가입했습니다</h2>
      <table style="font-size:14px;line-height:1.9;border-collapse:collapse">
        <tr><td style="color:#64748b;padding-right:16px">사무소명</td><td><strong>${info.officeName}</strong></td></tr>
        <tr><td style="color:#64748b;padding-right:16px">대표자</td><td>${info.representative}</td></tr>
        <tr><td style="color:#64748b;padding-right:16px">이메일</td><td>${info.email}</td></tr>
        <tr><td style="color:#64748b;padding-right:16px">연락처</td><td>${info.phone || '-'}</td></tr>
      </table>
      <p style="font-size:13px;color:#64748b;margin:16px 0 0">자동 승인되어 사무소 포털이 즉시 활성화되었습니다. 자격 확인이 필요하면 슈퍼관리자에서 인증을 해제할 수 있습니다.</p>
    `),
    replyTo: info.email,
  })
}

/** 가입자에게 환영 + 자동 승인 안내 */
export async function sendAgentWelcome(info: AgentSignupInfo): Promise<void> {
  await sendEmail({
    to: info.email,
    subject: `[중개프로] ${info.officeName}님, 가입을 환영합니다`,
    html: wrap(`
      <h2 style="font-size:16px;margin:0 0 12px">${info.representative}님, 중개프로 가입을 환영합니다 🎉</h2>
      <p style="font-size:14px;line-height:1.8;margin:0 0 12px">
        <strong>${info.officeName}</strong> 사무소가 <strong>자동 승인</strong>되었습니다.
        지금 바로 로그인하여 매물 관리, 계약, 고객 관리, AI 도구를 사용하실 수 있습니다.
      </p>
      <p style="font-size:14px;line-height:1.8;margin:0 0 16px">
        환경설정 → 사무소 정보에서 <strong>서브도메인</strong>을 설정하면
        <strong>내 사무소명.jungaepro.com</strong> 전용 홈페이지가 즉시 생깁니다.
      </p>
      <a href="https://jungaepro.com/auth/login"
         style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:8px">
        로그인하고 시작하기
      </a>
    `),
  })
}
