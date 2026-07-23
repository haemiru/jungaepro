import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/stores/authStore'
import { formatRelativeTime } from '@/utils/format'
import {
  fetchMySupportTickets,
  fetchSupportMessages,
  createSupportTicket,
  postSupportMessage,
  markSupportTicketRead,
  setSupportTicketStatus,
  supportCategoryLabel,
  SUPPORT_CATEGORIES,
  type SupportTicket,
  type SupportTicketMessage,
} from '@/api/support'
import {
  notifyNewSupportTicket,
  notifyAdminOfAgentReply,
} from '@/api/supportNotify'

function statusBadge(t: SupportTicket) {
  const isNewReply = t.last_sender === 'admin' && new Date(t.last_message_at) > new Date(t.agent_last_read_at)
  if (t.status === 'closed') return { label: '종료', cls: 'bg-gray-100 text-gray-500' }
  if (t.status === 'answered') return { label: isNewReply ? '새 답변' : '답변 완료', cls: isNewReply ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700' }
  return { label: '답변 대기중', cls: 'bg-amber-100 text-amber-700' }
}

export function SupportPage() {
  const { user, agentProfile } = useAuthStore()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SupportTicketMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  // 새 문의 모달
  const [showNew, setShowNew] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [newBody, setNewBody] = useState('')
  const [newBusy, setNewBusy] = useState(false)

  const selected = useMemo(() => tickets.find((t) => t.id === selectedId) ?? null, [tickets, selectedId])

  const loadTickets = async () => {
    try {
      const data = await fetchMySupportTickets()
      setTickets(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '문의 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTickets()
  }, [])

  const openTicket = async (id: string) => {
    setSelectedId(id)
    setMsgLoading(true)
    setMessages([])
    try {
      const [msgs] = await Promise.all([
        fetchSupportMessages(id),
        markSupportTicketRead(id).catch(() => {}),
      ])
      setMessages(msgs)
      // 로컬 읽음 반영
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, agent_last_read_at: new Date().toISOString() } : t)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '대화를 불러올 수 없습니다.')
    } finally {
      setMsgLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newSubject.trim() || !newBody.trim()) {
      toast.error('제목과 내용을 입력하세요.')
      return
    }
    setNewBusy(true)
    try {
      const id = await createSupportTicket({ subject: newSubject.trim(), category: newCategory, body: newBody.trim() })
      // 운영자 알림 (실패해도 문의는 접수됨)
      void notifyNewSupportTicket({
        officeName: agentProfile?.office_name ?? '사무소',
        representative: agentProfile?.representative ?? '',
        email: user?.email ?? '',
        subject: newSubject.trim(),
        categoryLabel: supportCategoryLabel(newCategory),
        body: newBody.trim(),
      }).catch(() => {})
      toast.success('문의가 접수되었습니다.')
      setShowNew(false)
      setNewSubject('')
      setNewCategory('general')
      setNewBody('')
      await loadTickets()
      await openTicket(id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '문의 접수에 실패했습니다.')
    } finally {
      setNewBusy(false)
    }
  }

  const handleReply = async () => {
    if (!selected || !reply.trim()) return
    setReplyBusy(true)
    try {
      await postSupportMessage(selected.id, reply.trim())
      void notifyAdminOfAgentReply({
        officeName: agentProfile?.office_name ?? '사무소',
        subject: selected.subject,
        body: reply.trim(),
      }).catch(() => {})
      setReply('')
      const msgs = await fetchSupportMessages(selected.id)
      setMessages(msgs)
      await loadTickets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '전송에 실패했습니다.')
    } finally {
      setReplyBusy(false)
    }
  }

  const handleClose = async () => {
    if (!selected) return
    try {
      await setSupportTicketStatus(selected.id, 'closed')
      toast.success('문의를 종료했습니다.')
      await loadTickets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">고객지원</h1>
          <p className="mt-1 text-sm text-gray-500">중개프로 운영팀에 문의하거나 요청사항을 보낼 수 있습니다.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          새 문의
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Ticket list */}
        <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${selectedId ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-gray-400">
              아직 문의 내역이 없습니다.<br />궁금한 점이나 요청이 있으면 "새 문의"를 눌러주세요.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {tickets.map((t) => {
                const badge = statusBadge(t)
                const active = t.id === selectedId
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => openTicket(t.id)}
                      className={`w-full px-4 py-3 text-left transition hover:bg-gray-50 ${active ? 'bg-primary-50/60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-semibold text-gray-900">{t.subject}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                        <span>{supportCategoryLabel(t.category)}</span>
                        <span>·</span>
                        <span>{formatRelativeTime(t.last_message_at)}</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${selectedId ? '' : 'hidden lg:flex lg:items-center lg:justify-center'}`}>
          {!selected ? (
            <div className="px-4 py-16 text-center text-sm text-gray-400">문의를 선택하면 대화 내용이 표시됩니다.</div>
          ) : (
            <div className="flex h-full flex-col">
              {/* Thread header */}
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedId(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 lg:hidden">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                  </button>
                  <div>
                    <h2 className="line-clamp-1 text-sm font-bold text-gray-900">{selected.subject}</h2>
                    <p className="text-xs text-gray-400">{supportCategoryLabel(selected.category)}</p>
                  </div>
                </div>
                {selected.status !== 'closed' && (
                  <button onClick={handleClose} className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50">
                    문의 종료
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="max-h-[52vh] min-h-[240px] flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {msgLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_type === 'agent'
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] ${mine ? 'items-end' : 'items-start'}`}>
                          <div className={`mb-0.5 text-[11px] ${mine ? 'text-right text-gray-400' : 'text-gray-500'}`}>
                            {mine ? '나' : '중개프로 운영팀'}
                          </div>
                          <div className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${mine ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                            {m.body}
                          </div>
                          <div className={`mt-0.5 text-[10px] text-gray-300 ${mine ? 'text-right' : ''}`}>
                            {formatRelativeTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Reply box */}
              {selected.status === 'closed' ? (
                <div className="border-t border-gray-100 px-4 py-3 text-center text-xs text-gray-400">
                  종료된 문의입니다. 추가 문의는 "새 문의"로 등록해주세요.
                </div>
              ) : (
                <div className="border-t border-gray-100 p-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleReply()
                    }}
                    rows={2}
                    placeholder="메시지를 입력하세요… (Ctrl+Enter 전송)"
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={handleReply}
                      disabled={replyBusy || !reply.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-700 disabled:opacity-50"
                    >
                      {replyBusy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                      전송
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !newBusy && setShowNew(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900">새 문의 등록</h3>
            <p className="mt-1 text-sm text-gray-500">운영팀이 확인 후 답변드립니다.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">분류</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">제목</label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  maxLength={120}
                  placeholder="문의 제목"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">내용</label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={5}
                  placeholder="문의 또는 요청 내용을 자세히 적어주세요."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowNew(false)}
                disabled={newBusy}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={newBusy || !newSubject.trim() || !newBody.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {newBusy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                문의 접수
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
