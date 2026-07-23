// 개공 ↔ 슈퍼관리자 문의 채널 (인앱 스레드)
// 쓰기는 SECURITY DEFINER RPC 경유, 읽기는 RLS 보호된 직접 SELECT.
import { supabase } from '@/api/supabase'
import { getAgentProfileId } from '@/api/helpers'
import type { Database } from '@/types/database'

export type SupportTicket = Database['public']['Tables']['support_tickets']['Row']
export type SupportTicketMessage = Database['public']['Tables']['support_ticket_messages']['Row']
export type AdminSupportTicket = Database['public']['Functions']['admin_get_support_tickets']['Returns'][number]
export type SupportTicketStatus = 'open' | 'answered' | 'closed'

export const SUPPORT_CATEGORIES = [
  { value: 'general', label: '일반 문의' },
  { value: 'billing', label: '결제/요금제' },
  { value: 'bug', label: '오류 신고' },
  { value: 'feature', label: '기능 요청' },
  { value: 'account', label: '계정/인증' },
] as const

export function supportCategoryLabel(value: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.value === value)?.label ?? '일반 문의'
}

// ─── 개공 측 ────────────────────────────────────────────

/** 내 사무소의 문의 스레드 목록 (최신 메시지순) */
export async function fetchMySupportTickets(): Promise<SupportTicket[]> {
  const agentId = await getAgentProfileId()
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('agent_id', agentId)
    .order('last_message_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** 새 문의 생성 → 티켓 id 반환 */
export async function createSupportTicket(params: {
  subject: string
  category: string
  body: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_subject: params.subject,
    p_category: params.category,
    p_body: params.body,
  })
  if (error) throw error
  return data as string
}

// ─── 슈퍼관리자 측 ──────────────────────────────────────

/** 전체 문의함 (개공 정보 조인 + 미확인 여부) */
export async function fetchAllSupportTickets(): Promise<AdminSupportTicket[]> {
  const { data, error } = await supabase.rpc('admin_get_support_tickets')
  if (error) throw error
  return data ?? []
}

// ─── 공통 ───────────────────────────────────────────────

/** 스레드 메시지 (오래된 순) */
export async function fetchSupportMessages(ticketId: string): Promise<SupportTicketMessage[]> {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** 메시지 작성 (발신 주체는 서버가 판별: 슈퍼관리자=admin, 그 외=agent) */
export async function postSupportMessage(ticketId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('post_support_message', {
    p_ticket_id: ticketId,
    p_body: body,
  })
  if (error) throw error
}

/** 현재 사용자 기준 읽음 처리 */
export async function markSupportTicketRead(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_support_ticket_read', { p_ticket_id: ticketId })
  if (error) throw error
}

/** 상태 변경 (open/answered/closed) */
export async function setSupportTicketStatus(ticketId: string, status: SupportTicketStatus): Promise<void> {
  const { error } = await supabase.rpc('set_support_ticket_status', {
    p_ticket_id: ticketId,
    p_status: status,
  })
  if (error) throw error
}

/** 개공 측: 티켓 목록에서 미확인(슈퍼관리자 답변 후 안 읽음) 개수 */
export function countAgentUnread(tickets: SupportTicket[]): number {
  return tickets.filter(
    (t) => t.last_sender === 'admin' && new Date(t.last_message_at) > new Date(t.agent_last_read_at)
  ).length
}
