import { supabase, supabaseAuth } from './supabase'
import { notifyAdminOfSignup, sendAgentWelcome } from './signupNotify'
import type { UserRole, StaffRole } from '@/types/database'

interface SignUpParams {
  email: string
  password: string
  displayName: string
  phone?: string
  role: UserRole
  agentData?: {
    officeName: string
    representative: string
    businessNumber: string
    licenseNumber: string
    address: string
    phone: string
  }
  staffInviteCode?: string
  staffRole?: StaffRole
}

export async function signUpWithEmail({ email, password, displayName, phone, role, agentData, staffInviteCode, staffRole }: SignUpParams) {
  const { data, error } = await supabaseAuth.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        phone,
        role,
        ...(agentData ? { agent_data: agentData } : {}),
        ...(staffInviteCode ? { invite_code: staffInviteCode } : {}),
        ...(staffRole ? { staff_role: staffRole } : {}),
      },
    },
  })

  if (error) throw error
  if (!data.user) throw new Error('회원가입에 실패했습니다.')

  // DB trigger (handle_new_user)가 public.users에 프로필을 자동 생성합니다 (SECURITY DEFINER).
  // 이메일 확인이 활성화된 경우 세션이 없어 RLS로 upsert가 실패할 수 있으므로 non-fatal 처리합니다.
  const { error: profileError } = await supabase.from('users').upsert({
    id: data.user.id,
    email,
    role,
    display_name: displayName,
    phone: phone ?? null,
  }, { onConflict: 'id' })

  if (profileError) {
    console.warn('Profile upsert skipped (DB trigger will handle):', profileError.message)
  }

  // Create agent profile if role is agent (자동 승인: is_verified = true)
  if (role === 'agent' && agentData) {
    const { error: agentError } = await supabase.from('agent_profiles').insert({
      user_id: data.user.id,
      office_name: agentData.officeName,
      representative: agentData.representative,
      business_number: agentData.businessNumber,
      license_number: agentData.licenseNumber,
      address: agentData.address,
      phone: agentData.phone,
      is_verified: true,
      subscription_plan: 'free',
    })

    if (agentError) {
      console.warn('Agent profile creation deferred:', agentError.message)
    }

    // 가입 알림 메일 (운영자 알림 + 가입자 환영). 실패해도 회원가입은 성공 처리.
    const info = {
      email,
      displayName,
      officeName: agentData.officeName,
      representative: agentData.representative,
      phone: agentData.phone,
    }
    void notifyAdminOfSignup(info).catch((e) => console.warn('admin signup notify failed:', e))
    void sendAgentWelcome(info).catch((e) => console.warn('agent welcome email failed:', e))
  }

  // Safety net for staff: try client-side staff_members insert (non-fatal, trigger should handle it)
  if (role === 'staff' && staffInviteCode) {
    const validated = await validateInviteCode(staffInviteCode)

    if (validated) {
      const resolvedStaffRole = staffRole ?? 'assistant'
      const permissions = resolvedStaffRole === 'associate_agent'
        ? {
            property_create: true, property_delete: false,
            contract_create: true, contract_approve: false, e_signature: false,
            customer_view: true, ai_tools: true, co_brokerage: false, settings: false,
          }
        : {
            property_create: true, property_delete: false,
            contract_create: false, contract_approve: false, e_signature: false,
            customer_view: true, ai_tools: false, co_brokerage: false, settings: false,
          }

      const { error: staffError } = await supabase.from('staff_members').insert({
        agent_profile_id: validated.agentProfileId,
        user_id: data.user.id,
        role: resolvedStaffRole,
        permissions,
        is_active: true,
      })

      if (staffError) {
        console.warn('Staff member creation deferred (trigger may have handled):', staffError.message)
      }
    }
  }

  return data
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabaseAuth.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

export async function getAgentProfile(userId: string) {
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data
}

// ──────────────────────────────────────────
// Password Change
// ──────────────────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user?.email) throw new Error('로그인 상태를 확인할 수 없습니다.')

  // Verify current password by re-signing in
  const { error: verifyError } = await supabaseAuth.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyError) throw new Error('현재 비밀번호가 올바르지 않습니다.')

  // Update password
  const { error } = await supabaseAuth.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ──────────────────────────────────────────
// MFA (TOTP)
// ──────────────────────────────────────────

export async function enrollTOTP() {
  const { data, error } = await supabaseAuth.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw error
  return data // { id, type, totp: { qr_code, secret, uri } }
}

export async function verifyTOTPEnrollment(factorId: string, code: string) {
  const { data: challenge, error: challengeError } = await supabaseAuth.auth.mfa.challenge({ factorId })
  if (challengeError) throw challengeError

  const { error: verifyError } = await supabaseAuth.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  })
  if (verifyError) throw verifyError
}

export async function unenrollTOTP(factorId: string) {
  const { error } = await supabaseAuth.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

export async function verifyMFACode(code: string) {
  const { data: factors } = await supabaseAuth.auth.mfa.listFactors()
  const totp = factors?.totp?.[0]
  if (!totp) throw new Error('등록된 2단계 인증이 없습니다.')

  const { data: challenge, error: challengeError } = await supabaseAuth.auth.mfa.challenge({ factorId: totp.id })
  if (challengeError) throw challengeError

  const { error: verifyError } = await supabaseAuth.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  })
  if (verifyError) throw new Error('인증 코드가 올바르지 않습니다.')
}

// ──────────────────────────────────────────
// Login Records
// ──────────────────────────────────────────

function parseUserAgent(ua: string): string {
  let browser = 'Unknown'
  if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'

  let os = 'Unknown'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('iPhone')) os = 'iPhone'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('Linux')) os = 'Linux'

  return `${browser} / ${os}`
}

async function getClientIP(): Promise<string | null> {
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = await res.json()
    return data.ip ?? null
  } catch {
    return null
  }
}

/** Record a login event. Non-fatal — failures are silently ignored. */
export async function recordLogin() {
  try {
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return

    const ip = await getClientIP()

    await supabase.from('login_records').insert({
      user_id: user.id,
      ip_address: ip,
      user_agent: navigator.userAgent,
    })
  } catch {
    // Non-fatal: don't block login flow
  }
}

export async function fetchLoginRecords(): Promise<{ date: string; ip: string; device: string }[]> {
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('login_records')
    .select('created_at, ip_address, user_agent')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  return (data ?? []).map((r) => ({
    date: r.created_at,
    ip: r.ip_address ?? '-',
    device: r.user_agent ? parseUserAgent(r.user_agent) : '-',
  }))
}

// ──────────────────────────────────────────
// Invite Code Validation
// ──────────────────────────────────────────

export async function validateInviteCode(code: string): Promise<{ officeName: string; agentProfileId: string } | null> {
  const upperCode = code.toUpperCase()

  // agent_profiles.invite_code 컬럼 직접 조회
  const { data: profile, error } = await supabase
    .from('agent_profiles')
    .select('id, office_name')
    .eq('invite_code', upperCode)
    .maybeSingle()

  if (error) {
    console.error('invite code validation error:', error)
    return null
  }

  if (!profile) return null
  return { officeName: profile.office_name, agentProfileId: profile.id }
}
