import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input } from '@/components/common'
import { signUpWithEmail, validateInviteCode } from '@/api/auth'
import type { UserRole, StaffRole } from '@/types/database'
import { formatPhone, parsePhone, formatBusinessNumber, parseBusinessNumber } from '@/utils/format'
import toast from 'react-hot-toast'

type Step = 'role' | 'account' | 'agent-info' | 'invite-code'

export function SignupPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('role')
  const [role, setRole] = useState<UserRole>('agent')
  const [staffRole, setStaffRole] = useState<StaffRole>('associate_agent')
  const [isLoading, setIsLoading] = useState(false)

  // Account fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')

  // Agent fields
  const [officeName, setOfficeName] = useState('')
  const [representative, setRepresentative] = useState('')
  const [businessNumber, setBusinessNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [officeAddress, setOfficeAddress] = useState('')
  const [officeAddressDetail, setOfficeAddressDetail] = useState('')
  const [officePhone, setOfficePhone] = useState('')

  // Staff invite code fields
  const [inviteCode, setInviteCode] = useState('')
  const [validatedOffice, setValidatedOffice] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)

  const openPostcode = () => {
    const run = () => {
      new (window as unknown as Record<string, { Postcode: new (opts: Record<string, unknown>) => { open: () => void } }>).daum.Postcode({
        oncomplete: (data: { roadAddress: string; jibunAddress: string }) => {
          setOfficeAddress(data.roadAddress || data.jibunAddress)
          setOfficeAddressDetail('')
          // 상세주소 입력칸에 포커스
          setTimeout(() => {
            const detailInput = document.querySelector<HTMLInputElement>('input[placeholder*="상세주소"]')
            detailInput?.focus()
          }, 100)
        },
      }).open()
    }
    if ((window as unknown as Record<string, unknown>).daum) { run(); return }
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.onload = run
    document.head.appendChild(script)
  }

  const handleRoleSelect = (selectedRole: UserRole, selectedStaffRole?: StaffRole) => {
    setRole(selectedRole)
    if (selectedStaffRole) setStaffRole(selectedStaffRole)
    setStep('account')
  }

  const handleAccountSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (role === 'agent') {
      if (!representative) setRepresentative(displayName)
      setStep('agent-info')
    } else if (role === 'staff') {
      setStep('invite-code')
    }
  }

  // Validate invite code with debounce
  useEffect(() => {
    if (inviteCode.length !== 8) {
      setValidatedOffice(null)
      return
    }

    const timer = setTimeout(async () => {
      setValidating(true)
      try {
        const result = await validateInviteCode(inviteCode)
        setValidatedOffice(result?.officeName ?? null)
        if (!result) {
          toast.error('유효하지 않은 초대코드입니다.')
        }
      } catch {
        setValidatedOffice(null)
      } finally {
        setValidating(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [inviteCode])

  const handleSignUp = async (e?: FormEvent) => {
    e?.preventDefault()
    setIsLoading(true)
    try {
      const result = await signUpWithEmail({
        email,
        password,
        displayName,
        phone: phone || undefined,
        role,
        agentData: role === 'agent' ? {
          officeName,
          representative,
          businessNumber,
          licenseNumber,
          address: officeAddressDetail ? `${officeAddress} ${officeAddressDetail}` : officeAddress,
          phone: officePhone,
        } : undefined,
        staffInviteCode: role === 'staff' ? inviteCode.toUpperCase() : undefined,
        staffRole: role === 'staff' ? staffRole : undefined,
      })

      if (result.session) {
        toast.success('회원가입이 완료되었습니다!')
        navigate('/admin/dashboard', { replace: true })
      } else {
        toast.success('회원가입이 완료되었습니다. 이메일을 확인해주세요.')
        navigate('/auth/login')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '회원가입에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // Step 1: Role selection
  if (step === 'role') {
    return (
      <div>
        <h2 className="mb-6 text-center text-xl font-semibold">회원가입</h2>
        <p className="mb-4 text-center text-sm text-gray-500">회원 유형을 선택해주세요</p>

        <div className="space-y-3">
          <button
            onClick={() => handleRoleSelect('agent')}
            className="w-full rounded-lg border-2 border-gray-200 p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <p className="font-medium">개업 공인중개사 (대표)</p>
            <p className="mt-1 text-sm text-gray-500">사무소 개설 및 운영, 매물·고객·계약 관리 (Free 요금제로 시작)</p>
          </button>

          <button
            onClick={() => handleRoleSelect('staff', 'associate_agent')}
            className="w-full rounded-lg border-2 border-gray-200 p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <p className="font-medium">소속 공인중개사</p>
            <p className="mt-1 text-sm text-gray-500">개업 공인중개사 사무소에 소속되어 중개 업무 수행 (초대코드 필요)</p>
          </button>

          <button
            onClick={() => handleRoleSelect('staff', 'assistant')}
            className="w-full rounded-lg border-2 border-gray-200 p-4 text-left transition-colors hover:border-primary-400 hover:bg-primary-50"
          >
            <p className="font-medium">중개 보조원</p>
            <p className="mt-1 text-sm text-gray-500">현장 안내, 서류 정리 등 중개 보조 업무 수행 (초대코드 필요)</p>
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{' '}
          <Link to="/auth/login" className="font-medium text-primary-600 hover:text-primary-700">
            로그인
          </Link>
        </p>
      </div>
    )
  }

  // Step 2: Account info
  if (step === 'account') {
    const stepTitle = role === 'agent'
      ? '개업 공인중개사 회원가입'
      : staffRole === 'associate_agent'
        ? '소속 공인중개사 회원가입'
        : '중개 보조원 회원가입'

    return (
      <div>
        <h2 className="mb-6 text-center text-xl font-semibold">{stepTitle}</h2>

        <form onSubmit={handleAccountSubmit} className="space-y-4">
          <Input id="displayName" label="이름" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          <Input id="email" label="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input id="phone" label="연락처" type="tel" placeholder="010-0000-0000" value={formatPhone(phone)} onChange={(e) => setPhone(parsePhone(e.target.value))} />
          <Input id="password" label="비밀번호" type="password" placeholder="8자 이상" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input id="confirmPassword" label="비밀번호 확인" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep('role')}>
              이전
            </Button>
            <Button type="submit" className="flex-1">
              다음
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // Step 3a: Invite code (only for staff)
  if (step === 'invite-code') {
    return (
      <div>
        <h2 className="mb-6 text-center text-xl font-semibold">초대코드 입력</h2>
        <p className="mb-4 text-center text-sm text-gray-500">
          소속 사무소에서 받은 초대코드 8자리를 입력해주세요.
        </p>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label htmlFor="inviteCode" className="mb-1 block text-sm font-medium text-gray-700">
              초대코드
            </label>
            <input
              id="inviteCode"
              type="text"
              maxLength={8}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="예: AB3F7K2M"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-[0.2em] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
          </div>

          {/* Validation status */}
          {validating && (
            <p className="text-center text-sm text-gray-400">확인 중...</p>
          )}

          {validatedOffice && (
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-sm font-medium text-green-800">
                {validatedOffice}
              </p>
              <p className="mt-1 text-xs text-green-600">
                위 사무소에 {staffRole === 'associate_agent' ? '소속 공인중개사' : '중개 보조원'}으로 가입합니다.
              </p>
            </div>
          )}

          {inviteCode.length === 8 && !validating && !validatedOffice && (
            <p className="text-center text-sm text-red-500">
              유효하지 않은 초대코드입니다. 코드를 다시 확인해주세요.
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep('account')}>
              이전
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={isLoading}
              disabled={!validatedOffice || isLoading}
            >
              가입하기
            </Button>
          </div>
        </form>
      </div>
    )
  }

  // Step 3b: Agent info (only for agents)
  return (
    <div>
      <h2 className="mb-6 text-center text-xl font-semibold">중개사무소 정보</h2>
      <p className="mb-4 text-center text-sm text-gray-500">
        가입 즉시 Free 요금제로 시작합니다. 언제든지 업그레이드할 수 있습니다.
      </p>

      <form onSubmit={handleSignUp} className="space-y-4">
        <Input id="officeName" label="사무소명" value={officeName} onChange={(e) => setOfficeName(e.target.value)} required />
        <Input id="representative" label="대표자명" value={representative} onChange={(e) => setRepresentative(e.target.value)} required />
        <Input id="businessNumber" label="사업자등록번호" placeholder="000-00-00000" value={formatBusinessNumber(businessNumber)} onChange={(e) => setBusinessNumber(parseBusinessNumber(e.target.value))} required />
        <Input id="licenseNumber" label="공인중개사 자격증 번호" placeholder="11-2021-02258" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">사무소 주소 <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input
              id="officeAddress"
              type="text"
              value={officeAddress}
              readOnly
              placeholder="클릭하여 주소 검색"
              required
              onClick={openPostcode}
              className="flex-1 cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm read-only:bg-gray-50"
            />
            <button
              type="button"
              onClick={openPostcode}
              className="shrink-0 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              주소 검색
            </button>
          </div>
          <input
            type="text"
            value={officeAddressDetail}
            onChange={(e) => setOfficeAddressDetail(e.target.value)}
            placeholder="상세주소 입력 (동/호수 등)"
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <Input id="officePhone" label="사무소 전화번호" type="tel" value={formatPhone(officePhone)} onChange={(e) => setOfficePhone(parsePhone(e.target.value))} required />

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => setStep('account')}>
            이전
          </Button>
          <Button type="submit" className="flex-1" isLoading={isLoading}>
            가입하기
          </Button>
        </div>
      </form>
    </div>
  )
}
