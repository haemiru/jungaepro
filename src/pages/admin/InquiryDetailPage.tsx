import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import type { Inquiry, InquiryReply, InquiryStatus, Property } from '@/types/database'
import { fetchInquiryById, fetchInquiryReplies, createInquiryReply, updateInquiryStatus } from '@/api/inquiries'
import { fetchPropertyById } from '@/api/properties'
import { findCustomerByPhone, ensureCustomerFromInquiry } from '@/api/customers'
import type { Customer } from '@/types/database'
import { generateContent, saveGenerationLog } from '@/api/gemini'
import { sendEmail } from '@/api/email'
import { Button } from '@/components/common'
import { inquiryStatusLabel, inquiryStatusIcon, inquiryStatusColor, inquiryTypeLabel, formatDateTime, formatPropertyPrice } from '@/utils/format'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

export function InquiryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { agentProfile } = useAuthStore()
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [replies, setReplies] = useState<InquiryReply[]>([])
  const [property, setProperty] = useState<Property | null>(null)
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Reply form
  const [replyContent, setReplyContent] = useState('')
  const [sentVia, setSentVia] = useState<Set<string>>(new Set(['email']))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDraftGenerating, setIsDraftGenerating] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    Promise.all([
      fetchInquiryById(id),
      fetchInquiryReplies(id),
    ]).then(([inq, reps]) => {
      if (cancelled) return
      setInquiry(inq)
      setReplies(reps)

      if (inq && inq.status === 'new') {
        updateInquiryStatus(inq.id, 'checked').then(() => {
          if (!cancelled) setInquiry((prev) => prev ? { ...prev, status: 'checked' } : prev)
        }).catch(() => {})
      }

      if (inq?.property_id) {
        fetchPropertyById(inq.property_id).then((p) => {
          if (!cancelled) setProperty(p)
        }).catch(() => {})
      }

      // CRM 연결된 고객 조회
      if (inq?.phone) {
        findCustomerByPhone(inq.phone).then((c) => {
          if (!cancelled) setLinkedCustomer(c)
        }).catch(() => {})
      }

      // 임시저장된 답변 복원
      const draft = localStorage.getItem(`inquiry-draft-${id}`)
      if (draft) {
        setReplyContent(draft)
        toast('임시저장된 답변을 불러왔습니다.', { icon: '📝' })
      }
    })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const toggleChannel = (channel: string) => {
    setSentVia((prev) => {
      const next = new Set(prev)
      if (next.has(channel)) { next.delete(channel) } else { next.add(channel) }
      return next
    })
  }

  const handleReply = async () => {
    if (!inquiry || !replyContent.trim()) {
      toast.error('답변 내용을 입력해주세요.')
      return
    }
    setIsSubmitting(true)
    try {
      // Save reply to DB
      const reply = await createInquiryReply({
        inquiry_id: inquiry.id,
        content: replyContent,
        sent_via: [...sentVia],
      })
      setReplies((prev) => [...prev, reply])
      setInquiry((prev) => prev ? { ...prev, status: 'answered' } : prev)

      const results: string[] = []

      // Send email via Resend if email channel selected
      if (sentVia.has('email') && inquiry.email) {
        try {
          const officeName = agentProfile?.office_name ?? '부동산'
          await sendEmail({
            to: inquiry.email,
            subject: `[${officeName}] 문의 답변 (${inquiry.inquiry_number})`,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#2563eb">${officeName}</h2>
              <p>${inquiry.name}님, 문의해주셔서 감사합니다.</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
              <div style="white-space:pre-wrap;line-height:1.8">${replyContent}</div>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
              <p style="color:#6b7280;font-size:13px">문의번호: ${inquiry.inquiry_number}<br/>
              ${agentProfile?.phone ? `연락처: ${agentProfile.phone}` : ''}</p>
            </div>`,
            replyTo: agentProfile?.phone ? undefined : undefined,
          })
          results.push('이메일 발송 완료')
        } catch {
          results.push('이메일 발송 실패')
        }
      } else if (sentVia.has('email') && !inquiry.email) {
        results.push('이메일 주소 없음')
      }

      // SMS: open sms: link
      if (sentVia.has('sms') && inquiry.phone) {
        const smsBody = encodeURIComponent(replyContent.slice(0, 200))
        window.open(`sms:${inquiry.phone}?body=${smsBody}`, '_self')
        results.push('문자 앱 열림')
      }

      setReplyContent('')
      if (id) localStorage.removeItem(`inquiry-draft-${id}`)
      toast.success(`답변 저장 완료${results.length ? '. ' + results.join(', ') : ''}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '답변 발송에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDraft = () => {
    if (!id) return
    if (!replyContent.trim()) {
      toast.error('저장할 답변 내용이 없습니다.')
      return
    }
    localStorage.setItem(`inquiry-draft-${id}`, replyContent)
    toast.success('답변이 임시저장되었습니다. 페이지를 다시 열면 자동으로 불러옵니다.')
  }

  const handleStatusChange = async (status: InquiryStatus) => {
    if (!inquiry) return
    await updateInquiryStatus(inquiry.id, status)
    setInquiry((prev) => prev ? { ...prev, status } : prev)
    toast.success(`상태를 "${inquiryStatusLabel[status]}"(으)로 변경했습니다.`)
  }

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
  }

  if (!inquiry) {
    return <div className="py-20 text-center"><p className="text-gray-500">문의를 찾을 수 없습니다.</p><Link to="/admin/inquiries" className="mt-3 inline-block text-sm text-primary-600 hover:underline">목록으로</Link></div>
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + 목록보기 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link to="/admin/inquiries" className="hover:text-gray-600">문의 관리</Link>
          <span>/</span>
          <span className="text-gray-600">{inquiry.inquiry_number}</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/inquiries')}>
          ← 목록보기
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Inquiry info + Reply */}
        <div className="space-y-6 lg:col-span-2">
          {/* Inquiry Content */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${inquiryStatusColor[inquiry.status]}`}>
                    {inquiryStatusIcon[inquiry.status]} {inquiryStatusLabel[inquiry.status]}
                  </span>
                  <span className="text-xs text-gray-400">{inquiryTypeLabel[inquiry.inquiry_type]}</span>
                </div>
                <p className="mt-2 text-xs text-gray-400">{inquiry.inquiry_number} · {formatDateTime(inquiry.created_at)}</p>
              </div>
              <select
                value={inquiry.status}
                onChange={(e) => handleStatusChange(e.target.value as InquiryStatus)}
                className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
              >
                <option value="new">새 문의</option>
                <option value="checked">확인</option>
                <option value="in_progress">진행중</option>
                <option value="answered">답변완료</option>
                <option value="closed">종결</option>
              </select>
            </div>

            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
              {inquiry.content}
            </div>

            {inquiry.preferred_visit_date && (
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2">
                <p className="text-xs font-medium text-blue-700">희망 방문일: {inquiry.preferred_visit_date}</p>
              </div>
            )}
          </div>

          {/* Linked Property */}
          {property && (
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="mb-2 text-xs font-semibold text-gray-500">관련 매물</p>
              <Link to={`/admin/properties/${property.id}`} className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50">
                <img
                  src={property.photos?.[0] || 'https://placehold.co/80x60/e2e8f0/94a3b8?text=No+Image'}
                  alt={property.title}
                  className="h-14 w-20 shrink-0 rounded-lg object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-gray-800">{property.title}</p>
                  <p className="text-xs text-gray-500">{property.address}</p>
                  <p className="text-sm font-bold text-primary-700">{formatPropertyPrice(property.transaction_type, property.sale_price, property.deposit, property.monthly_rent)}</p>
                </div>
              </Link>
            </div>
          )}

          {/* Previous Replies */}
          {replies.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-600">이전 답변 ({replies.length}건)</p>
              {replies.map((reply) => (
                <div key={reply.id} className="rounded-xl bg-primary-50 p-4 ring-1 ring-primary-100">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{reply.content}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="text-xs text-gray-400">{formatDateTime(reply.created_at)}</p>
                    {reply.sent_via.length > 0 && (
                      <div className="flex gap-1">
                        {reply.sent_via.map((ch) => (
                          <span key={ch} className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-medium text-primary-700">
                            {ch === 'email' ? '이메일' : ch === 'alimtalk' ? '알림톡' : 'SMS'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply Form */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">답변 작성</p>
              <button
                onClick={async () => {
                  if (!inquiry) return
                  setIsDraftGenerating(true)
                  try {
                    const propertyInfo = property
                      ? `\n\n관련 매물 정보:\n- 매물명: ${property.title}\n- 주소: ${property.address}\n- 거래유형/가격: ${formatPropertyPrice(property.transaction_type, property.sale_price, property.deposit, property.monthly_rent)}\n- 면적: ${property.exclusive_area_m2 ? `${property.exclusive_area_m2}㎡` : '-'}\n- 방수: ${property.rooms || '-'}개\n- 층수: ${property.floor || '-'}층\n- 옵션: ${property.options?.join(', ') || '-'}`
                      : ''

                    const prompt = `고객 문의에 대한 답변 초안을 작성해주세요.

고객명: ${inquiry.name}
문의유형: ${inquiryTypeLabel[inquiry.inquiry_type]}
문의내용:
${inquiry.content}
${inquiry.preferred_visit_date ? `\n희망 방문일: ${inquiry.preferred_visit_date}` : ''}${propertyInfo}

정중하고 전문적인 톤으로, 고객이 궁금해하는 내용에 직접적으로 답변해주세요.
문의 유형에 맞는 실용적 정보를 포함하세요.

사무소 정보 (답변 마무리에 활용):
- 사무소명: ${agentProfile?.office_name || '(미등록)'}
- 대표자: ${agentProfile?.representative || '(미등록)'}
- 대표 전화: ${agentProfile?.phone || '(미등록)'}
- 이메일: ${(agentProfile as Record<string, unknown>)?.email || '(미등록)'}
- 주소: ${agentProfile?.address || '(미등록)'}
- 영업시간: ${agentProfile?.business_hours ? Object.entries(agentProfile.business_hours as Record<string, { open: string; close: string; closed?: boolean }>).filter(([, v]) => !v.closed).map(([k, v]) => `${k} ${v.open}~${v.close}`).join(', ') || '평일 09:00~18:00' : '평일 09:00~18:00'}`

                    const systemPrompt = '공인중개사 사무소의 전문적이고 정중한 톤으로 고객 문의에 대한 답변을 작성하세요. 고객명을 호칭에 포함하고, 제공된 실제 사무소 정보로 연락처 안내를 마무리하세요. 절대 000-0000-0000 같은 placeholder를 사용하지 마세요. 정보가 "(미등록)"인 항목은 생략하세요.'

                    const text = await generateContent(prompt, systemPrompt)
                    setReplyContent(text)

                    await saveGenerationLog({
                      type: 'inquiry_reply',
                      input_data: { inquiry_id: inquiry.id, inquiry_number: inquiry.inquiry_number },
                      output_text: text,
                    })

                    toast.success('AI 답변 초안이 생성되었습니다. 검토 후 발송해주세요.')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'AI 답변 생성 중 오류가 발생했습니다.')
                  } finally {
                    setIsDraftGenerating(false)
                  }
                }}
                disabled={isDraftGenerating}
                className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50"
              >
                {isDraftGenerating ? 'AI 생성 중...' : 'AI 답변 초안 생성'}
              </button>
            </div>

            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={6}
              placeholder="답변 내용을 입력하세요..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />

            {/* Send channels — 알림톡은 카카오 비즈메시지 연동(Phase 4-2) 후 노출 */}
            {(() => {
              const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
              return (
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <p className="text-xs font-medium text-gray-500">발송 채널:</p>
                  {/* 이메일 */}
                  <label className="flex items-center gap-1.5 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={sentVia.has('email')}
                      onChange={() => toggleChannel('email')}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    이메일
                  </label>
                  {/* SMS: 모바일에서만 체크 가능, PC에서는 안내 토스트 */}
                  <label className="flex items-center gap-1.5 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={sentVia.has('sms')}
                      onChange={() => {
                        if (isMobile) {
                          toggleChannel('sms')
                        } else {
                          toast('SMS는 모바일에서 이용해 주세요.', { icon: '📱' })
                        }
                      }}
                      className={`h-4 w-4 rounded border-gray-300 ${isMobile ? 'text-primary-600' : 'text-gray-300'}`}
                    />
                    SMS
                  </label>
                </div>
              )
            })()}

            {/* Action buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={handleReply} isLoading={isSubmitting}>답변 발송</Button>
              <Button variant="outline" onClick={handleSaveDraft}>임시저장</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  toast.success('임장 예약으로 이동합니다.')
                  navigate('/admin/inspection')
                }}
              >
                임장 예약으로 등록 →
              </Button>
            </div>
          </div>
        </div>

        {/* Right: Inquirer info */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            {/* Inquirer Card */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="mb-3 text-xs font-semibold text-gray-500">문의자 정보</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">이름</span>
                  <span className="font-medium">{inquiry.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">연락처</span>
                  <span className="font-medium">{inquiry.phone}</span>
                </div>
                {inquiry.email && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">이메일</span>
                    <span className="font-medium">{inquiry.email}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                {/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? (
                  <>
                    <a
                      href={`tel:${inquiry.phone}`}
                      className="flex-1 rounded-lg bg-green-50 py-2 text-center text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      전화
                    </a>
                    <a
                      href={`sms:${inquiry.phone}`}
                      className="flex-1 rounded-lg bg-blue-50 py-2 text-center text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      문자
                    </a>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => toast('전화 기능은 모바일에서 이용해 주세요.', { icon: '📱' })}
                      className="flex-1 rounded-lg bg-green-50 py-2 text-center text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      전화
                    </button>
                    <button
                      onClick={() => toast('문자 기능은 모바일에서 이용해 주세요.', { icon: '📱' })}
                      className="flex-1 rounded-lg bg-blue-50 py-2 text-center text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      문자
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Status Change */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="mb-3 text-xs font-semibold text-gray-500">상태 변경</p>
              <div className="grid grid-cols-2 gap-2">
                {(['checked', 'in_progress', 'answered', 'closed'] as InquiryStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={inquiry.status === s}
                    className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      inquiry.status === s
                        ? 'bg-gray-100 text-gray-400'
                        : `${inquiryStatusColor[s]} hover:opacity-80`
                    }`}
                  >
                    {inquiryStatusIcon[s]} {inquiryStatusLabel[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* CRM Link */}
            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
              <p className="mb-3 text-xs font-semibold text-gray-500">고객 관리</p>
              {linkedCustomer ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">등록됨</span>
                    <span className="text-xs text-gray-600">{linkedCustomer.name}</span>
                  </div>
                  <Link
                    to={`/admin/customers/${linkedCustomer.id}`}
                    className="mt-2 block rounded-lg bg-primary-50 py-2 text-center text-xs font-medium text-primary-700 hover:bg-primary-100"
                  >
                    고객 상세 보기 →
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-xs text-gray-500">이 문의자는 아직 고객으로 등록되지 않았습니다.</p>
                  <button
                    onClick={async () => {
                      if (!inquiry) return
                      try {
                        const customer = await ensureCustomerFromInquiry({
                          name: inquiry.name,
                          phone: inquiry.phone,
                          email: inquiry.email,
                          inquiry_type: inquiry.inquiry_type,
                        })
                        setLinkedCustomer(customer)
                        toast.success('고객이 CRM에 등록되었습니다.')
                      } catch {
                        toast.error('고객 등록에 실패했습니다.')
                      }
                    }}
                    className="mt-2 block w-full rounded-lg bg-primary-50 py-2 text-center text-xs font-medium text-primary-700 hover:bg-primary-100"
                  >
                    고객으로 등록 →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
