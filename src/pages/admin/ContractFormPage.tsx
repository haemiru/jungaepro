import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom'
import type { Property, ContractTemplateType, TransactionType } from '@/types/database'
import { fetchAdminProperties, fetchPropertyById, updatePropertyStatus } from '@/api/properties'
import { createContract, updateDraftContract, fetchContractById, recommendTemplate } from '@/api/contracts'
import { Button } from '@/components/common'
import { formatPropertyPrice, transactionTypeLabel, contractTemplateLabel, formatNumber, parseCommaNumber, formatPhone, parsePhone, formatIdNumber, parseIdNumber, validateIdNumber, formatBusinessNumber, parseBusinessNumber, validateBusinessNumber, formatCorpNumber, parseCorpNumber, validateCorpNumber } from '@/utils/format'
import { useFormatArea } from '@/utils/areaFormat'
import { useCategories } from '@/hooks/useCategories'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

type AgentInfo = { officeName: string; representative: string; licenseNumber: string; address: string; phone: string }
type Step = 1 | 2 | 3 | 4
const stepLabels = ['매물 선택', '양식 선택', '계약 정보 입력', '미리보기']

const allTemplates: ContractTemplateType[] = [
  'apartment_sale', 'apartment_lease', 'officetel_sale', 'officetel_lease',
  'commercial_sale', 'commercial_lease', 'building_sale', 'land_sale', 'land_lease',
  'factory_sale', 'factory_lease', 'knowledge_center_sale', 'knowledge_center_lease',
]

export function ContractFormPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const agentProfile = useAuthStore((s) => s.agentProfile)
  const { findCategory } = useCategories()
  const [step, setStep] = useState<Step>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(editId ?? null)

  // Step 1: Property selection
  const [properties, setProperties] = useState<Property[]>([])
  const [propSearch, setPropSearch] = useState('')
  const [propCategoryId, setPropCategoryId] = useState('')
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)

  // Step 2: Template selection
  const [templateType, setTemplateType] = useState<ContractTemplateType>('apartment_sale')
  const [txType, setTxType] = useState<TransactionType>('sale')

  // Step 3: Contract info
  const [sellerInfo, setSellerInfo] = useState<PersonInfo>({ name: '', phone: '', idNumber: '', address: '', idType: 'resident' })
  const [buyerInfo, setBuyerInfo] = useState<PersonInfo>({ name: '', phone: '', idNumber: '', address: '', idType: 'resident' })
  const todayStr = new Date().toISOString().slice(0, 10)
  const [priceInfo, setPriceInfo] = useState({
    salePrice: '', deposit: '', monthlyRent: '',
    downPayment: '', downPaymentDate: todayStr,
    midPayment: '', midPaymentDate: '',
    midPayment2: '', midPaymentDate2: '',
    finalPayment: '', finalPaymentDate: '',
    loanAmount: '',
  })
  const [specialTerms, setSpecialTerms] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')            // 인도일
  const deliveryManuallyEdited = useRef(false)                    // 사용자가 인도일을 직접 수정했는지
  const [leasePeriodStart, setLeasePeriodStart] = useState('')    // 임대차 기간 시작
  const [leasePeriodEnd, setLeasePeriodEnd] = useState('')        // 임대차 기간 종료
  const [leasePartDesc, setLeasePartDesc] = useState('')           // 임대할부분 설명
  const [leasePartArea, setLeasePartArea] = useState('')           // 임대할부분 면적
  const [monthlyPayDay, setMonthlyPayDay] = useState('1')         // 차임 지급일
  const [monthlyPayMethod, setMonthlyPayMethod] = useState<'prepaid' | 'postpaid'>('postpaid')
  const [isJointBrokerage, setIsJointBrokerage] = useState(false)
  const [coAgentInfo, setCoAgentInfo] = useState<AgentInfo>({ officeName: '', representative: '', licenseNumber: '', address: '', phone: '' })

  // Auto-calculate 잔금 = 거래금액 - 계약금 - 중도금
  useEffect(() => {
    const total = txType === 'sale'
      ? (Number(priceInfo.salePrice) || 0)
      : (Number(priceInfo.deposit) || 0)
    const down = Number(priceInfo.downPayment) || 0
    const mid = Number(priceInfo.midPayment) || 0
    const mid2 = Number(priceInfo.midPayment2) || 0
    const final = Math.max(total - down - mid - mid2, 0)
    const finalStr = final > 0 ? String(final) : ''
    if (priceInfo.finalPayment !== finalStr) {
      setPriceInfo((prev) => ({ ...prev, finalPayment: finalStr }))
    }
  }, [txType, priceInfo.salePrice, priceInfo.deposit, priceInfo.downPayment, priceInfo.midPayment, priceInfo.midPayment2, priceInfo.finalPayment])

  // 잔금 지급일 → 인도일 자동 동기화 (사용자가 직접 수정하지 않은 경우)
  useEffect(() => {
    if (!deliveryManuallyEdited.current && priceInfo.finalPaymentDate) {
      setDeliveryDate(priceInfo.finalPaymentDate)
    }
  }, [priceInfo.finalPaymentDate])

  // Load properties
  useEffect(() => {
    let cancelled = false
    fetchAdminProperties({ search: propSearch || undefined, categoryId: propCategoryId || undefined })
      .then((data) => {
        if (!cancelled) {
          // 거래완료·보류 매물은 계약서 작성 대상에서 제외
          setProperties(data.filter((p) => p.status !== 'completed' && p.status !== 'hold'))
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [propSearch, propCategoryId])

  // 기존 임시저장 계약서 로드
  const draftLoadedRef = useRef(false)
  useEffect(() => {
    if (!editId || draftLoadedRef.current) return
    draftLoadedRef.current = true
    fetchContractById(editId).then(async (ct) => {
      if (!ct || (ct.status !== 'contract_writing' && ct.status !== 'confirmation_writing' && ct.status !== 'in_progress' && ct.status !== 'completed')) return
      // Restore form state
      setTemplateType(ct.template_type)
      setTxType(ct.transaction_type)
      const si = (ct.seller_info as Record<string, string>) ?? {}
      setSellerInfo({ name: si.name || '', phone: si.phone || '', idNumber: si.idNumber || '', address: si.address || '', idType: (si.idType as IdType) || 'resident' })
      const bi = (ct.buyer_info as Record<string, string>) ?? {}
      setBuyerInfo({ name: bi.name || '', phone: bi.phone || '', idNumber: bi.idNumber || '', address: bi.address || '', idType: (bi.idType as IdType) || 'resident' })
      const pi = (ct.price_info as Record<string, string>) ?? {}
      setPriceInfo({
        salePrice: pi.salePrice ? String(pi.salePrice) : '',
        deposit: pi.deposit ? String(pi.deposit) : '',
        monthlyRent: pi.monthlyRent ? String(pi.monthlyRent) : '',
        downPayment: pi.downPayment ? String(pi.downPayment) : '',
        downPaymentDate: pi.downPaymentDate || todayStr,
        midPayment: pi.midPayment ? String(pi.midPayment) : '',
        midPaymentDate: pi.midPaymentDate || '',
        midPayment2: pi.midPayment2 ? String(pi.midPayment2) : '',
        midPaymentDate2: pi.midPaymentDate2 || '',
        finalPayment: pi.finalPayment ? String(pi.finalPayment) : '',
        finalPaymentDate: pi.finalPaymentDate || '',
        loanAmount: pi.loanAmount ? String(pi.loanAmount) : '',
      })
      setSpecialTerms(ct.special_terms || '')
      // Restore draft_data extras
      const dd = ct.draft_data as Record<string, string> | null
      if (dd) {
        if (dd.deliveryDate) {
          setDeliveryDate(dd.deliveryDate)
          // 잔금 지급일이 있고 인도일과 다를 때만 수동 편집으로 간주
          deliveryManuallyEdited.current = !!pi.finalPaymentDate && dd.deliveryDate !== pi.finalPaymentDate
        }
        if (dd.leasePeriodStart) setLeasePeriodStart(dd.leasePeriodStart)
        if (dd.leasePeriodEnd) setLeasePeriodEnd(dd.leasePeriodEnd)
        if (dd.leasePartDesc) setLeasePartDesc(dd.leasePartDesc)
        if (dd.leasePartArea) setLeasePartArea(dd.leasePartArea)
        if (dd.monthlyPayDay) setMonthlyPayDay(dd.monthlyPayDay)
        if (dd.monthlyPayMethod) setMonthlyPayMethod(dd.monthlyPayMethod as 'prepaid' | 'postpaid')
        if (dd.isJointBrokerage) setIsJointBrokerage(dd.isJointBrokerage === 'true')
        if (dd.coAgentInfo) {
          try { setCoAgentInfo(JSON.parse(dd.coAgentInfo)) } catch { /* ignore */ }
        }
      }
      // 이어서 작성 시 계약 정보 입력(3단계)으로 바로 이동
      setStep(3)
      // Load property + 전용면적 자동입력 (draft_data에 없을 경우)
      if (ct.property_id) {
        try {
          const p = await fetchPropertyById(ct.property_id)
          if (p) {
            setSelectedProperty(p)
            if (!dd?.leasePartArea && p.exclusive_area_m2) {
              setLeasePartArea(String(p.exclusive_area_m2))
            }
          }
        } catch { /* ignore */ }
      }
    }).catch((err) => { console.error('[ContractForm] 계약서 로드 실패:', err) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId])

  // URL 쿼리 파라미터로 매물이 지정된 경우 자동 선택 → Step 2로 이동
  const preselectedRef = useRef(false)
  useEffect(() => {
    if (editId) return // 편집 모드에서는 무시
    const pid = searchParams.get('propertyId')
    if (!pid || preselectedRef.current) return
    fetchPropertyById(pid).then((p) => {
      if (!p) return
      preselectedRef.current = true
      handleSelectProperty(p)
      setStep(2)
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Auto-recommend template when property is selected
  const handleSelectProperty = (p: Property) => {
    setSelectedProperty(p)
    const categoryName = findCategory(p.category_id)?.name ?? null
    const rec = recommendTemplate(categoryName, p.transaction_type)
    setTemplateType(rec)
    setTxType(p.transaction_type)

    // Auto-fill lease part area
    setLeasePartArea(p.exclusive_area_m2 ? String(p.exclusive_area_m2) : '')

    // Auto-fill price info
    setPriceInfo((prev) => ({
      ...prev,
      salePrice: p.sale_price ? String(p.sale_price) : '',
      deposit: p.deposit ? String(p.deposit) : '',
      monthlyRent: p.monthly_rent ? String(p.monthly_rent) : '',
    }))
  }

  const buildContractData = () => ({
    property_id: selectedProperty?.id ?? null,
    transaction_type: txType,
    template_type: templateType,
    seller_info: sellerInfo,
    buyer_info: buyerInfo,
    agent_info: {
      officeName: agentProfile?.office_name ?? '',
      representative: agentProfile?.representative ?? '',
      licenseNumber: agentProfile?.license_number ?? '',
      address: agentProfile?.address ?? '',
      phone: agentProfile?.phone ?? '',
    },
    price_info: {
      salePrice: parseCommaNumber(priceInfo.salePrice),
      deposit: parseCommaNumber(priceInfo.deposit),
      monthlyRent: parseCommaNumber(priceInfo.monthlyRent),
      downPayment: parseCommaNumber(priceInfo.downPayment),
      downPaymentDate: priceInfo.downPaymentDate,
      midPayment: parseCommaNumber(priceInfo.midPayment),
      midPaymentDate: priceInfo.midPaymentDate,
      finalPayment: parseCommaNumber(priceInfo.finalPayment),
      finalPaymentDate: priceInfo.finalPaymentDate,
    },
    special_terms: specialTerms,
    draft_data: {
      deliveryDate,
      leasePeriodStart,
      leasePeriodEnd,
      leasePartDesc,
      leasePartArea,
      monthlyPayDay,
      monthlyPayMethod,
      isJointBrokerage: String(isJointBrokerage),
      coAgentInfo: JSON.stringify(coAgentInfo),
    },
  })

  const handleSaveDraft = async () => {
    setIsSavingDraft(true)
    try {
      const data = buildContractData()
      if (draftId) {
        await updateDraftContract(draftId, data, 'contract_writing')
      } else {
        const contract = await createContract(data, 'contract_writing')
        setDraftId(contract.id)
      }
      toast.success('임시저장되었습니다.')
    } catch (err) {
      console.error('[Contract] 임시저장 실패:', err)
      toast.error(`임시저장에 실패했습니다. ${err instanceof Error ? err.message : ''}`)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const data = buildContractData()
      let contract
      if (draftId) {
        contract = await updateDraftContract(draftId, data, 'contract_writing')
      } else {
        contract = await createContract(data, 'contract_writing')
      }
      setDraftId(contract.id)
      toast.success(`계약서가 저장되었습니다. (${contract.contract_number})`)
    } catch (err) {
      console.error('[Contract] 계약서 저장 실패:', err)
      toast.error(`계약서 저장에 실패했습니다. ${err instanceof Error ? err.message : ''}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoToConfirmation = async () => {
    setIsSubmitting(true)
    try {
      const data = buildContractData()
      let contract
      if (draftId) {
        contract = await updateDraftContract(draftId, data, 'confirmation_writing')
      } else {
        contract = await createContract(data, 'confirmation_writing')
      }
      toast.success('확인설명서 작성으로 이동합니다.')
      navigate(`/admin/contracts/${contract.id}/confirmation`)
    } catch (err) {
      console.error('[Contract] 확인설명서 이동 실패:', err)
      toast.error(`저장에 실패했습니다. ${err instanceof Error ? err.message : ''}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canNext = () => {
    if (step === 1) return true // 매물 미선택 시에도 다음 단계 진행 가능
    if (step === 2) return true
    if (step === 3) {
      const isSale = txType === 'sale'
      // 공통 필수: 당사자 성명/연락처/등록번호/주소
      const sellerOk = sellerInfo.name && sellerInfo.phone && sellerInfo.idNumber && sellerInfo.address
      const buyerOk = buyerInfo.name && buyerInfo.phone && buyerInfo.idNumber && buyerInfo.address
      if (!sellerOk || !buyerOk) return false
      // 공통 필수: 계약금, 잔금, 계약금 지급일, 잔금 지급일, 특약사항
      if (!priceInfo.downPayment || !priceInfo.finalPayment) return false
      if (!priceInfo.downPaymentDate || !priceInfo.finalPaymentDate) return false
      if (!specialTerms) return false
      if (isSale) {
        // 매매: 매매대금, 인도일
        if (!priceInfo.salePrice || !deliveryDate) return false
      } else {
        // 임대차: 보증금, 차임/월세, 지급일, 인도일, 임대할부분, 면적, 기간
        if (!priceInfo.deposit || !priceInfo.monthlyRent) return false
        if (!monthlyPayDay || !deliveryDate) return false
        if (!leasePartDesc || !leasePartArea) return false
        if (!leasePeriodStart || !leasePeriodEnd) return false
        if (leasePeriodStart < deliveryDate) return false
        if (leasePeriodEnd < leasePeriodStart) return false
      }
      return true
    }
    return true
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="no-print flex items-center gap-2 text-sm text-gray-400">
        <Link to="/admin/contracts" className="hover:text-gray-600">계약 관리</Link>
        <span>/</span>
        <span className="text-gray-600">{editId ? '이어서 작성' : '새 계약서'}</span>
      </div>
      <h1 className="no-print text-xl font-bold">계약서 작성</h1>

      {/* Step Indicator */}
      <div className="no-print flex items-center gap-2">
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button
              onClick={() => { if (s < step) setStep(s) }}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                s === step ? 'bg-primary-600 text-white' : s < step ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {s < step ? '\u2713' : s}
            </button>
            <span className={`hidden text-sm sm:inline ${s === step ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
              {stepLabels[s - 1]}
            </span>
            {s < 4 && <div className={`h-px w-8 ${s < step ? 'bg-primary-300' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 1 && (
        <Step1PropertySelect
          properties={properties}
          search={propSearch}
          onSearchChange={setPropSearch}
          categoryId={propCategoryId}
          onCategoryChange={setPropCategoryId}
          selected={selectedProperty}
          onSelect={handleSelectProperty}
        />
      )}
      {step === 2 && (
        <Step2TemplateSelect
          templateType={templateType}
          onTemplateChange={(t) => {
            setTemplateType(t)
            // 양식 변경 시 거래유형 동기화
            setTxType(txTypeFromTemplate(t))
          }}
          txType={txType}
          onTxTypeChange={(t) => {
            setTxType(t)
            const categoryName = findCategory(selectedProperty?.category_id)?.name ?? null
            setTemplateType(recommendTemplate(categoryName, t))
          }}
          property={selectedProperty}
        />
      )}
      {step === 3 && (
        <Step3ContractInfo
          txType={txType} templateType={templateType}
          sellerInfo={sellerInfo} onSellerChange={setSellerInfo}
          buyerInfo={buyerInfo} onBuyerChange={setBuyerInfo}
          priceInfo={priceInfo} onPriceChange={setPriceInfo}
          deliveryDate={deliveryDate} onDeliveryDateChange={(v) => { deliveryManuallyEdited.current = true; setDeliveryDate(v) }}
          leasePeriodStart={leasePeriodStart} onLeasePeriodStartChange={setLeasePeriodStart}
          leasePeriodEnd={leasePeriodEnd} onLeasePeriodEndChange={setLeasePeriodEnd}
          leasePartDesc={leasePartDesc} onLeasePartDescChange={setLeasePartDesc}
          leasePartArea={leasePartArea} onLeasePartAreaChange={setLeasePartArea}
          monthlyPayDay={monthlyPayDay} onMonthlyPayDayChange={setMonthlyPayDay}
          monthlyPayMethod={monthlyPayMethod} onMonthlyPayMethodChange={setMonthlyPayMethod}
          specialTerms={specialTerms} onSpecialTermsChange={setSpecialTerms}
          property={selectedProperty}
          agentInfo={{ officeName: agentProfile?.office_name ?? '', representative: agentProfile?.representative ?? '', licenseNumber: agentProfile?.license_number ?? '', address: agentProfile?.address ?? '', phone: agentProfile?.phone ?? '' }}
          isJointBrokerage={isJointBrokerage} onJointBrokerageChange={setIsJointBrokerage}
          coAgentInfo={coAgentInfo} onCoAgentInfoChange={setCoAgentInfo}
        />
      )}
      {step === 4 && (
        <div className="print-area">
        <Step4Preview
          property={selectedProperty}
          templateType={templateType}
          txType={txType}
          sellerInfo={sellerInfo}
          buyerInfo={buyerInfo}
          priceInfo={priceInfo}
          deliveryDate={deliveryDate}
          leasePeriodStart={leasePeriodStart}
          leasePeriodEnd={leasePeriodEnd}
          leasePartDesc={leasePartDesc}
          leasePartArea={leasePartArea}
          monthlyPayDay={monthlyPayDay}
          monthlyPayMethod={monthlyPayMethod}
          specialTerms={specialTerms}
          agentInfo={{ officeName: agentProfile?.office_name ?? '', representative: agentProfile?.representative ?? '', licenseNumber: agentProfile?.license_number ?? '', address: agentProfile?.address ?? '', phone: agentProfile?.phone ?? '' }}
          isJointBrokerage={isJointBrokerage}
          coAgentInfo={coAgentInfo}
          onGoBack={() => setStep(3)}
        />
        </div>
      )}

      {/* Navigation */}
      <div className="no-print flex items-center justify-between border-t border-gray-200 pt-4">
        <Button variant="outline" onClick={() => { if (step > 1) setStep((step - 1) as Step); else navigate('/admin/contracts') }}>
          {step === 1 ? '취소' : '이전'}
        </Button>
        {step < 4 ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveDraft} isLoading={isSavingDraft}>임시저장</Button>
            <Button onClick={async () => {
              // Step 3 → 4 전환 시: 포털공개중/매물등록중 매물을 계약진행으로 변경
              if (step === 3 && selectedProperty && ['active', 'draft'].includes(selectedProperty.status)) {
                try {
                  await updatePropertyStatus([selectedProperty.id], 'contracted')
                } catch { /* 상태 변경 실패해도 계속 진행 */ }
              }
              setStep((step + 1) as Step)
            }} disabled={!canNext()}>다음</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveDraft} isLoading={isSavingDraft}>임시저장</Button>
            <Button variant="outline" onClick={() => { window.print() }}>인쇄</Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting}>계약서 작성완료</Button>
            <Button onClick={handleGoToConfirmation} isLoading={isSubmitting}>확인설명서 작성</Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Step 1: Property Selection
// ============================================================
function Step1PropertySelect({ properties, search, onSearchChange, categoryId, onCategoryChange, selected, onSelect }: {
  properties: Property[]; search: string; onSearchChange: (v: string) => void
  categoryId: string; onCategoryChange: (v: string) => void
  selected: Property | null; onSelect: (p: Property) => void
}) {
  const { categories, findCategory } = useCategories()
  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="scrollbar-hide flex overflow-x-auto border-b border-gray-200">
        <button
          onClick={() => onCategoryChange('')}
          className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            categoryId === ''
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          전체
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              categoryId === cat.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
          placeholder="매물명, 주소 검색" className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => {
          const cat = findCategory(p.category_id)
          const isSelected = selected?.id === p.id
          return (
            <button
              key={p.id} onClick={() => onSelect(p)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${isSelected ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20' : 'border-gray-200 bg-white hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs">{cat?.icon}</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${p.transaction_type === 'sale' ? 'bg-blue-100 text-blue-700' : p.transaction_type === 'jeonse' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {transactionTypeLabel[p.transaction_type]}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-gray-800">{p.title}</p>
              <p className="text-xs text-gray-500">{p.address}</p>
              <p className="mt-1 text-sm font-bold text-primary-700">{formatPropertyPrice(p.transaction_type, p.sale_price, p.deposit, p.monthly_rent)}</p>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="rounded-xl bg-primary-50 p-4 ring-1 ring-primary-200">
          <p className="text-sm font-semibold text-primary-800">선택된 매물: {selected.title}</p>
          <p className="text-xs text-primary-600">{selected.address} · {formatPropertyPrice(selected.transaction_type, selected.sale_price, selected.deposit, selected.monthly_rent)}</p>
        </div>
      )}

    </div>
  )
}

// ============================================================
// Step 2: Template Selection
// ============================================================
/** 카테고리명에 맞는 계약서 양식만 반환 */
function getTemplatesForCategory(categoryName: string | null): ContractTemplateType[] {
  const name = (categoryName ?? '').trim()
  switch (name) {
    case '아파트': case '빌라': case '주택':
      return ['apartment_sale', 'apartment_lease']
    case '오피스텔': case '원룸':
      return ['officetel_sale', 'officetel_lease']
    case '상가': case '사무실':
      return ['commercial_sale', 'commercial_lease']
    case '토지':
      return ['land_sale', 'land_lease']
    case '공장/창고':
      return ['factory_sale', 'factory_lease']
    case '지식산업센터':
      return ['knowledge_center_sale', 'knowledge_center_lease']
    default:
      return allTemplates
  }
}

/** 양식명에서 거래유형 추출 */
function txTypeFromTemplate(t: ContractTemplateType): TransactionType {
  return t.endsWith('_sale') ? 'sale' : 'jeonse'
}

/** 카테고리명 기반 양식 라벨 (빌라→빌라 매매, 원룸→원룸 임대차 등) */
function getTemplateLabelForCategory(t: ContractTemplateType, categoryName: string | null): string {
  const isSale = t.endsWith('_sale')
  const txLabel = isSale ? '매매' : '임대차'
  const name = (categoryName ?? '').trim()
  // 카테고리가 있으면 카테고리명 기반 라벨
  if (name) return `${name} ${txLabel}`
  // 카테고리 없으면 기본 라벨
  return contractTemplateLabel[t]
}

function Step2TemplateSelect({ templateType, onTemplateChange, txType, onTxTypeChange, property }: {
  templateType: ContractTemplateType; onTemplateChange: (v: ContractTemplateType) => void
  txType: TransactionType; onTxTypeChange: (v: TransactionType) => void
  property: Property | null
}) {
  const { findCategory } = useCategories()
  const categoryName = property ? (findCategory(property.category_id)?.name ?? null) : null
  const recommended = property ? recommendTemplate(categoryName, property.transaction_type) : null
  const availableTemplates = getTemplatesForCategory(categoryName)

  const handleTemplateSelect = (t: ContractTemplateType) => {
    onTemplateChange(t)
  }

  return (
    <div className="space-y-6">
      {/* Transaction Type */}
      <div>
        <label className="mb-2 block text-sm font-semibold">거래 유형</label>
        <div className="flex gap-2">
          {(['sale', 'jeonse', 'monthly'] as TransactionType[])
            .filter((t) => {
              // 토지/공장/지식산업센터는 전세 불가
              if (t === 'jeonse' && ['토지', '공장/창고', '지식산업센터'].includes(categoryName ?? '')) return false
              return true
            })
            .map((t) => (
            <button key={t} onClick={() => onTxTypeChange(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${txType === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'}`}>
              {transactionTypeLabel[t]}
            </button>
          ))}
        </div>
        {property && txType !== property.transaction_type && (
          <p className="mt-2 text-xs text-amber-600">
            ※ 매물 등록 시 거래유형({transactionTypeLabel[property.transaction_type]})과 다릅니다. 계약서에는 변경된 유형({transactionTypeLabel[txType]})이 적용됩니다.
          </p>
        )}
      </div>

      {/* Template Grid */}
      <div>
        <label className="mb-2 block text-sm font-semibold">계약서 양식</label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {availableTemplates.map((t) => (
            <button key={t} onClick={() => handleTemplateSelect(t)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${templateType === t ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <p className="text-sm font-semibold text-gray-800">{getTemplateLabelForCategory(t, categoryName)}</p>
              {t === recommended && (
                <span className="mt-1 inline-block rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">추천</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Confirmation doc type */}
      <div className="rounded-xl bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-600">확인설명서 유형</p>
        <p className="mt-1 text-sm text-gray-500">
          {templateType.includes('land') ? '토지용' : templateType.includes('commercial') || templateType.includes('factory') || templateType.includes('knowledge') ? '비주거용' : '주거용'} 확인설명서가 자동 선택됩니다.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Step 3: Contract Info Input
// ============================================================
type IdType = 'resident' | 'corp' | 'business'
type PersonInfo = {
  name: string; phone: string; idNumber: string; address: string
  idType: IdType
}

type PriceInfoType = {
  salePrice: string; deposit: string; monthlyRent: string
  downPayment: string; downPaymentDate: string
  midPayment: string; midPaymentDate: string
  midPayment2: string; midPaymentDate2: string
  finalPayment: string; finalPaymentDate: string
  loanAmount: string
}

function Step3ContractInfo({ txType, sellerInfo, onSellerChange, buyerInfo, onBuyerChange, priceInfo, onPriceChange, deliveryDate, onDeliveryDateChange, leasePeriodStart, onLeasePeriodStartChange, leasePeriodEnd, onLeasePeriodEndChange, leasePartDesc, onLeasePartDescChange, leasePartArea, onLeasePartAreaChange, monthlyPayDay, onMonthlyPayDayChange, monthlyPayMethod, onMonthlyPayMethodChange, specialTerms, onSpecialTermsChange, property, agentInfo, isJointBrokerage, onJointBrokerageChange, coAgentInfo, onCoAgentInfoChange }: {
  txType: TransactionType; templateType: ContractTemplateType
  sellerInfo: PersonInfo
  onSellerChange: (v: PersonInfo) => void
  buyerInfo: PersonInfo; onBuyerChange: (v: PersonInfo) => void
  priceInfo: PriceInfoType; onPriceChange: (v: PriceInfoType) => void
  deliveryDate: string; onDeliveryDateChange: (v: string) => void
  leasePeriodStart: string; onLeasePeriodStartChange: (v: string) => void
  leasePeriodEnd: string; onLeasePeriodEndChange: (v: string) => void
  leasePartDesc: string; onLeasePartDescChange: (v: string) => void
  leasePartArea: string; onLeasePartAreaChange: (v: string) => void
  monthlyPayDay: string; onMonthlyPayDayChange: (v: string) => void
  monthlyPayMethod: 'prepaid' | 'postpaid'; onMonthlyPayMethodChange: (v: 'prepaid' | 'postpaid') => void
  specialTerms: string; onSpecialTermsChange: (v: string) => void
  property: Property | null; agentInfo: AgentInfo
  isJointBrokerage: boolean; onJointBrokerageChange: (v: boolean) => void
  coAgentInfo: AgentInfo; onCoAgentInfoChange: (v: AgentInfo) => void
}) {
  const formatArea = useFormatArea()
  const { findCategory } = useCategories()
  const isSale = txType === 'sale'
  const isMonthly = txType === 'monthly'
  const todayStr = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      {/* Auto-filled property info */}
      {property && (
        <div className="rounded-xl bg-green-50 p-4 ring-1 ring-green-200">
          <p className="mb-2 text-xs font-bold text-green-700">매물 데이터에서 자동 입력됨</p>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><span className="text-gray-500">소재지: </span><span className="font-medium">{property.address}</span></div>
            <div><span className="text-gray-500">전용면적: </span><span className="font-medium">{formatArea(property.exclusive_area_m2)}</span></div>
            <div><span className="text-gray-500">공급면적: </span><span className="font-medium">{formatArea(property.supply_area_m2)}</span></div>
            {(property.dong || property.ho) && (
              <div><span className="text-gray-500">동/호: </span><span className="font-medium">{[property.dong && `${property.dong}동`, property.ho && `${property.ho}호`].filter(Boolean).join(' ')}</span></div>
            )}
            {property.floor && <div><span className="text-gray-500">층수: </span><span className="font-medium">{property.floor}/{property.total_floors}층</span></div>}
            {property.direction && <div><span className="text-gray-500">방향: </span><span className="font-medium">{property.direction}</span></div>}
            {property.built_year && <div><span className="text-gray-500">건축연도: </span><span className="font-medium">{(() => { const [y, m] = property.built_year.split('-'); return m ? `${y}년 ${parseInt(m)}월` : `${y}년` })()}</span></div>}
          </div>
        </div>
      )}

      {/* 임대할부분 (임대차 계약 시) */}
      {!isSale && (() => {
        // 매물 기반 동적 placeholder
        const cat = property ? findCategory(property.category_id)?.name || '' : ''
        const dongHo = [property?.dong && `${property.dong}동`, property?.ho && `${property.ho}호`].filter(Boolean).join(' ')
        const phParts = [cat, dongHo, txType === 'jeonse' ? '전세' : '월세', '전체'].filter(Boolean).join(' ')
        return (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-2 ring-yellow-200">
          <p className="mb-1 text-sm font-semibold">임대할 부분</p>
          <p className="mb-3 text-[10px] font-medium text-yellow-600">수동 입력 필요</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="임대할 부분 설명" value={leasePartDesc} onChange={onLeasePartDescChange} placeholder={`예: ${phParts}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">면적 (㎡)</label>
              <input type="text" value={leasePartArea} onChange={(e) => onLeasePartAreaChange(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-right focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
            </div>
          </div>
        </div>
        )
      })()}

      {/* Seller/Buyer Info */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PersonInfoCard title={isSale ? '매도인' : '임대인'} info={sellerInfo} onChange={onSellerChange} />
        <PersonInfoCard title={isSale ? '매수인' : '임차인'} info={buyerInfo} onChange={onBuyerChange} />
      </div>

      {/* Price Info */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-2 ring-yellow-200">
        <p className="mb-1 text-sm font-semibold">거래 금액</p>
        <p className="mb-4 text-[10px] font-medium text-yellow-600">수동 입력 필요</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isSale && (
            <PriceField label="매매대금 (만원)" value={priceInfo.salePrice} onChange={(v) => onPriceChange({ ...priceInfo, salePrice: v })} />
          )}
          {!isSale && (
            <PriceField label="보증금 (만원)" value={priceInfo.deposit} onChange={(v) => onPriceChange({ ...priceInfo, deposit: v })} />
          )}
          {isMonthly && (
            <>
              <PriceField label="차임/월세 (만원)" value={priceInfo.monthlyRent} onChange={(v) => onPriceChange({ ...priceInfo, monthlyRent: v })} />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-500">지급일 (매월)</label>
                  <div className="flex items-center gap-1">
                    <input type="number" min="1" max="31" value={monthlyPayDay} onChange={(e) => onMonthlyPayDayChange(e.target.value)}
                      className="w-16 rounded-lg border border-gray-200 px-2 py-2 text-sm text-center focus:border-primary-300 focus:outline-none" />
                    <span className="text-sm text-gray-500">일</span>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-500">지급방식</label>
                  <div className="flex gap-1">
                    {(['prepaid', 'postpaid'] as const).map((m) => (
                      <button key={m} onClick={() => onMonthlyPayMethodChange(m)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium ${monthlyPayMethod === m ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {m === 'prepaid' ? '선불' : '후불'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <hr className="my-4 border-gray-100" />
        <p className="mb-3 text-sm font-semibold">납부 일정</p>
        {/* 계약금 */}
        <div className="mb-3 grid grid-cols-2 gap-4">
          <PriceField label="계약금 (만원)" value={priceInfo.downPayment} onChange={(v) => onPriceChange({ ...priceInfo, downPayment: v })} />
          <DateField label="계약금 지급일" value={priceInfo.downPaymentDate} onChange={(v) => onPriceChange({ ...priceInfo, downPaymentDate: v })} />
        </div>
        {/* 중도금 1 */}
        <div className="mb-3 grid grid-cols-2 gap-4">
          <PriceField label="중도금 (만원)" value={priceInfo.midPayment} onChange={(v) => onPriceChange({ ...priceInfo, midPayment: v })} />
          <DateField label="중도금 지급일" value={priceInfo.midPaymentDate} min={todayStr} onChange={(v) => onPriceChange({ ...priceInfo, midPaymentDate: v })} />
        </div>
        {/* 중도금 2 (매매) */}
        {isSale && (
          <div className="mb-3 grid grid-cols-2 gap-4">
            <PriceField label="중도금 2 (만원)" value={priceInfo.midPayment2} onChange={(v) => onPriceChange({ ...priceInfo, midPayment2: v })} />
            <DateField label="중도금 2 지급일" value={priceInfo.midPaymentDate2} min={priceInfo.midPaymentDate || todayStr} onChange={(v) => onPriceChange({ ...priceInfo, midPaymentDate2: v })} />
          </div>
        )}
        {/* 잔금 */}
        <div className="mb-3 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">잔금 (만원) — 자동계산</label>
            <input type="text" readOnly value={formatNumber(priceInfo.finalPayment)}
              className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-right text-gray-500" />
          </div>
          <DateField label="잔금 지급일" value={priceInfo.finalPaymentDate} min={priceInfo.midPaymentDate2 || priceInfo.midPaymentDate || todayStr} onChange={(v) => onPriceChange({ ...priceInfo, finalPaymentDate: v })} />
        </div>
        {/* 융자금 (매매) */}
        {isSale && (
          <div className="grid grid-cols-2 gap-4">
            <PriceField label="융자금 (만원)" value={priceInfo.loanAmount} onChange={(v) => onPriceChange({ ...priceInfo, loanAmount: v })} />
            <div />
          </div>
        )}
      </div>

      {/* Delivery & Lease Period */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-2 ring-yellow-200">
        <p className="mb-1 text-sm font-semibold">{isSale ? '소유권이전 및 인도' : '인도 및 계약기간'}</p>
        <p className="mb-4 text-[10px] font-medium text-yellow-600">수동 입력 필요</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField label={isSale ? '인도일' : '인도 예정일'} value={deliveryDate} onChange={onDeliveryDateChange} />
          {!isSale && (
            <>
              <div />
              <div>
                <DateField label="임대차 기간 시작일" value={leasePeriodStart} onChange={onLeasePeriodStartChange} />
                {deliveryDate && leasePeriodStart && leasePeriodStart < deliveryDate && (
                  <p className="mt-1 text-xs text-red-500">시작일은 인도 예정일 이후여야 합니다</p>
                )}
              </div>
              <div>
                <DateField label="임대차 기간 종료일" value={leasePeriodEnd} onChange={onLeasePeriodEndChange} />
                {leasePeriodStart && leasePeriodEnd && leasePeriodEnd < leasePeriodStart && (
                  <p className="mt-1 text-xs text-red-500">종료일은 시작일 이후여야 합니다</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Agent info */}
      <div className="rounded-xl bg-green-50 p-4 ring-1 ring-green-200">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold text-green-700">개업공인중개사 (자동 로드)</p>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={isJointBrokerage} onChange={(e) => onJointBrokerageChange(e.target.checked)}
              className="rounded border-gray-300" />
            <span className="font-medium text-gray-600">공동중개</span>
          </label>
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div><span className="text-gray-500">사무소: </span><span className="font-medium">{agentInfo.officeName || '-'}</span></div>
          <div><span className="text-gray-500">대표: </span><span className="font-medium">{agentInfo.representative || '-'}</span></div>
          <div><span className="text-gray-500">등록번호: </span><span className="font-medium">{agentInfo.licenseNumber || '-'}</span></div>
          <div><span className="text-gray-500">소재지: </span><span className="font-medium">{agentInfo.address || '-'}</span></div>
          <div><span className="text-gray-500">연락처: </span><span className="font-medium">{agentInfo.phone || '-'}</span></div>
        </div>
      </div>

      {/* Co-Agent info (공동중개) */}
      {isJointBrokerage && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-2 ring-yellow-200">
          <p className="mb-1 text-sm font-semibold">공동중개 개업공인중개사</p>
          <p className="mb-3 text-[10px] font-medium text-yellow-600">수동 입력 필요</p>
          <div className="space-y-3">
            <Field label="사무소 명칭" value={coAgentInfo.officeName} onChange={(v) => onCoAgentInfoChange({ ...coAgentInfo, officeName: v })} />
            <Field label="대표자명" value={coAgentInfo.representative} onChange={(v) => onCoAgentInfoChange({ ...coAgentInfo, representative: v })} />
            <Field label="등록번호" value={coAgentInfo.licenseNumber} onChange={(v) => onCoAgentInfoChange({ ...coAgentInfo, licenseNumber: v })} />
            <Field label="사무소 소재지" value={coAgentInfo.address} onChange={(v) => onCoAgentInfoChange({ ...coAgentInfo, address: v })} />
            <PhoneField label="전화번호" value={coAgentInfo.phone} onChange={(v) => onCoAgentInfoChange({ ...coAgentInfo, phone: v })} />
          </div>
        </div>
      )}

      {/* Special Terms */}
      <div className="rounded-xl bg-white p-5 shadow-sm ring-2 ring-yellow-200">
        <p className="mb-3 text-sm font-semibold">특약사항</p>
        <textarea value={specialTerms} onChange={(e) => onSpecialTermsChange(e.target.value)} rows={6}
          placeholder="특약사항을 입력하세요..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
        {specialTerms.length > 200 && (
          <p className="mt-1.5 text-xs text-amber-600">별지로 첨부됩니다.</p>
        )}
      </div>
    </div>
  )
}

const ID_TYPE_OPTIONS: { value: IdType; label: string }[] = [
  { value: 'resident', label: '주민등록번호' },
  { value: 'corp', label: '법인등록번호' },
  { value: 'business', label: '사업자등록번호' },
]

const ID_TYPE_NAME_LABEL: Record<IdType, string> = {
  resident: '성명',
  corp: '법인명 (대표자)',
  business: '사업자명 (대표자)',
}

function formatIdByType(idType: IdType, value: string): string {
  if (!value) return ''
  if (idType === 'corp') return formatCorpNumber(value)
  if (idType === 'business') return formatBusinessNumber(value)
  return formatIdNumber(value)
}

function formatPhoneNumber(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('02')) {
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`
    if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  return value
}

function PersonInfoCard({ title, info, onChange }: {
  title: string; info: PersonInfo
  onChange: (v: PersonInfo) => void
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-2 ring-yellow-200">
      <p className="mb-1 text-sm font-semibold">{title}</p>
      <p className="mb-3 text-[10px] font-medium text-yellow-600">수동 입력 필요</p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={ID_TYPE_NAME_LABEL[info.idType]} value={info.name} onChange={(v) => onChange({ ...info, name: v })} required />
          <PhoneField label="연락처" value={info.phone} onChange={(v) => onChange({ ...info, phone: v })} />
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{'\u00A0'}</label>
            <select value={info.idType} onChange={(e) => onChange({ ...info, idType: e.target.value as IdType, idNumber: '' })}
              className="rounded-lg border border-gray-200 px-2 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
              {ID_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {info.idType === 'resident' && <IdNumberField label={'\u00A0'} value={info.idNumber} onChange={(v) => onChange({ ...info, idNumber: v })} />}
          {info.idType === 'corp' && <CorpNumberField label={'\u00A0'} value={info.idNumber} onChange={(v) => onChange({ ...info, idNumber: v })} />}
          {info.idType === 'business' && <BusinessNumberField label={'\u00A0'} value={info.idNumber} onChange={(v) => onChange({ ...info, idNumber: v })} />}
        </div>
        <Field label={info.idType === 'resident' ? '주소' : '사업장 주소'} value={info.address} onChange={(v) => onChange({ ...info, address: v })} />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}{required && ' *'}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" required={required} />
    </div>
  )
}

function PhoneField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input type="tel" value={formatPhone(value)} onChange={(e) => onChange(parsePhone(e.target.value))} placeholder="010-0000-0000"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
    </div>
  )
}

function IdNumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const error = value.length === 13 ? validateIdNumber(value) : null
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input type="text" inputMode="numeric" value={formatIdNumber(value)} onChange={(e) => onChange(parseIdNumber(e.target.value))} placeholder="000000-0000000"
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-500/20' : 'border-gray-200 focus:border-primary-300 focus:ring-primary-500/20'}`} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {value.length === 13 && !error && <p className="mt-1 text-xs text-green-600">유효한 주민등록번호입니다</p>}
    </div>
  )
}

function CorpNumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const error = value.length === 13 ? validateCorpNumber(value) : null
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input type="text" inputMode="numeric" value={formatCorpNumber(value)} onChange={(e) => onChange(parseCorpNumber(e.target.value))} placeholder="000000-0000000"
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-500/20' : 'border-gray-200 focus:border-primary-300 focus:ring-primary-500/20'}`} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {value.length === 13 && !error && <p className="mt-1 text-xs text-green-600">유효한 법인등록번호입니다</p>}
    </div>
  )
}

function BusinessNumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const error = value.length === 10 ? validateBusinessNumber(value) : null
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input type="text" inputMode="numeric" value={formatBusinessNumber(value)} onChange={(e) => onChange(parseBusinessNumber(e.target.value))} placeholder="000-00-00000"
        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-500/20' : 'border-gray-200 focus:border-primary-300 focus:ring-primary-500/20'}`} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {value.length === 10 && !error && <p className="mt-1 text-xs text-green-600">유효한 사업자등록번호입니다</p>}
    </div>
  )
}

function PriceField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input type="text" value={formatNumber(value)} onChange={(e) => { const n = parseCommaNumber(e.target.value); onChange(n != null ? String(n) : '') }}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-right focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
    </div>
  )
}

function DateField({ label, value, onChange, min }: { label: string; value: string; onChange: (v: string) => void; min?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input type="date" value={value} min={min} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
    </div>
  )
}

// ============================================================
// Step 4: Preview — 실제 계약서 양식 기반
// ============================================================

// 만원 → 한글 금액 변환
function manwonToKorean(manwon: number): string {
  if (!manwon || manwon <= 0) return ''
  const dg = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const u4 = ['', '십', '백', '천']
  const chunk = (n: number) => {
    let s = '', r = n
    for (let i = 3; i >= 0; i--) {
      const d = Math.floor(r / Math.pow(10, i)); r %= Math.pow(10, i)
      if (d > 0) s += (d === 1 && i === 1 ? '' : dg[d]) + u4[i]
    }
    return s
  }
  const eok = Math.floor(manwon / 10000), man = manwon % 10000
  let result = ''
  if (eok > 0) result += chunk(eok) + '억'
  if (man > 0) result += chunk(man) + '만'
  return result
}

function fmtDate(d: string) {
  if (!d) return '    년   월   일'
  const [y, m, day] = d.split('-')
  return `${y}년 ${m}월 ${day}일`
}

function fmtWon(manwon: string | number) {
  const n = typeof manwon === 'string' ? Number(manwon) : manwon
  if (!n) return ''
  return (n * 10000).toLocaleString('ko-KR')
}

function getContractTitle(templateType: ContractTemplateType, txType: TransactionType, categoryName?: string | null) {
  const txLabel = txType === 'sale' ? '매매' : txType === 'jeonse' ? '전세' : '월세'
  // 카테고리명이 있으면 그대로 사용
  const name = (categoryName ?? '').trim()
  if (name) return `${name} ${txLabel} 계약서`
  // fallback
  if (templateType.startsWith('land')) return `토지 ${txLabel} 계약서`
  if (templateType.startsWith('factory')) return `공장/창고 ${txLabel} 계약서`
  if (templateType.startsWith('commercial')) return `상가 ${txLabel} 계약서`
  return `부동산 ${txLabel} 계약서`
}

function Step4Preview({ property, templateType, txType, sellerInfo, buyerInfo, priceInfo, deliveryDate, leasePeriodEnd, leasePartDesc, leasePartArea, monthlyPayDay, monthlyPayMethod, specialTerms, agentInfo, isJointBrokerage, coAgentInfo, onGoBack }: {
  property: Property | null; templateType: ContractTemplateType; txType: TransactionType
  sellerInfo: PersonInfo
  buyerInfo: PersonInfo
  priceInfo: PriceInfoType
  deliveryDate: string; leasePeriodStart: string; leasePeriodEnd: string
  leasePartDesc: string; leasePartArea: string
  monthlyPayDay: string; monthlyPayMethod: 'prepaid' | 'postpaid'
  specialTerms: string; agentInfo: AgentInfo
  isJointBrokerage: boolean; coAgentInfo: AgentInfo
  onGoBack: () => void
}) {
  const { findCategory } = useCategories()
  const categoryName = property ? (findCategory(property.category_id)?.name ?? null) : null
  const isSale = txType === 'sale'
  const isMonthly = txType === 'monthly'
  const isLand = templateType.startsWith('land')
  const isCommercial = templateType.startsWith('commercial') || templateType.startsWith('factory')
  const previewRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const byeoljiRef = useRef<HTMLDivElement>(null)
  const [isPdfLoading, setIsPdfLoading] = useState(false)

  const sellerRole = isSale ? '매도인' : '임대인'
  const buyerRole = isSale ? '매수인' : '임차인'
  const td = 'border border-gray-400 px-3 py-2 text-xs leading-snug'
  const th = 'border border-gray-400 bg-blue-50 px-3 py-2 text-xs font-medium text-center whitespace-nowrap text-blue-900'
  const sectionHeader = 'mb-0.5 text-xs font-bold text-blue-800'
  const articleNum = 'font-semibold text-blue-700'
  const SPECIAL_TERMS_MAX_LINES = 5  // 특약사항이 이 줄수 넘으면 별지로 분리
  const CHARS_PER_LINE = 45  // text-xs 기준 특약 박스 한 줄 한글 약 45자
  const estimateLines = (text: string) => {
    if (!text) return 0
    return text.split('\n').reduce((total, line) => {
      return total + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE))
    }, 0)
  }
  const needsByeolji = estimateLines(specialTerms) > SPECIAL_TERMS_MAX_LINES

  const addSectionToPdf = async (
    el: HTMLElement,
    pdf: InstanceType<typeof import('jspdf').jsPDF>,
    html2canvas: (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>,
    isFirst: boolean,
    fitToOnePage = false,
  ) => {
    const canvas = await html2canvas(el, { scale: 2, useCORS: true })
    const imgData = canvas.toDataURL('image/png')
    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()
    const margin = 10
    const contentW = pdfW - margin * 2
    const contentH = pdfH - margin * 2
    const imgH = (canvas.height * contentW) / canvas.width

    if (fitToOnePage && imgH > contentH) {
      // 한 페이지에 맞추기: 비율 유지하며 축소
      if (!isFirst) pdf.addPage()
      const scale = contentH / imgH
      const scaledW = contentW * scale
      const scaledH = contentH
      const offsetX = margin + (contentW - scaledW) / 2
      pdf.addImage(imgData, 'PNG', offsetX, margin, scaledW, scaledH)
    } else {
      let y = margin
      let page = 0
      while (y < imgH + margin) {
        if (!isFirst || page > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', margin, margin - y + (page === 0 ? 0 : margin), contentW, imgH)
        y += pdfH - margin * 2
        page++
      }
    }
  }

  const handleDownloadPdf = async () => {
    if (!mainRef.current) return
    setIsPdfLoading(true)
    try {
      const html2canvas = (await import('html2canvas-pro')).default
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF('p', 'mm', 'a4')
      await addSectionToPdf(mainRef.current, pdf, html2canvas, true, true)
      if (needsByeolji && byeoljiRef.current) {
        await addSectionToPdf(byeoljiRef.current, pdf, html2canvas, false, true)
      }
      const contractNum = property?.title ? property.title.replace(/\s/g, '_') : 'contract'
      pdf.save(`계약서_${contractNum}.pdf`)
      toast.success('PDF가 다운로드되었습니다.')
    } catch {
      toast.error('PDF 생성에 실패했습니다.')
    } finally {
      setIsPdfLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div ref={previewRef}>
      <div ref={mainRef} className="print-contract-main mx-auto max-w-3xl bg-white px-6 py-6 shadow ring-1 ring-gray-200 print:shadow-none print:ring-0" style={{ fontFamily: 'serif' }}>

        {/* ── 제목 ── */}
        <h2 className="mb-2 text-center text-xl font-bold tracking-[0.3em] text-blue-900">{getContractTitle(templateType, txType, categoryName)}</h2>
        <p className="mb-3 text-xs leading-relaxed">
          {isSale
            ? `본 부동산에 대하여 ${sellerRole}과 ${buyerRole} 쌍방은 다음과 같이 합의하여 매매 계약을 체결한다.`
            : `${sellerRole}과 ${buyerRole} 쌍방은 아래 표시 부동산에 관하여 다음 계약 내용과 같이 임대차계약을 체결한다.`}
        </p>

        {/* ── 1. 부동산의 표시 ── */}
        <p className={sectionHeader}>1. 부동산의 표시</p>
        <table className="mb-3 w-full border-collapse">
          <colgroup>
            <col style={{ width: 80 }} />
            <col style={{ width: 50 }} />
            <col />
            <col style={{ width: 50 }} />
            <col />
            <col style={{ width: 50 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <tbody>
            {/* 소재지 */}
            <tr>
              <td className={th}>소 재 지</td>
              <td className={td} colSpan={6}>{property?.address || ''}</td>
            </tr>
            {/* 토지 */}
            <tr>
              <td className={th}>토 &nbsp; 지</td>
              <td className={th}>{isLand ? '대표지목' : '지 목'}</td>
              <td className={td}>{isLand ? '전' : '대'}</td>
              {isLand ? (
                <><td className={th}>거래지분</td><td className={td}></td></>
              ) : (
                <td className={td} colSpan={2}></td>
              )}
              <td className={th}>면 적</td>
              <td className={td} style={{ textAlign: 'right' }}>{property?.supply_area_m2 ? `${property.supply_area_m2} ㎡` : ''}</td>
            </tr>
            {/* 건물 (토지 제외) */}
            {!isLand && (
              <tr>
                <td className={th}>건 &nbsp; 물</td>
                <td className={th}>구 조</td>
                <td className={td}>{(property?.extra_info as Record<string, string> | null)?.structure || ''}</td>
                <td className={th}>용 도</td>
                <td className={td}>{findCategory(property?.category_id)?.name || ''}</td>
                <td className={th}>면 적</td>
                <td className={td} style={{ textAlign: 'right' }}>{property?.exclusive_area_m2 ? `${property.exclusive_area_m2} ㎡` : ''}</td>
              </tr>
            )}
            {/* 임대할부분 (임대차) */}
            {!isSale && (
              <tr>
                <td className={th}>임대할부분</td>
                <td className={td} colSpan={4}>{leasePartDesc || ''}</td>
                <td className={th}>면 적</td>
                <td className={td} style={{ textAlign: 'right' }}>{leasePartArea ? `${leasePartArea} ㎡` : ''}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* ── 2. 계약내용 ── */}
        <p className={sectionHeader}>2. 계약내용</p>

        {/* 제1조 */}
        <p className="mb-0.5 indent-4 text-xs leading-relaxed">
          {isSale
            ? <><span className={articleNum}>제1조</span> [목 적] 위 부동산의 매매에 있어 {buyerRole}은 매매대금을 아래와 같이 지불하기로 한다.</>
            : <><span className={articleNum}>제1조</span> [목 적] 위 부동산의 임대차에 한하여 {sellerRole}과 {buyerRole}은 합의에 의하여 임차보증금 및 차임을 아래와 같이 지급하기로 한다.</>}
        </p>

        {/* 가격 테이블 */}
        <table className="mb-3 w-full border-collapse">
          <tbody>
            {isSale ? (<>
              <tr>
                <td className={th} style={{ width: 80 }}>매매대금</td>
                <td className={td}>금 {manwonToKorean(Number(priceInfo.salePrice))}원정</td>
                <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>(￦{fmtWon(priceInfo.salePrice)})</td>
              </tr>
              <tr>
                <td className={th}>계 약 금</td>
                <td className={td}>금 {manwonToKorean(Number(priceInfo.downPayment))}원정</td>
                <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 계약시 지불하고 영수함. 영수인 <span className="inline-block w-12 border-b border-gray-400 text-center text-xs">(印)</span></td>
              </tr>
              <tr>
                <td className={th} rowSpan={priceInfo.midPayment2 ? 2 : 1}>중 도 금</td>
                <td className={td}>금 {manwonToKorean(Number(priceInfo.midPayment))}원정</td>
                <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 {priceInfo.midPaymentDate ? fmtDate(priceInfo.midPaymentDate) : '    년   월   일'}에 지불하며,</td>
              </tr>
              {priceInfo.midPayment2 && (
                <tr>
                  <td className={td}>금 {manwonToKorean(Number(priceInfo.midPayment2))}원정</td>
                  <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 {priceInfo.midPaymentDate2 ? fmtDate(priceInfo.midPaymentDate2) : '    년   월   일'}에 지불하며,</td>
                </tr>
              )}
              <tr>
                <td className={th}>잔 &nbsp; 금</td>
                <td className={td}>금 {manwonToKorean(Number(priceInfo.finalPayment))}원정</td>
                <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 {fmtDate(priceInfo.finalPaymentDate)}에 지불한다.</td>
              </tr>
              <tr>
                <td className={th}>융 자 금</td>
                <td className={td}>금 {manwonToKorean(Number(priceInfo.loanAmount))}원정</td>
                <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 하기로 한다.</td>
              </tr>
            </>) : (<>
              <tr>
                <td className={th} style={{ width: 80 }}>보 증 금</td>
                <td className={td}>금 {manwonToKorean(Number(priceInfo.deposit))}원정</td>
                <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>(￦{fmtWon(priceInfo.deposit)})</td>
              </tr>
              <tr>
                <td className={th}>계 약 금</td>
                <td className={td}>금 {manwonToKorean(Number(priceInfo.downPayment))}원정</td>
                <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 계약시에 지급하고 영수함 ※영수자 <span className="inline-block w-12 border-b border-gray-400 text-center text-xs">(印)</span></td>
              </tr>
              {priceInfo.midPayment && (
                <tr>
                  <td className={th}>중 도 금</td>
                  <td className={td}>금 {manwonToKorean(Number(priceInfo.midPayment))}원정</td>
                  <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 {fmtDate(priceInfo.midPaymentDate)}에 지급하며,</td>
                </tr>
              )}
              <tr>
                <td className={th}>잔 &nbsp; 금</td>
                <td className={td}>금 {manwonToKorean(Number(priceInfo.finalPayment))}원정</td>
                <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 {fmtDate(priceInfo.finalPaymentDate)}에 지급한다</td>
              </tr>
              {isMonthly && (
                <tr>
                  <td className={th}>차 &nbsp; 임</td>
                  <td className={td}>금 {manwonToKorean(Number(priceInfo.monthlyRent))}원정</td>
                  <td className={td} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>은 매월 {monthlyPayDay}일({monthlyPayMethod === 'prepaid' ? '선불' : '후불'}) 지급한다.</td>
                </tr>
              )}
            </>)}
          </tbody>
        </table>

        {/* ── 제2조~제9조 ── */}
        <div className="mb-3 space-y-0.5 text-xs leading-relaxed">
          {isSale ? (<>
            <p className="indent-4"><span className={articleNum}>제2조</span> [소유권이전 등] {sellerRole}은 매매대금의 잔금을 수령과 동시에 {buyerRole}에게 소유권이전등기에 필요한 모든 서류를 교부하고 등기절차에 협력하며, 위 부동산의 인도일은 <b>{fmtDate(deliveryDate)}</b>에 인도한다.</p>
            <p className="indent-4"><span className={articleNum}>제3조</span> [제한물권 등의 소멸] {sellerRole}은 위 부동산에 설정된 저당권, 지상권, 임차권 등 소유권의 행사를 제한하는 사유가 있거나, 제세공과 기타 부담금의 미납금 등이 있을때에는 잔금 수수일까지 그 권리의 하자 및 부담 등을 제거하여 완전한 소유권을 {buyerRole}에게 이전한다. 다만, 승계하기로 합의하는 권리 및 금액은 그러하지 아니한다.</p>
            <p className="indent-4"><span className={articleNum}>제4조</span> [지방세 등] 위 부동산에 관하여 발생한 수익의 귀속과 제세공과금 등의 부담은 위 부동산의 인도일을 기준으로 하되, 지방세의 납부의무 및 납부책임은 지방세법의 규정에 의한다.</p>
            <p className="indent-4"><span className={articleNum}>제5조</span> [계약의 해제] {buyerRole}이 {sellerRole}에게 중도금(중도금이 없을때에는 잔금)을 지불하기 전까지 {sellerRole}은 계약금의 배액을 상환하고, {buyerRole}은 계약금을 포기하고 본 계약을 해제할 수 있다.</p>
            <p className="indent-4"><span className={articleNum}>제6조</span> [채무불이행과 손해배상의 예정] {sellerRole} 또는 {buyerRole}가 본 계약상의 내용에 대하여 불이행이 있을 경우 그 상대방은 불이행한 자에 대하여 서면으로 최고하고 계약을 해제할 수 있다. 그리고 계약 당사자는 계약해제에 따른 손해배상을 각각 상대방에게 청구할 수 있으며, 손해배상에 대하여 별도의 약정이 없는 한 계약금을 손해배상의 기준으로 본다.</p>
            <p className="indent-4"><span className={articleNum}>제7조</span> [중개보수] 개업공인중개사는 {sellerRole} 또는 {buyerRole}의 본 계약 불이행에 대하여 책임을 지지 않는다. 또한 중개보수는 본 계약 체결에 따라 계약당사자 쌍방이 각각 지불하며, 개업공인중개사의 고의나 과실없이 본계약이 무효, 취소 또는 해제되어도 중개보수는 지급한다. 공동 중개인 경우에 {sellerRole}과 {buyerRole}은 자신이 중개 의뢰한 개업공인중개사에게 각각 중개보수를 지급한다.</p>
            <p className="indent-4"><span className={articleNum}>제8조</span> [중개보수 외] {sellerRole} 또는 {buyerRole}이 본 계약 이외의 업무를 의뢰한 경우 이에 관한 보수는 중개보수와는 별도로 지급하며 그 금액은 합의에 의한다.</p>
            <p className="indent-4"><span className={articleNum}>제9조</span> [중개대상물확인설명서교부 등] 개업공인중개사는 중개대상물확인설명서를 작성하고 업무보증관계증서(공제증서등)사본을 첨부하여 계약체결과 동시에 거래당사자 쌍방에게 교부한다.</p>
          </>) : (<>
            <p className="indent-4"><span className={articleNum}>제2조</span> [존속기간] {sellerRole}은 위 부동산을 임대차 목적대로 사용할 수 있는 상태로 <b>{fmtDate(deliveryDate)}</b>까지 {buyerRole}에게 인도하며, 임대차 기간은 인도일로부터 <b>{fmtDate(leasePeriodEnd)}</b>까지로 한다.</p>
            <p className="indent-4"><span className={articleNum}>제3조</span> [용도변경 및 전대 등] {buyerRole}은 {sellerRole}의 동의없이 위 부동산의 용도나 구조를 변경하거나 전대, 임차권 양도 또는 담보제공을 하지 못하며 임대차 목적 이외의 용도로 사용할 수 없다.</p>
            <p className="indent-4"><span className={articleNum}>제4조</span> [계약의 해지] {buyerRole}의 차임 연체액이 {isCommercial ? '3기' : '2기'}의 차임액에 달하거나, 제3조를 위반하였을 때 {sellerRole}은 즉시 본 계약을 해지할 수 있다.</p>
            <p className="indent-4"><span className={articleNum}>제5조</span> [계약의 종료] 임대차 계약이 종료된 경우 {buyerRole}은 위 부동산을 원상으로 회복하여 {sellerRole}에게 반환한다. 이러한 경우 {sellerRole}은 보증금을 {buyerRole}에게 반환하고, 연체 임대료 또는 손해배상금이 있을 때는 이들을 제하고 그 잔액을 반환한다.</p>
            <p className="indent-4"><span className={articleNum}>제6조</span> [계약의 해제] {buyerRole}이 {sellerRole}에게 중도금(중도금이 없을때는 잔금)을 지급하기 전까지 {sellerRole}은 계약금의 배액을 상환하고, {buyerRole}은 계약금을 포기하고 이 계약을 해제할 수 있다.</p>
            <p className="indent-4"><span className={articleNum}>제7조</span> [채무불이행과 손해배상의 예정] {sellerRole} 또는 {buyerRole}은 본 계약상의 내용에 대하여 불이행이 있을 경우 그 상대방은 불이행한 자에 대하여 서면으로 최고하고 계약을 해제할 수 있다. 이 경우 계약 당사자는 계약해제에 따른 손해배상을 각각 상대방에게 청구할 수 있으며, 손해배상에 대하여 별도의 약정이 없는 한 계약금을 손해배상의 기준으로 본다.</p>
            <p className="indent-4"><span className={articleNum}>제8조</span> [중개보수] 개업공인중개사는 {sellerRole} 또는 {buyerRole}의 본 계약 불이행에 대하여 책임을 지지 않는다. 또한 중개보수는 본 계약 체결에 따라 계약 당사자 쌍방이 각각 지급하며, 개업공인중개사의 고의나 과실 없이 본 계약이 무효, 취소 또는 해제되어도 중개보수는 지급한다. 공동중개인 경우에 {sellerRole}과 {buyerRole}은 자신이 중개 의뢰한 개업공인중개사에게 각각 중개보수를 지급한다.</p>
            <p className="indent-4"><span className={articleNum}>제9조</span> [중개대상물확인설명서교부 등] 개업공인중개사는 중개대상물확인설명서를 작성하고 업무보증관계증서(공제증서 등) 사본을 첨부하여 거래당사자 쌍방에게 교부한다.</p>
          </>)}
        </div>

        {/* ── 특약사항 ── */}
        <div className="mb-3">
          <p className="mb-1 text-xs font-bold text-blue-800">[ 특약사항 ]</p>
          <div className="min-h-[40px] rounded border-2 border-blue-200 bg-blue-50/30 p-2">
            {needsByeolji ? (
              <p className="text-xs font-medium text-blue-700">---별지첨부---</p>
            ) : specialTerms ? (
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{specialTerms}</p>
            ) : (
              <p className="text-xs text-gray-300">-이하여백-</p>
            )}
          </div>
        </div>

        {/* ── 계약일 + 서명 안내 ── */}
        <p className="mb-3 text-center text-xs">
          본 계약을 증명하기 위하여 계약 당사자가 이의 없음을 확인하고 각각 서명 또는 날인한다.
          <span className="ml-8">{new Date().getFullYear()}년 {String(new Date().getMonth() + 1).padStart(2, '0')}월 {String(new Date().getDate()).padStart(2, '0')}일</span>
        </p>

        {/* ── 당사자 + 개업공인중개사 테이블 ── */}
        {(() => {
          const ptd = 'border border-gray-400 px-2 py-2 text-xs leading-snug'
          const pth = 'border border-gray-400 bg-blue-50 px-2 py-2 text-xs font-medium text-center whitespace-nowrap text-blue-900'
          return (
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '5%' }} />
          </colgroup>
          <tbody>
            {/* 매도인/임대인 */}
            <tr>
              <td className={pth} rowSpan={2} style={{ writingMode: 'vertical-rl', letterSpacing: '0.3em' }}>{sellerRole}</td>
              <td className={pth}>주 소</td>
              <td className={ptd} colSpan={6}>{sellerInfo.address || ''}</td>
              <td className={ptd} rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>(印)</td>
            </tr>
            <tr>
              <td className={pth}>{ID_TYPE_OPTIONS.find(o => o.value === sellerInfo.idType)?.label}</td>
              <td className={ptd}>{formatIdByType(sellerInfo.idType, sellerInfo.idNumber)}</td>
              <td className={pth}>전화</td>
              <td className={ptd}>{formatPhoneNumber(sellerInfo.phone)}</td>
              <td className={pth}>{ID_TYPE_NAME_LABEL[sellerInfo.idType] === '성명' ? '성명' : sellerInfo.idType === 'corp' ? '법인명' : '상호'}</td>
              <td className={ptd} colSpan={2}>{sellerInfo.name || ''}</td>
            </tr>

            {/* 매수인/임차인 */}
            <tr>
              <td className={pth} rowSpan={2} style={{ writingMode: 'vertical-rl', letterSpacing: '0.3em' }}>{buyerRole}</td>
              <td className={pth}>주 소</td>
              <td className={ptd} colSpan={6}>{buyerInfo.address || ''}</td>
              <td className={ptd} rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle' }}>(印)</td>
            </tr>
            <tr>
              <td className={pth}>{ID_TYPE_OPTIONS.find(o => o.value === buyerInfo.idType)?.label}</td>
              <td className={ptd}>{formatIdByType(buyerInfo.idType, buyerInfo.idNumber)}</td>
              <td className={pth}>전화</td>
              <td className={ptd}>{formatPhoneNumber(buyerInfo.phone)}</td>
              <td className={pth}>{buyerInfo.idType === 'resident' ? '성명' : buyerInfo.idType === 'corp' ? '법인명' : '상호'}</td>
              <td className={ptd} colSpan={2}>{buyerInfo.name || ''}</td>
            </tr>

            {/* 개업공인중개사 1 */}
            <tr>
              <td className={pth} rowSpan={3} style={{ writingMode: 'vertical-rl', letterSpacing: '0.15em', fontSize: '10px' }}>{isJointBrokerage ? '개업공인중개사①' : '개업공인중개사'}</td>
              <td className={pth}>사무소 소재지</td>
              <td className={ptd} colSpan={7}>{agentInfo.address || ''}</td>
            </tr>
            <tr>
              <td className={pth}>사무소 명칭</td>
              <td className={ptd} colSpan={3}>{agentInfo.officeName || ''}</td>
              <td className={pth}>대표자</td>
              <td className={ptd} colSpan={3} style={{ textAlign: 'right' }}>{agentInfo.representative || ''} &nbsp;(印)</td>
            </tr>
            <tr>
              <td className={pth}>전화번호</td>
              <td className={ptd}>{formatPhoneNumber(agentInfo.phone)}</td>
              <td className={pth}>등록번호</td>
              <td className={ptd} colSpan={2}>{agentInfo.licenseNumber || ''}</td>
              <td className={pth} style={{ fontSize: '9px' }}>소속공인중개사</td>
              <td className={ptd} colSpan={2} style={{ textAlign: 'right', fontSize: '9px' }}>(印)</td>
            </tr>

            {/* 개업공인중개사 2 (공동중개) */}
            {isJointBrokerage && (<>
              <tr>
                <td className={pth} rowSpan={3} style={{ writingMode: 'vertical-rl', letterSpacing: '0.15em', fontSize: '10px' }}>개업공인중개사②</td>
                <td className={pth}>사무소 소재지</td>
                <td className={ptd} colSpan={7}>{coAgentInfo.address || ''}</td>
              </tr>
              <tr>
                <td className={pth}>사무소 명칭</td>
                <td className={ptd} colSpan={3}>{coAgentInfo.officeName || ''}</td>
                <td className={pth}>대표자</td>
                <td className={ptd} colSpan={3} style={{ textAlign: 'right' }}>{coAgentInfo.representative || ''} &nbsp;(印)</td>
              </tr>
              <tr>
                <td className={pth}>전화번호</td>
                <td className={ptd}>{formatPhoneNumber(coAgentInfo.phone)}</td>
                <td className={pth}>등록번호</td>
                <td className={ptd} colSpan={2}>{coAgentInfo.licenseNumber || ''}</td>
                <td className={pth} style={{ fontSize: '9px' }}>소속공인중개사</td>
                <td className={ptd} colSpan={2} style={{ textAlign: 'right', fontSize: '9px' }}>(印)</td>
              </tr>
            </>)}
          </tbody>
        </table>
          )
        })()}

        <p className="mt-4 text-center text-xs text-gray-400">
          {sellerRole}과 {buyerRole} 및 개업공인중개사는 매 장마다 간인하여야 하며 각 1통씩 보관한다.
        </p>
      </div>

      {/* ── 별지 (특약사항이 긴 경우) ── */}
      {needsByeolji && (
        <div ref={byeoljiRef} className="mx-auto mt-8 max-w-3xl bg-white px-8 py-8 shadow ring-1 ring-gray-200 print:shadow-none print:ring-0" style={{ fontFamily: 'serif', breakBefore: 'page', pageBreakBefore: 'always' }}>
          <h2 className="mb-6 text-center text-2xl font-bold tracking-[0.3em] text-blue-900">계 약 서  별 지</h2>

          {/* 별지 부동산 정보 */}
          <table className="mb-3 w-full border-collapse">
            <tbody>
              <tr>
                <td className={th} style={{ width: 80 }}>계약일자</td>
                <td className={td}>{new Date().getFullYear()}년 {String(new Date().getMonth() + 1).padStart(2, '0')}월 {String(new Date().getDate()).padStart(2, '0')}일</td>
              </tr>
              <tr>
                <td className={th}>소 재 지</td>
                <td className={td}>{property?.address || ''}{property?.dong ? ` ${property.dong}동` : ''}{property?.ho ? ` ${property.ho}호` : ''}</td>
              </tr>
              {!isLand && (
                <tr>
                  <td className={th}>토 &nbsp; 지</td>
                  <td className={td}>
                    지목: {(property?.extra_info as Record<string, string> | null)?.land_category || '대'}, 면적: {(property?.extra_info as Record<string, string> | null)?.land_area_m2 ? `${(property?.extra_info as Record<string, string>).land_area_m2}㎡` : ''}
                  </td>
                </tr>
              )}
              {isLand && (
                <tr>
                  <td className={th}>토 &nbsp; 지</td>
                  <td className={td}>
                    지목: {(property?.extra_info as Record<string, string> | null)?.land_category || ''}, 면적: {(property?.extra_info as Record<string, string> | null)?.land_area_m2 ? `${(property?.extra_info as Record<string, string>).land_area_m2}㎡` : ''}
                  </td>
                </tr>
              )}
              {!isLand && (
                <tr>
                  <td className={th}>건 &nbsp; 물</td>
                  <td className={td}>
                    구조: {(property?.extra_info as Record<string, string> | null)?.building_structure || ''}, 용도: {(property?.extra_info as Record<string, string> | null)?.building_usage || findCategory(property?.category_id)?.name || ''}, 면적: {property?.exclusive_area_m2 ? `${property.exclusive_area_m2}㎡` : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* 특약사항 내용 */}
          <div className="mb-6">
            <p className="mb-3 text-sm font-bold text-blue-800">특약사항</p>
            <div className="min-h-[300px] rounded border-2 border-blue-200 bg-blue-50/30 p-4">
              <p className="whitespace-pre-wrap text-sm leading-loose">{specialTerms}</p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-500">────────── 이 하 여 백 ──────────</p>
        </div>
      )}
      </div>{/* previewRef 끝 */}

      <div className="no-print flex items-center justify-center gap-3">
        <button onClick={onGoBack}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          수정하기
        </button>
        <button onClick={handleDownloadPdf} disabled={isPdfLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {isPdfLoading ? (
            <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>PDF 생성 중...</>
          ) : (
            <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>PDF 다운로드</>
          )}
        </button>
      </div>
    </div>
  )
}
