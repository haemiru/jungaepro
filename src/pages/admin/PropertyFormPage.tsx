import { useState, useEffect, useMemo, useRef, useCallback, type DragEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { TransactionType, PropertyStatus, PropertyCategory, PropertyExtraInfo } from '@/types/database'
import { fetchPropertyById, createProperty, updateProperty, fetchCategories } from '@/api/properties'
import { getAgentProfileId } from '@/api/helpers'
import { fetchSearchSettings, fetchAgentSpecialties } from '@/api/settings'
import { uploadPropertyPhoto, deletePropertyPhoto, validateFile } from '@/api/storage'
import { getTagBasedConditions, type TagConditionInfo } from '@/utils/conditionResolver'
import { Button, Input } from '@/components/common'
import { generateContent } from '@/api/gemini'
import { KakaoMap } from '@/components/common/KakaoMap'
import { openAddressSearch, geocodeAddress } from '@/utils/mapAddress'
import { formatNumber, formatPrice, parseCommaNumber, sqmToPyeong, pyeongToSqm } from '@/utils/format'
import { AreaUnitToggle } from '@/components/common/AreaUnitToggle'
import { useAreaUnitStore } from '@/stores/areaUnitStore'
import {
  getCategoryGroup,
  STRUCTURE_VISIBILITY,
  DETAIL_VISIBILITY,
  PRICE_OVERRIDES,
  OPTIONS_PER_GROUP,
  EXTRA_FIELDS,
  WHOLE_BUILDING_EXTRA_FIELDS,
  emptyExtraInfo,
  emptyBuilding,
  BUILDING_STRUCTURE_OPTIONS,
  BUILDING_USAGE_OPTIONS,
  type CategoryGroup,
  type ExtraInfoForm,
  type ExtraFieldDef,
  type BuildingFormItem,
} from '@/utils/categoryFormConfig'
import toast from 'react-hot-toast'

const tabs = [
  { id: 'basic', label: '기본정보' },
  { id: 'location', label: '위치' },
  { id: 'price', label: '가격' },
  { id: 'structure', label: '면적/구조' },
  { id: 'detail', label: '상세' },
  { id: 'media', label: '미디어' },
  { id: 'description', label: '설명' },
  { id: 'co-brokerage', label: '공동중개' },
  { id: 'memo', label: '내부메모' },
] as const

type TabId = (typeof tabs)[number]['id']

const directionOptions = ['동향', '서향', '남향', '북향', '남동향', '남서향', '북동향', '북서향']

type FormData = {
  category_id: string
  title: string
  transaction_type: TransactionType
  status: PropertyStatus
  address: string
  address_detail: string
  dong: string
  ho: string
  sale_price: string
  deposit: string
  monthly_rent: string
  maintenance_fee: string
  supply_area_m2: string
  exclusive_area_m2: string
  rooms: string
  bathrooms: string
  total_floors: string
  floor: string
  direction: string
  move_in_date: string
  parking_per_unit: string
  has_elevator: boolean
  pets_allowed: boolean
  latitude: string
  longitude: string
  options: string[]
  description: string
  is_urgent: boolean
  is_co_brokerage: boolean
  co_brokerage_fee_ratio: string
  internal_memo: string
  built_year: string
  tags: string
  predefinedTags: string[]
  photos: string[]
  extra_info: ExtraInfoForm
  buildings: BuildingFormItem[]
}

const emptyForm: FormData = {
  category_id: '', title: '', transaction_type: 'sale', status: 'draft',
  address: '', address_detail: '', dong: '', ho: '',
  sale_price: '', deposit: '', monthly_rent: '', maintenance_fee: '',
  supply_area_m2: '', exclusive_area_m2: '', rooms: '', bathrooms: '',
  total_floors: '', floor: '', direction: '', move_in_date: '',
  latitude: '', longitude: '',
  parking_per_unit: '', has_elevator: false, pets_allowed: false,
  options: [], description: '', is_urgent: false, is_co_brokerage: false,
  co_brokerage_fee_ratio: '', internal_memo: '', built_year: '', tags: '', predefinedTags: [], photos: [],
  extra_info: { ...emptyExtraInfo },
  buildings: [{ ...emptyBuilding }],
}

export function PropertyFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id
  const [activeTab, setActiveTab] = useState<TabId>('basic')
  const [form, setForm] = useState<FormData>(emptyForm)
  const [categories, setCategories] = useState<PropertyCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [specialties, setSpecialties] = useState<string[]>([])
  const [tagConditions] = useState<TagConditionInfo[]>(getTagBasedConditions())
  const [customTagLabels, setCustomTagLabels] = useState<string[]>([])
  const [isWholeBuilding, setIsWholeBuilding] = useState(false)
  const [isPreConstruction, setIsPreConstruction] = useState(false)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]))
    fetchAgentSpecialties().then(setSpecialties).catch(() => {})
    fetchSearchSettings()
      .then((s) => {
        const customs = s.quick_cards
          .filter((c) => c.is_custom && c.is_enabled)
          .map((c) => c.label)
        setCustomTagLabels(customs)
      })
      .catch(() => {})
    if (id) {
      fetchPropertyById(id).then((p) => {
        if (!p) { navigate('/admin/properties'); return }
        const existingTags = p.tags || []
        const builtInTags = getTagBasedConditions().map((t) => t.tag)
        const predefined = existingTags.filter((t) => builtInTags.includes(t))
        const freeText = existingTags.filter((t) => !builtInTags.includes(t))
        const ei = p.extra_info || {}
        setForm({
          category_id: p.category_id || '',
          title: p.title,
          transaction_type: p.transaction_type,
          status: p.status,
          address: p.address,
          address_detail: p.address_detail || '',
          dong: p.dong || '',
          ho: p.ho || '',
          sale_price: p.sale_price ? String(p.sale_price) : '',
          deposit: p.deposit ? String(p.deposit) : '',
          monthly_rent: p.monthly_rent ? String(p.monthly_rent) : '',
          maintenance_fee: p.maintenance_fee ? String(p.maintenance_fee) : '',
          supply_area_m2: p.supply_area_m2 ? String(p.supply_area_m2) : '',
          exclusive_area_m2: p.exclusive_area_m2 ? String(p.exclusive_area_m2) : '',
          rooms: p.rooms != null ? String(p.rooms) : '',
          bathrooms: p.bathrooms != null ? String(p.bathrooms) : '',
          total_floors: p.total_floors != null ? String(p.total_floors) : '',
          floor: p.floor != null ? String(p.floor) : '',
          latitude: p.latitude != null ? String(p.latitude) : '',
          longitude: p.longitude != null ? String(p.longitude) : '',
          direction: p.direction || '',
          move_in_date: p.move_in_date || '',
          parking_per_unit: p.parking_per_unit != null ? String(p.parking_per_unit) : '',
          has_elevator: p.has_elevator,
          pets_allowed: p.pets_allowed,
          options: p.options || [],
          description: p.description || '',
          is_urgent: p.is_urgent,
          is_co_brokerage: p.is_co_brokerage,
          co_brokerage_fee_ratio: p.co_brokerage_fee_ratio != null ? String(p.co_brokerage_fee_ratio) : '',
          internal_memo: p.internal_memo || '',
          built_year: (() => {
            const v = p.built_year != null ? String(p.built_year) : ''
            // 기존 정수 데이터(예: "2026")를 YYYY-MM 형식으로 정규화
            return v && !v.includes('-') ? `${v}-01` : v
          })(),
          tags: freeText.join(', '),
          predefinedTags: predefined,
          photos: p.photos || [],
          extra_info: {
            ...emptyExtraInfo,
            heating_type: ei.heating_type || '',
            household_count: ei.household_count != null ? String(ei.household_count) : '',
            expected_move_in: ei.expected_move_in || '',
            builder: ei.builder || '',
            premium: ei.premium != null ? String(ei.premium) : '',
            business_restriction: ei.business_restriction || '',
            key_money: ei.key_money != null ? String(ei.key_money) : '',
            foot_traffic: ei.foot_traffic || '',
            frontage_width: ei.frontage_width != null ? String(ei.frontage_width) : '',
            ceiling_height: ei.ceiling_height != null ? String(ei.ceiling_height) : '',
            building_structure: ei.building_structure || '',
            land_area_m2: ei.land_area_m2 != null ? String(ei.land_area_m2) : '',
            land_category: ei.land_category || '',
            zoning: ei.zoning || '',
            road_frontage: ei.road_frontage || '',
            bcr_far: ei.bcr_far || '',
            slope_terrain: ei.slope_terrain || '',
            building_area_m2: ei.building_area_m2 != null ? String(ei.building_area_m2) : '',
            power_capacity: ei.power_capacity || '',
            truck_25t: ei.truck_25t || false,
            truck_wingbody: ei.truck_wingbody || false,
            truck_trailer_40ft: ei.truck_trailer_40ft || false,
            loading_dock: ei.loading_dock || false,
            cold_storage: ei.cold_storage || false,
            project_phase: ei.project_phase || '',
            member_price: ei.member_price != null ? String(ei.member_price) : '',
            expected_households: ei.expected_households != null ? String(ei.expected_households) : '',
            room_count: ei.room_count != null ? String(ei.room_count) : '',
            monthly_avg_revenue: ei.monthly_avg_revenue != null ? String(ei.monthly_avg_revenue) : '',
            business_license: ei.business_license || '',
          },
          buildings: Array.isArray(ei.buildings) && ei.buildings.length > 0
            ? ei.buildings.map((b: Record<string, unknown>) => ({
                name: String(b.name || ''),
                building_area_m2: b.building_area_m2 != null ? String(b.building_area_m2) : '',
                gross_floor_area_m2: b.gross_floor_area_m2 != null ? String(b.gross_floor_area_m2) : '',
                ceiling_height: b.ceiling_height != null ? String(b.ceiling_height) : '',
                building_structure: String(b.building_structure || ''),
                floors: b.floors != null ? String(b.floors) : '',
                built_year: String(b.built_year || ''),
                usage: String(b.usage || ''),
              }))
            : [{ ...emptyBuilding }],
        })
        // 공동주택이면서 동/호 모두 비어있으면 전체 건물로 간주
        if (!p.dong && !p.ho) setIsWholeBuilding(true)
        // 준공연도 없으면 준공예정으로 간주
        if (!p.built_year) setIsPreConstruction(true)
      })
    }
  }, [id, navigate])

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => setForm((prev) => ({ ...prev, [key]: value }))
  const setExtra = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, extra_info: { ...prev.extra_info, [key]: value } }))

  // ─── Buildings (공장/창고 복수 건물) ───
  const setBuilding = (index: number, key: keyof BuildingFormItem, value: string) =>
    setForm((prev) => {
      const updated = [...prev.buildings]
      updated[index] = { ...updated[index], [key]: value }
      return { ...prev, buildings: updated }
    })
  const addBuilding = () =>
    setForm((prev) => ({ ...prev, buildings: [...prev.buildings, { ...emptyBuilding }] }))
  const removeBuilding = (index: number) =>
    setForm((prev) => ({
      ...prev,
      buildings: prev.buildings.length > 1 ? prev.buildings.filter((_, i) => i !== index) : prev.buildings,
    }))

  // ─── Category group ───
  const selectedCategoryName = useMemo(() => {
    const cat = categories.find((c) => c.id === form.category_id)
    return cat?.name ?? ''
  }, [categories, form.category_id])

  const catGroup: CategoryGroup | null = useMemo(() => getCategoryGroup(selectedCategoryName), [selectedCategoryName])

  // 전세 불가 카테고리로 변경 시 거래유형 리셋
  useEffect(() => {
    if (catGroup && catGroup !== 'residential' && form.transaction_type === 'jeonse') {
      set('transaction_type', 'sale')
    }
  }, [catGroup]) // eslint-disable-line react-hooks/exhaustive-deps

  // 전체 건물 모드: 공급면적/전용면적/방/욕실/해당층 숨김, 총층수/준공연도만 표시
  const wholeBuildingStructVis = { supply_area: false, exclusive_area: false, rooms: false, bathrooms: false, floor: false, total_floors: true, direction: false, built_year: true }
  const isHouse = selectedCategoryName === '주택'
  const isHouseSale = isHouse && form.transaction_type === 'sale'
  const isHouseLease = isHouse && form.transaction_type !== 'sale'

  // 주택 매매: 건물/토지 정보 중심 (대지면적, 연면적, 건물구조 등)
  const houseSaleStructVis = { supply_area: false, exclusive_area: false, rooms: true, bathrooms: true, floor: false, total_floors: true, direction: true, built_year: true }
  // 주택 전세/월세: 세대 정보 중심 (전용면적, 해당층 등) — 일반 residential과 유사
  const houseLeaseStructVis = { supply_area: false, exclusive_area: true, rooms: true, bathrooms: true, floor: true, total_floors: true, direction: true, built_year: true }

  const structVis = isWholeBuilding
    ? wholeBuildingStructVis
    : isHouseSale
      ? houseSaleStructVis
      : isHouseLease
        ? houseLeaseStructVis
        : (catGroup ? STRUCTURE_VISIBILITY[catGroup] : null)
  const detailVis = catGroup ? DETAIL_VISIBILITY[catGroup] : null
  const priceOvr = catGroup ? PRICE_OVERRIDES[catGroup] : null
  const optionChoices = catGroup ? OPTIONS_PER_GROUP[catGroup] : ['에어컨', '냉장고', '세탁기', '가스레인지', '인덕션', '전자레인지', '옷장', '신발장', '침대', '책상', 'TV', '인터넷', 'CCTV', '현관보안', '비디오폰']

  // 주택 매매: 건물/토지 extra fields
  const HOUSE_SALE_EXTRA_FIELDS: ExtraFieldDef[] = [
    { key: 'land_area_m2', label: '대지면적', type: 'area', tab: 'structure', required: true },
    { key: 'gross_floor_area_m2', label: '연면적', type: 'area', tab: 'structure', required: true },
    { key: 'building_structure', label: '건물구조', type: 'select', options: ['철근콘크리트', '철골조', '철골철근콘크리트', '조적조', '목조', '경량철골'], tab: 'structure', required: true },
    { key: 'building_usage', label: '건물용도', type: 'text', placeholder: '예: 단독주택, 다가구주택', tab: 'structure' },
    { key: 'land_category', label: '지목', type: 'select', options: ['대', '전', '답', '임야', '잡종지', '기타'], tab: 'structure' },
    { key: 'heating_type', label: '난방방식', type: 'select', options: ['개별난방', '중앙난방', '지역난방'], tab: 'structure', required: true },
    { key: 'zoning', label: '용도지역', type: 'select', options: ['제1종일반주거', '제2종일반주거', '제3종일반주거', '준주거', '일반상업', '근린상업', '기타'], tab: 'structure' },
    { key: 'bcr_far', label: '건폐율/용적률', type: 'text', placeholder: '예: 60%/200%', tab: 'structure' },
  ]
  // 주택 전세/월세: 일반 residential extra fields 사용
  const HOUSE_LEASE_EXTRA_FIELDS: ExtraFieldDef[] = [
    { key: 'heating_type', label: '난방방식', type: 'select', options: ['개별난방', '중앙난방', '지역난방'], tab: 'structure', required: true },
    { key: 'building_structure', label: '건물구조', type: 'select', options: ['철근콘크리트', '철골조', '철골철근콘크리트', '조적조', '목조', '경량철골'], tab: 'structure' },
  ]

  const extraFieldsForTab = useCallback((tab: 'structure' | 'detail' | 'price'): ExtraFieldDef[] => {
    if (isWholeBuilding) return WHOLE_BUILDING_EXTRA_FIELDS.filter((f) => f.tab === tab)
    if (isHouseSale) return HOUSE_SALE_EXTRA_FIELDS.filter((f) => f.tab === tab)
    if (isHouseLease) return HOUSE_LEASE_EXTRA_FIELDS.filter((f) => f.tab === tab)
    if (!catGroup) return []
    return (EXTRA_FIELDS[catGroup] || []).filter((f) => f.tab === tab)
  }, [catGroup, isWholeBuilding, isHouseSale, isHouseLease]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tag conditions ───
  const visibleTagConditions = useMemo(() => {
    return selectedCategoryName
      ? tagConditions.filter((t) => !t.categories || t.categories.includes(selectedCategoryName))
      : tagConditions
  }, [tagConditions, selectedCategoryName])

  const visibleCustomTags = useMemo(() => customTagLabels, [customTagLabels])

  // ─── Handlers ───

  const handleSubmit = async () => {
    console.log('[Submit] handleSubmit called, activeTab:', activeTab)
    // 모든 탭의 필수 필드 검증 (수정 모드에서도 탭별 검증이 빠지지 않도록)
    for (const tab of tabs) {
      const error = validateTab(tab.id as TabId)
      if (error) {
        setActiveTab(tab.id)
        toast.error(error)
        return
      }
    }
    setIsLoading(true)
    try {
      console.log('[Submit] getting agentProfileId...')
      const agentId = await getAgentProfileId()
      console.log('[Submit] agentId:', agentId)

      // Build extra_info from form state (only include fields relevant to current category)
      const extraInfo: PropertyExtraInfo = {}
      if (catGroup) {
        const relevantFields = EXTRA_FIELDS[catGroup] || []
        for (const fd of relevantFields) {
          const val = form.extra_info[fd.key as keyof ExtraInfoForm]
          if (fd.type === 'checkbox') {
            if (val) (extraInfo as Record<string, unknown>)[fd.key] = true
          } else if (fd.type === 'area' || fd.type === 'number') {
            const num = typeof val === 'string' ? parseFloat(val) : NaN
            if (!isNaN(num)) (extraInfo as Record<string, unknown>)[fd.key] = num
          } else {
            if (val && typeof val === 'string' && val.trim()) (extraInfo as Record<string, unknown>)[fd.key] = val.trim()
          }
        }

        // 관리비(평당), 월세(평당) — EXTRA_FIELDS에 없는 수동 필드
        if (form.extra_info.maintenance_per_pyeong) {
          extraInfo.maintenance_per_pyeong = parseFloat(form.extra_info.maintenance_per_pyeong)
        }
        if (form.extra_info.rent_per_pyeong) {
          extraInfo.rent_per_pyeong = parseFloat(form.extra_info.rent_per_pyeong)
        }

        // 공장/창고: buildings 배열 직렬화
        if (catGroup === 'industrial') {
          const validBuildings = form.buildings
            .filter((b) => b.name.trim() || b.building_area_m2)
            .map((b) => ({
              name: b.name.trim() || `건물 ${form.buildings.indexOf(b) + 1}`,
              building_area_m2: parseFloat(b.building_area_m2) || 0,
              ...(b.gross_floor_area_m2 ? { gross_floor_area_m2: parseFloat(b.gross_floor_area_m2) } : {}),
              ...(b.ceiling_height ? { ceiling_height: parseFloat(b.ceiling_height) } : {}),
              ...(b.building_structure ? { building_structure: b.building_structure } : {}),
              ...(b.floors ? { floors: parseInt(b.floors) } : {}),
              ...(b.built_year ? { built_year: b.built_year } : {}),
              ...(b.usage ? { usage: b.usage } : {}),
            }))
          if (validBuildings.length > 0) {
            extraInfo.buildings = validBuildings
            // 하위호환: 총 건물면적 합산
            extraInfo.building_area_m2 = validBuildings.reduce((sum, b) => sum + b.building_area_m2, 0)
          }
        }
      }

      const payload = {
        agent_id: agentId,
        category_id: form.category_id || null,
        title: form.title,
        transaction_type: form.transaction_type,
        status: form.status,
        address: form.address,
        address_detail: form.address_detail || null,
        dong: form.dong || null,
        ho: form.ho || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        sale_price: parseCommaNumber(form.sale_price),
        deposit: parseCommaNumber(form.deposit),
        monthly_rent: parseCommaNumber(form.monthly_rent),
        maintenance_fee: form.maintenance_fee ? parseInt(form.maintenance_fee) : null,
        supply_area_m2: form.supply_area_m2 ? parseFloat(form.supply_area_m2) : null,
        exclusive_area_m2: form.exclusive_area_m2 ? parseFloat(form.exclusive_area_m2) : null,
        rooms: form.rooms ? parseInt(form.rooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        total_floors: form.total_floors ? parseInt(form.total_floors) : null,
        floor: form.floor ? parseInt(form.floor) : null,
        direction: form.direction || null,
        move_in_date: form.move_in_date || null,
        parking_per_unit: form.parking_per_unit ? parseFloat(form.parking_per_unit) : null,
        has_elevator: form.has_elevator,
        pets_allowed: form.pets_allowed,
        options: form.options.length > 0 ? form.options : null,
        description: form.description || null,
        is_urgent: form.is_urgent,
        is_co_brokerage: form.is_co_brokerage,
        co_brokerage_fee_ratio: form.co_brokerage_fee_ratio ? parseFloat(form.co_brokerage_fee_ratio) : null,
        internal_memo: form.internal_memo || null,
        built_year: form.built_year || null,
        tags: (() => {
          const freeText = form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : []
          const merged = [...form.predefinedTags, ...freeText]
          return merged.length > 0 ? merged : null
        })(),
        photos: form.photos.length > 0 ? form.photos : null,
        extra_info: Object.keys(extraInfo).length > 0 ? extraInfo : null,
      }
      console.log('[Submit] payload built, calling API...')
      if (isEdit) {
        await updateProperty(id!, payload)
        toast.success('매물이 수정되었습니다.')
      } else {
        await createProperty(payload as Parameters<typeof createProperty>[0])
        toast.success('매물이 등록되었습니다.')
      }
      console.log('[Submit] API success')
      navigate('/admin/properties')
    } catch (err) {
      console.error('매물 저장 실패:', err)
      toast.error(err instanceof Error ? `저장 실패: ${err.message}` : '저장에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleOption = (opt: string) => {
    set('options', form.options.includes(opt) ? form.options.filter((o) => o !== opt) : [...form.options, opt])
  }

  const handleTogglePredefinedTag = (tag: string) => {
    set('predefinedTags', form.predefinedTags.includes(tag) ? form.predefinedTags.filter((t) => t !== tag) : [...form.predefinedTags, tag])
  }

  const handleFiles = async (files: File[]) => {
    console.log('[Upload] handleFiles called, files:', files.length)
    const validFiles = files.filter((f) => {
      const err = validateFile(f)
      if (err) { toast.error(`${f.name}: ${err}`); return false }
      return true
    }).slice(0, 20)
    if (validFiles.length === 0) { console.log('[Upload] no valid files'); return }
    setUploading(true)
    try {
      console.log('[Upload] getting agentProfileId...')
      const agentId = await getAgentProfileId()
      console.log('[Upload] agentId:', agentId)
      const urls: string[] = []
      let failCount = 0
      for (const f of validFiles) {
        try {
          console.log('[Upload] uploading:', f.name, f.size, f.type)
          const url = await uploadPropertyPhoto(f, agentId)
          console.log('[Upload] success:', f.name, url)
          urls.push(url)
        } catch (e) {
          failCount++
          console.error('[Upload] 개별 실패:', f.name, e)
        }
      }
      if (urls.length > 0) {
        setForm((prev) => ({ ...prev, photos: [...prev.photos, ...urls].slice(0, 20) }))
        toast.success(`${urls.length}장 업로드 완료`)
      }
      if (failCount > 0) toast.error(`${failCount}장 업로드 실패`)
      if (urls.length === 0 && failCount === 0) toast.error('업로드할 파일이 없습니다.')
    } catch (err) {
      console.error('[Upload] 전체 에러:', err)
      toast.error(err instanceof Error ? err.message : '사진 업로드에 실패했습니다.')
    } finally {
      console.log('[Upload] done, setUploading(false)')
      setUploading(false)
    }
  }

  const handleDragOver = (e: DragEvent) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = () => setDragOver(false)
  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    if (files.length > 0) handleFiles(files)
  }

  const handleDeletePhoto = useCallback(async (index: number) => {
    setForm((prev) => {
      const url = prev.photos[index]
      if (url) deletePropertyPhoto(url).catch(() => {})
      return { ...prev, photos: prev.photos.filter((_, i) => i !== index) }
    })
  }, [])

  const handleSetPrimary = useCallback((index: number) => {
    setForm((prev) => {
      const next = [...prev.photos]; const [item] = next.splice(index, 1); next.unshift(item)
      return { ...prev, photos: next }
    })
  }, [])

  const handleMovePhoto = useCallback((index: number, dir: -1 | 1) => {
    setForm((prev) => {
      const next = [...prev.photos]; const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, photos: next }
    })
  }, [])

  const handleOpenPostcode = useCallback(async () => {
    try {
      const result = await openAddressSearch()
      const addr = result.roadAddress || result.jibunAddress
      set('address', addr)
      const coords = await geocodeAddress(addr)
      if (coords) { set('latitude', String(coords.lat)); set('longitude', String(coords.lng)) }
    } catch { toast.error('주소 검색을 열 수 없습니다.') }
  }, [])

  const handleAIDescription = useCallback(async () => {
    if (!form.title && !form.address) { toast.error('제목 또는 주소를 먼저 입력해주세요.'); return }
    setAiGenerating(true)
    try {
      const catName = categories.find((c) => c.id === form.category_id)?.name || ''
      const txLabel = { sale: '매매', jeonse: '전세', monthly: '월세' }[form.transaction_type] || ''
      const priceInfo = form.transaction_type === 'sale'
        ? (form.sale_price ? `매매가 ${Number(form.sale_price).toLocaleString()}만원` : '')
        : form.transaction_type === 'jeonse'
          ? (form.deposit ? `전세 ${Number(form.deposit).toLocaleString()}만원` : '')
          : [form.deposit ? `보증금 ${Number(form.deposit).toLocaleString()}만원` : '', form.monthly_rent ? `월세 ${Number(form.monthly_rent).toLocaleString()}만원` : ''].filter(Boolean).join(' / ')
      const buildingsInfo = catGroup === 'industrial' && form.buildings.some((b) => b.building_area_m2)
        ? form.buildings.filter((b) => b.building_area_m2).map((b) =>
            `${b.name || '건물'}(${b.building_area_m2}㎡${b.ceiling_height ? `, 층고 ${b.ceiling_height}m` : ''}${b.building_structure ? `, ${b.building_structure}` : ''}${b.usage ? `, ${b.usage}` : ''})`
          ).join(', ')
        : ''
      const areaInfo = [
        form.supply_area_m2 ? `공급 ${form.supply_area_m2}㎡` : '',
        form.exclusive_area_m2 ? `전용 ${form.exclusive_area_m2}㎡` : '',
        form.extra_info.land_area_m2 ? `대지 ${form.extra_info.land_area_m2}㎡` : '',
        catGroup !== 'industrial' && form.extra_info.building_area_m2 ? `건물 ${form.extra_info.building_area_m2}㎡` : '',
        buildingsInfo ? `건물: ${buildingsInfo}` : '',
      ].filter(Boolean).join(', ')
      const structInfo = [
        form.rooms ? `방 ${form.rooms}개` : '',
        form.bathrooms ? `욕실 ${form.bathrooms}개` : '',
        form.floor ? `${form.floor}층` : '',
        form.total_floors ? `(총 ${form.total_floors}층)` : '',
        form.direction || '',
        form.extra_info.ceiling_height ? `층고 ${form.extra_info.ceiling_height}m` : '',
        form.extra_info.room_count ? `객실 ${form.extra_info.room_count}개` : '',
      ].filter(Boolean).join(', ')
      const detailInfo = [
        form.has_elevator ? '엘리베이터 있음' : '',
        form.pets_allowed ? '반려동물 가능' : '',
        form.parking_per_unit ? `주차 ${form.parking_per_unit}대` : '',
        form.options.length > 0 ? `옵션: ${form.options.join(', ')}` : '',
        form.extra_info.power_capacity ? `전력 ${form.extra_info.power_capacity}` : '',
        form.extra_info.truck_25t ? '25톤진입가능' : '',
        form.extra_info.truck_wingbody ? '윙바디진입가능' : '',
        form.extra_info.truck_trailer_40ft ? '40ft트레일러진입가능' : '',
        form.extra_info.zoning ? `용도지역: ${form.extra_info.zoning}` : '',
        form.extra_info.project_phase ? `사업단계: ${form.extra_info.project_phase}` : '',
        form.extra_info.business_license ? `인허가: ${form.extra_info.business_license}` : '',
      ].filter(Boolean).join(', ')

      const categoryGuideMap: Record<string, string> = {
        '아파트': '주소 위치를 기반으로 주변 학군(초·중·고), 가장 가까운 지하철역과 도보 소요시간, 주변 생활 인프라(마트·병원·공원), 투자 적합도(시세 전망·입지 가치)를 분석하여 포함하세요.',
        '오피스텔': '주소 위치를 기반으로 가장 가까운 지하철역과 도보 소요시간, 주변 업무지구·상권, 교통 접근성(버스·지하철 노선), 임대 수익률 관점의 투자 적합도를 분석하여 포함하세요.',
        '빌라': '주소 위치를 기반으로 주변 학군(초·중·고), 가장 가까운 지하철역·버스 정류장과 소요시간, 주변 생활 편의시설을 분석하여 포함하세요.',
        '상가': '주소 위치를 기반으로 해당 상권의 특성(유동인구·업종 분포), 가장 가까운 지하철역과 도보 소요시간, 주변 주요 시설(대형 건물·아파트 단지 등), 상권 투자 적합도를 분석하여 포함하세요.',
        '사무실': '주소 위치를 기반으로 주변 업무지구·상권, 가장 가까운 지하철역과 도보 소요시간, 버스 노선, 주변 편의시설(식당가·은행·관공서), 임대 수요 전망을 분석하여 포함하세요.',
        '지식산업센터': '주소 위치를 기반으로 가장 가까운 지하철역과 도보 소요시간, 주변 업무지구·산업단지, 주차 편의성, 입주 가능 업종(제조·IT·연구개발), 주변 편의시설(식당가·편의점), 임대 수요 및 투자 적합도를 분석하여 포함하세요.',
        '전원주택': '주소 위치를 기반으로 가장 가까운 IC(나들목)와 차량 소요시간, 대중교통 접근성, 가장 가까운 종합병원·마트·학교까지의 거리, 자연환경(산·하천·공원), 전원생활의 장점을 분석하여 포함하세요.',
        '공장/창고': '주소 위치를 기반으로 가장 가까운 IC(나들목)와 차량 소요시간, 주요 물류 거점과의 거리, 진입 가능 차량(톤수), 층고 정보, 전력 용량, 투자 적합도를 분석하여 포함하세요.',
        '토지': '주소 위치를 기반으로 해당 토지의 용도지역에 따른 건축 가능 용도와 건폐율·용적률, 주변 개발 계획, 도로 접면 상태, 향후 가치 상승 전망 등 투자 적합도를 분석하여 포함하세요.',
      }
      const categoryGuide = categoryGuideMap[catName] || '주소 위치를 기반으로 주변 교통(지하철·버스), 생활 인프라, 투자 적합도를 분석하여 포함하세요.'

      const prompt = `다음 부동산 매물의 매력적인 설명을 작성해주세요. 500~800자 내외로, 매물의 장점과 특징을 잘 드러내주세요.

매물 정보:
- 유형: ${catName || '미정'}
- 거래: ${txLabel}
- 제목: ${form.title || '미정'}
- 주소: ${form.address || '미정'}
${priceInfo ? `- 가격: ${priceInfo}` : ''}
${areaInfo ? `- 면적: ${areaInfo}` : ''}
${structInfo ? `- 구조: ${structInfo}` : ''}
${detailInfo ? `- 상세: ${detailInfo}` : ''}
${form.move_in_date ? `- 입주가능일: ${form.move_in_date}` : ''}
${form.built_year ? `- 준공: ${form.built_year}` : ''}

[위치 기반 분석 필수]
${categoryGuide}
위 분석 내용을 매물 설명 안에 자연스럽게 녹여서 작성하세요. 거리·소요시간 등 구체적인 수치를 포함하세요.`

      const systemPrompt = `당신은 대한민국 공인중개사 매물 설명 전문 작성가입니다.
다음 원칙을 반드시 지켜 작성하세요:
1. 주소를 기반으로 실제 주변 정보(교통, 학군, 상권, 편의시설 등)를 분석하여 구체적으로 기술합니다.
2. 거리와 소요시간은 구체적인 수치로 작성합니다 (예: "강남역 도보 5분", "경부고속도로 서초IC 차량 10분").
3. 매물 유형에 맞는 핵심 정보를 우선 배치합니다.
4. 전문적이면서도 고객에게 친근한 어조를 사용합니다.
5. 과장이나 허위 정보 없이 사실 기반으로 작성합니다. 확실하지 않은 정보는 "인근", "도보권" 등 범위로 표현합니다.
6. 마크다운, 특수문자, 글머리 기호 없이 순수 텍스트 문단으로 작성합니다.`

      const result = await generateContent(prompt, systemPrompt)
      set('description', result.trim())
      toast.success('AI 설명이 생성되었습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI 생성에 실패했습니다.')
    } finally {
      setAiGenerating(false)
    }
  }, [form, categories, catGroup])

  const validateTab = (tabId: TabId): string | null => {
    // 렌더링에 사용하는 것과 동일한 catGroup/structVis 참조
    switch (tabId) {
      case 'basic':
        if (!form.category_id) return '매물유형을 선택해주세요.'
        if (!form.title) return '제목을 입력해주세요.'
        return null
      case 'location': {
        if (!form.address) return '주소를 입력해주세요.'
        if (['아파트', '오피스텔', '빌라'].includes(selectedCategoryName) && !isWholeBuilding) {
          if (!form.ho) return '호수를 입력해주세요.'
        }
        return null
      }
      case 'price':
        if (form.transaction_type === 'sale' && !form.sale_price) return '매매가를 입력해주세요.'
        if (form.transaction_type === 'jeonse' && !form.deposit) return '전세금을 입력해주세요.'
        if (form.transaction_type === 'monthly' && !form.deposit) return '보증금을 입력해주세요.'
        if (form.transaction_type === 'monthly' && !form.monthly_rent) return '월세를 입력해주세요.'
        return null
      case 'structure': {
        // 계약서/확인설명서에 포함되는 필드는 모두 필수
        if (catGroup !== 'land' && catGroup !== 'industrial') {
          // structVis 기반: UI에 보이는 필드만 검증
          if (structVis?.exclusive_area && !form.exclusive_area_m2) return '전용면적을 입력해주세요.'
          if (structVis?.supply_area && !form.supply_area_m2) return '공급면적을 입력해주세요.'
          if (structVis?.rooms && !form.rooms) return '방 수를 입력해주세요.'
          if (structVis?.bathrooms && !form.bathrooms) return '욕실 수를 입력해주세요.'
          if (structVis?.floor && !form.floor) return '해당층을 입력해주세요.'
          if (structVis?.total_floors && !form.total_floors) return '총층수를 입력해주세요.'
          if (structVis?.direction && !form.direction) return '방향을 선택해주세요.'
          if (structVis?.built_year && !isPreConstruction) {
            if (!form.built_year || !/^\d{4}-\d{2}$/.test(form.built_year)) return '준공연도를 입력해주세요.'
            if (form.built_year > new Date().toISOString().slice(0, 7)) return '준공연도는 미래일 수 없습니다.'
          }
        }
        if (catGroup === 'industrial') {
          if (form.buildings.length === 0) return '건물을 1개 이상 추가해주세요.'
          const b = form.buildings[0]
          if (!b.building_area_m2) return '첫 번째 건물의 면적을 입력해주세요.'
          if (!b.building_structure) return '첫 번째 건물의 구조를 선택해주세요.'
          if (!b.usage) return '첫 번째 건물의 용도를 선택해주세요.'
        }
        // extra fields 중 required인 것 검증 (모든 카테고리 공통)
        {
          const extraSource = isWholeBuilding ? WHOLE_BUILDING_EXTRA_FIELDS : isHouseSale ? HOUSE_SALE_EXTRA_FIELDS : isHouseLease ? HOUSE_LEASE_EXTRA_FIELDS : (catGroup ? EXTRA_FIELDS[catGroup] || [] : [])
          const requiredExtras = extraSource.filter((f) => f.required && f.tab === 'structure')
          for (const fd of requiredExtras) {
            if (!form.extra_info[fd.key as keyof ExtraInfoForm]) return `${fd.label}을(를) 입력해주세요.`
          }
        }
        return null
      }
      case 'detail': {
        // extra fields 중 required인 것 검증
        {
          const extraSource = isWholeBuilding ? WHOLE_BUILDING_EXTRA_FIELDS : isHouseSale ? HOUSE_SALE_EXTRA_FIELDS : isHouseLease ? HOUSE_LEASE_EXTRA_FIELDS : (catGroup ? EXTRA_FIELDS[catGroup] || [] : [])
          const requiredExtras = extraSource.filter((f) => f.required && f.tab === 'detail')
          for (const fd of requiredExtras) {
            if (!form.extra_info[fd.key as keyof ExtraInfoForm]) return `${fd.label}을(를) 입력해주세요.`
          }
        }
        return null
      }
      case 'co-brokerage':
        if (form.is_co_brokerage && !form.co_brokerage_fee_ratio) return '공동중개 수수료 비율을 입력해주세요.'
        return null
      default:
        return null
    }
  }

  const handleNext = () => {
    const error = validateTab(activeTab)
    if (error) { toast.error(error); return }
    const idx = tabs.findIndex((t) => t.id === activeTab)
    if (idx < tabs.length - 1) {
      setIsLoading(false)
      setActiveTab(tabs[idx + 1].id)
    }
  }

  // ─── Area unit helpers ───
  const areaUnit = useAreaUnitStore((s) => s.unit)
  const areaLabel = areaUnit === 'sqm' ? '㎡' : '평'

  const getAreaDisplay = (sqmStr: string): string => {
    if (!sqmStr) return ''
    const sqm = parseFloat(sqmStr)
    if (isNaN(sqm)) return ''
    return areaUnit === 'sqm' ? String(sqm) : String(sqmToPyeong(sqm))
  }

  const setAreaFromDisplay = (key: 'supply_area_m2' | 'exclusive_area_m2', displayVal: string) => {
    if (!displayVal) { set(key, ''); return }
    const num = parseFloat(displayVal)
    if (isNaN(num)) return
    set(key, areaUnit === 'sqm' ? String(num) : String(pyeongToSqm(num)))
  }

  // Area helpers for extra_info fields
  const getExtraAreaDisplay = (key: string): string => {
    const sqmStr = form.extra_info[key as keyof ExtraInfoForm] as string
    if (!sqmStr) return ''
    const sqm = parseFloat(sqmStr)
    if (isNaN(sqm)) return ''
    return areaUnit === 'sqm' ? String(sqm) : String(sqmToPyeong(sqm))
  }

  const setExtraAreaFromDisplay = (key: string, displayVal: string) => {
    if (!displayVal) { setExtra(key, ''); return }
    const num = parseFloat(displayVal)
    if (isNaN(num)) return
    setExtra(key, areaUnit === 'sqm' ? String(num) : String(pyeongToSqm(num)))
  }

  const getExtraAreaConverted = (key: string): string | null => {
    const sqmStr = form.extra_info[key as keyof ExtraInfoForm] as string
    if (!sqmStr) return null
    const sqm = parseFloat(sqmStr)
    if (isNaN(sqm)) return null
    return areaUnit === 'sqm' ? sqmToPyeong(sqm) + '평' : sqm + '㎡'
  }

  const supplyConverted = form.supply_area_m2
    ? (areaUnit === 'sqm' ? sqmToPyeong(parseFloat(form.supply_area_m2)) + '평' : parseFloat(form.supply_area_m2) + '㎡')
    : null
  const exclusiveConverted = form.exclusive_area_m2
    ? (areaUnit === 'sqm' ? sqmToPyeong(parseFloat(form.exclusive_area_m2)) + '평' : parseFloat(form.exclusive_area_m2) + '㎡')
    : null

  // ─── Render extra field ───
  const renderExtraField = (fd: ExtraFieldDef) => {
    const key = fd.key as keyof ExtraInfoForm

    if (fd.type === 'checkbox') {
      return (
        <label key={fd.key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!form.extra_info[key]}
            onChange={(e) => setExtra(fd.key, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600" />
          {fd.label}
        </label>
      )
    }

    const reqMark = fd.required ? <span className="text-red-500"> *</span> : null

    if (fd.type === 'area') {
      const converted = getExtraAreaConverted(fd.key)
      return (
        <div key={fd.key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{fd.label} ({areaLabel}){reqMark}</label>
          <input type="number" step="0.01" min="0" value={getExtraAreaDisplay(fd.key)}
            onChange={(e) => setExtraAreaFromDisplay(fd.key, e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          {converted && <p className="mt-1 text-xs text-gray-400">≈ {converted}</p>}
        </div>
      )
    }

    if (fd.type === 'select') {
      return (
        <div key={fd.key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{fd.label}{reqMark}</label>
          <select value={form.extra_info[key] as string} onChange={(e) => setExtra(fd.key, e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">선택</option>
            {fd.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )
    }

    if (fd.type === 'number') {
      const val = form.extra_info[key] as string
      return (
        <div key={fd.key}>
          <label className="mb-1 block text-sm font-medium text-gray-700">{fd.label}{reqMark}</label>
          <input type="number" step={fd.step || '1'} min="0" value={val} placeholder={fd.placeholder}
            onChange={(e) => setExtra(fd.key, e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          {fd.showPriceHint && val && <p className="mt-1 text-xs text-gray-400">{formatPrice(Number(val))}원</p>}
        </div>
      )
    }

    // text
    return (
      <div key={fd.key}>
        <label className="mb-1 block text-sm font-medium text-gray-700">{fd.label}{reqMark}</label>
        <input type="text" value={form.extra_info[key] as string} placeholder={fd.placeholder}
          onChange={(e) => setExtra(fd.key, e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{isEdit ? '매물 수정' : '매물 등록'}</h1>
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/properties')}>목록</Button>
      </div>

      {/* Tabs */}
      <div className="scrollbar-hide flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setIsLoading(false); setActiveTab(tab.id) }}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        {/* ═══ Basic Info ═══ */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">매물유형 <span className="text-red-500">*</span></label>
                <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">선택하세요</option>
                  {(() => {
                    const filtered = specialties.length > 0
                      ? categories.filter((c) => specialties.some((s) =>
                          c.name === s || c.name.includes(s) || s.includes(c.name)
                          || (s === '공장' && c.name === '공장/창고') || (s === '창고' && c.name === '공장/창고')
                          || (s === '전원주택' && c.name === '주택')
                        ))
                      : []
                    const list = filtered.length > 0 ? filtered : categories
                    return list.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)
                  })()}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">거래유형 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {(['sale', 'jeonse', 'monthly'] as const)
                    .filter((t) => {
                      if (t !== 'jeonse') return true
                      // 전세는 주거형만 (아파트, 오피스텔, 빌라, 주택, 원룸)
                      return !catGroup || catGroup === 'residential'
                    })
                    .map((t) => (
                    <button key={t} type="button" onClick={() => set('transaction_type', t)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${form.transaction_type === t ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {{ sale: '매매', jeonse: '전세', monthly: '월세' }[t]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <Input id="title" label={<>제목 <span className="text-red-500">*</span></>} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="예: 래미안 레이카운티 59㎡" required />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">상태</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value as PropertyStatus)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="draft">매물등록중</option>
                  <option value="active">포털 공개중</option>
                  <option value="hold">보류</option>
                </select>
              </div>
              <div className="flex items-end gap-4 pb-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_urgent} onChange={(e) => set('is_urgent', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" /> 급매 표시</label>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Location ═══ */}
        {activeTab === 'location' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">주소 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input id="address" type="text" value={form.address} readOnly onClick={handleOpenPostcode}
                  placeholder="클릭하여 주소를 검색하세요"
                  className="flex-1 cursor-pointer rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                <button type="button" onClick={handleOpenPostcode}
                  className="shrink-0 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
                  주소 검색
                </button>
              </div>
            </div>
            {/* 공동주택 동/호수 */}
            {(() => {
              const cn = categories.find((c) => c.id === form.category_id)?.name || ''
              const isMultiUnit = ['아파트', '오피스텔', '빌라'].includes(cn)
              return isMultiUnit ? (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={isWholeBuilding}
                      onChange={(e) => {
                        setIsWholeBuilding(e.target.checked)
                        if (e.target.checked) { set('dong', ''); set('ho', '') }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                    전체 (건물 전체 거래)
                  </label>
                  {!isWholeBuilding && (
                    <div className="grid grid-cols-2 gap-4">
                      <Input id="dong" label="동" value={form.dong} onChange={(e) => set('dong', e.target.value)} placeholder="예: 101" />
                      <Input id="ho" label={<>호 <span className="text-red-500">*</span></>} value={form.ho} onChange={(e) => set('ho', e.target.value)} placeholder="예: 502" required />
                    </div>
                  )}
                </div>
              ) : null
            })()}
            <Input id="address_detail" label="상세주소" value={form.address_detail} onChange={(e) => set('address_detail', e.target.value)} placeholder="상세주소" />
            <KakaoMap
              latitude={form.latitude ? parseFloat(form.latitude) : null}
              longitude={form.longitude ? parseFloat(form.longitude) : null}
              onLocationChange={(data) => {
                set('latitude', String(data.latitude))
                set('longitude', String(data.longitude))
                if (!form.address) set('address', data.address)
              }}
            />
            {form.latitude && form.longitude && (
              <p className="text-xs text-gray-400">
                좌표: {parseFloat(form.latitude).toFixed(6)}, {parseFloat(form.longitude).toFixed(6)}
              </p>
            )}
          </div>
        )}

        {/* ═══ Price ═══ */}
        {activeTab === 'price' && (
          <div className="space-y-4">
            {form.transaction_type === 'sale' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {priceOvr?.sale_label || '매매가 (만원)'} <span className="text-red-500">*</span>
                </label>
                <input type="text" value={formatNumber(form.sale_price)} onChange={(e) => set('sale_price', e.target.value.replace(/,/g, ''))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="예: 95,000" />
                {form.sale_price && <p className="mt-1 text-xs text-gray-400">{formatPrice(Number(form.sale_price))}원</p>}
              </div>
            )}
            {(form.transaction_type === 'jeonse' || form.transaction_type === 'monthly') && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{form.transaction_type === 'jeonse' ? '전세금' : '보증금'} (만원) <span className="text-red-500">*</span></label>
                <input type="text" value={formatNumber(form.deposit)} onChange={(e) => set('deposit', e.target.value.replace(/,/g, ''))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="예: 30,000" />
                {form.deposit && <p className="mt-1 text-xs text-gray-400">{formatPrice(Number(form.deposit))}원</p>}
              </div>
            )}
            {form.transaction_type === 'monthly' && (
              catGroup === 'land' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">월세 (만원) <span className="text-red-500">*</span></label>
                    <input type="text" value={formatNumber(form.monthly_rent)} onChange={(e) => set('monthly_rent', e.target.value.replace(/,/g, ''))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="예: 80" />
                    {form.monthly_rent && <p className="mt-1 text-xs text-gray-400">{formatPrice(Number(form.monthly_rent))}원</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">월세 (평당, 원)</label>
                    <input type="text"
                      value={formatNumber(form.extra_info.rent_per_pyeong ?? '')}
                      onChange={(e) => setExtra('rent_per_pyeong', e.target.value.replace(/,/g, ''))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="예: 3,000" />
                    {form.extra_info.rent_per_pyeong && (
                      <p className="mt-1 text-xs text-gray-400">{Number(form.extra_info.rent_per_pyeong).toLocaleString()}원/평</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">월세 (만원) <span className="text-red-500">*</span></label>
                  <input type="text" value={formatNumber(form.monthly_rent)} onChange={(e) => set('monthly_rent', e.target.value.replace(/,/g, ''))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="예: 80" />
                  {form.monthly_rent && <p className="mt-1 text-xs text-gray-400">{formatPrice(Number(form.monthly_rent))}원</p>}
                </div>
              )
            )}
            {(priceOvr?.maintenance_fee !== false) && (
              catGroup === 'commercial' || catGroup === 'office' || catGroup === 'knowledge_center' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">관리비 (만원)</label>
                    <input type="text" value={formatNumber(form.maintenance_fee)} onChange={(e) => set('maintenance_fee', e.target.value.replace(/,/g, ''))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="예: 15" />
                    {form.maintenance_fee && <p className="mt-1 text-xs text-gray-400">{formatPrice(Number(form.maintenance_fee))}원</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">관리비 (평당, 원)</label>
                    <input type="text"
                      value={formatNumber(form.extra_info.maintenance_per_pyeong ?? '')}
                      onChange={(e) => setExtra('maintenance_per_pyeong', e.target.value.replace(/,/g, ''))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="예: 15,000" />
                    {form.extra_info.maintenance_per_pyeong && (
                      <p className="mt-1 text-xs text-gray-400">{Number(form.extra_info.maintenance_per_pyeong).toLocaleString()}원/평</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">관리비 (만원)</label>
                  <input type="text" value={formatNumber(form.maintenance_fee)} onChange={(e) => set('maintenance_fee', e.target.value.replace(/,/g, ''))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="예: 15" />
                  {form.maintenance_fee && <p className="mt-1 text-xs text-gray-400">{formatPrice(Number(form.maintenance_fee))}원</p>}
                </div>
              )
            )}
            {/* Extra price fields (권리금, 프리미엄, 조합원분양가 etc.) */}
            {extraFieldsForTab('price').map(renderExtraField)}
          </div>
        )}

        {/* ═══ Structure ═══ */}
        {activeTab === 'structure' && (
          <div className="space-y-4">
            {/* Area unit toggle — show if any area field is visible */}
            {(structVis?.supply_area !== false || structVis?.exclusive_area !== false || extraFieldsForTab('structure').some((f) => f.type === 'area')) && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">면적 단위</span>
                <AreaUnitToggle />
              </div>
            )}

            {/* Supply / Exclusive area */}
            {(structVis?.supply_area !== false || structVis?.exclusive_area !== false) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {structVis?.supply_area !== false && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">공급면적 ({areaLabel}) <span className="text-red-500">*</span></label>
                    <input type="number" step="0.01" value={getAreaDisplay(form.supply_area_m2)} onChange={(e) => setAreaFromDisplay('supply_area_m2', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
                    {supplyConverted && <p className="mt-1 text-xs text-gray-400">≈ {supplyConverted}</p>}
                  </div>
                )}
                {structVis?.exclusive_area !== false && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">전용면적 ({areaLabel}) <span className="text-red-500">*</span></label>
                    <input type="number" step="0.01" value={getAreaDisplay(form.exclusive_area_m2)} onChange={(e) => setAreaFromDisplay('exclusive_area_m2', e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
                    {exclusiveConverted && <p className="mt-1 text-xs text-gray-400">≈ {exclusiveConverted}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Rooms / Bathrooms / Floor / Total Floors */}
            {(structVis?.rooms !== false || structVis?.bathrooms !== false || structVis?.floor !== false || structVis?.total_floors !== false) && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {structVis?.rooms !== false && <Input id="rooms" label="방" type="number" required value={form.rooms} onChange={(e) => set('rooms', e.target.value)} />}
                {structVis?.bathrooms !== false && <Input id="bathrooms" label="욕실" type="number" required value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />}
                {structVis?.floor !== false && <Input id="floor" label="해당층" type="number" required value={form.floor} onChange={(e) => set('floor', e.target.value)} />}
                {structVis?.total_floors !== false && <Input id="total_floors" label="총층수" type="number" required value={form.total_floors} onChange={(e) => set('total_floors', e.target.value)} />}
              </div>
            )}

            {/* Direction / Built year */}
            {(structVis?.direction !== false || structVis?.built_year !== false) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {structVis?.direction !== false && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">방향 <span className="text-red-500">*</span></label>
                    <select value={form.direction} onChange={(e) => set('direction', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required>
                      <option value="">선택</option>
                      {directionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
                {structVis?.built_year !== false && (
                  <div>
                    <label htmlFor="built_year" className="mb-1 block text-sm font-medium text-gray-700">
                      준공연도 {!isPreConstruction && <span className="text-red-500">*</span>}
                    </label>
                    {!isPreConstruction && (
                      <input id="built_year" type="month" max={new Date().toISOString().slice(0, 7)} value={form.built_year} onChange={(e) => set('built_year', e.target.value)}
                        className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required />
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" checked={isPreConstruction}
                        onChange={(e) => {
                          setIsPreConstruction(e.target.checked)
                          if (e.target.checked) set('built_year', '')
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600" />
                      준공예정
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Extra structure fields */}
            {extraFieldsForTab('structure').length > 0 && (
              <>
                <hr className="border-gray-100" />
                <div className="grid gap-4 sm:grid-cols-2">
                  {extraFieldsForTab('structure').map(renderExtraField)}
                </div>
              </>
            )}

            {/* 공장/창고: 복수 건물 입력 */}
            {catGroup === 'industrial' && (
              <>
                <hr className="border-gray-100" />
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">건물 정보</h4>
                    <button type="button" onClick={addBuilding}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100">
                      + 건물 추가
                    </button>
                  </div>
                  <div className="space-y-4">
                    {form.buildings.map((b, i) => (
                      <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600">건물 {i + 1}</span>
                          {form.buildings.length > 1 && (
                            <button type="button" onClick={() => removeBuilding(i)}
                              className="text-xs text-red-500 hover:text-red-700">삭제</button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">건물명</label>
                            <input type="text" value={b.name} placeholder="예: A동, 공장동"
                              onChange={(e) => setBuilding(i, 'name', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">건물면적 ({areaLabel})</label>
                            <input type="number" step="0.01"
                              value={(() => {
                                const sqm = parseFloat(b.building_area_m2)
                                if (isNaN(sqm) || !b.building_area_m2) return ''
                                return areaUnit === 'sqm' ? String(sqm) : String(sqmToPyeong(sqm))
                              })()}
                              onChange={(e) => {
                                if (!e.target.value) { setBuilding(i, 'building_area_m2', ''); return }
                                const num = parseFloat(e.target.value)
                                if (isNaN(num)) return
                                setBuilding(i, 'building_area_m2', areaUnit === 'sqm' ? String(num) : String(pyeongToSqm(num)))
                              }}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">연면적 ({areaLabel})</label>
                            <input type="number" step="0.01"
                              value={(() => {
                                const sqm = parseFloat(b.gross_floor_area_m2)
                                if (isNaN(sqm) || !b.gross_floor_area_m2) return ''
                                return areaUnit === 'sqm' ? String(sqm) : String(sqmToPyeong(sqm))
                              })()}
                              onChange={(e) => {
                                if (!e.target.value) { setBuilding(i, 'gross_floor_area_m2', ''); return }
                                const num = parseFloat(e.target.value)
                                if (isNaN(num)) return
                                setBuilding(i, 'gross_floor_area_m2', areaUnit === 'sqm' ? String(num) : String(pyeongToSqm(num)))
                              }}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">층고 (m)</label>
                            <input type="number" step="0.1" min="0" value={b.ceiling_height} placeholder="예: 8.0"
                              onChange={(e) => setBuilding(i, 'ceiling_height', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">건물구조</label>
                            <select value={b.building_structure} onChange={(e) => setBuilding(i, 'building_structure', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                              <option value="">선택</option>
                              {BUILDING_STRUCTURE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">층수</label>
                            <input type="number" value={b.floors} placeholder="예: 2"
                              onChange={(e) => setBuilding(i, 'floors', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">준공연도</label>
                            <input type="month" value={b.built_year}
                              onChange={(e) => setBuilding(i, 'built_year', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">용도</label>
                            <select value={b.usage} onChange={(e) => setBuilding(i, 'usage', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                              <option value="">선택</option>
                              {BUILDING_USAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 총 건물면적 합산 표시 */}
                  {form.buildings.some((b) => b.building_area_m2) && (
                    <p className="mt-2 text-xs text-gray-500">
                      총 건물면적: {(() => {
                        const totalSqm = form.buildings.reduce((sum, b) => sum + (parseFloat(b.building_area_m2) || 0), 0)
                        return areaUnit === 'sqm'
                          ? `${totalSqm.toFixed(2)}㎡ (≈ ${sqmToPyeong(totalSqm).toFixed(2)}평)`
                          : `${sqmToPyeong(totalSqm).toFixed(2)}평 (≈ ${totalSqm.toFixed(2)}㎡)`
                      })()}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Hint when no category selected */}
            {!catGroup && (
              <p className="text-center text-sm text-gray-400">기본정보 탭에서 매물유형을 선택하면 해당 유형에 맞는 항목이 표시됩니다.</p>
            )}
          </div>
        )}

        {/* ═══ Detail ═══ */}
        {activeTab === 'detail' && (
          <div className="space-y-4">
            {detailVis?.move_in_date !== false && (
              <Input id="move_in_date" label="입주가능일" type="date" min={new Date().toISOString().slice(0, 10)} value={form.move_in_date} onChange={(e) => set('move_in_date', e.target.value)} />
            )}
            {detailVis?.parking !== false && (
              <Input id="parking" label="주차 (대/세대)" type="number" step="0.1" value={form.parking_per_unit} onChange={(e) => set('parking_per_unit', e.target.value)} />
            )}
            {(detailVis?.elevator !== false || detailVis?.pets !== false) && (
              <div className="flex gap-6">
                {detailVis?.elevator !== false && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.has_elevator} onChange={(e) => set('has_elevator', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" /> 엘리베이터</label>
                )}
                {detailVis?.pets !== false && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.pets_allowed} onChange={(e) => set('pets_allowed', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" /> 반려동물 허용</label>
                )}
              </div>
            )}

            {/* Extra detail fields (non-checkbox) */}
            {extraFieldsForTab('detail').filter((f) => f.type !== 'checkbox').length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {extraFieldsForTab('detail').filter((f) => f.type !== 'checkbox').map(renderExtraField)}
              </div>
            )}

            {/* Extra detail fields (checkbox) */}
            {extraFieldsForTab('detail').filter((f) => f.type === 'checkbox').length > 0 && (
              <div className="flex flex-wrap gap-6">
                {extraFieldsForTab('detail').filter((f) => f.type === 'checkbox').map(renderExtraField)}
              </div>
            )}

            {/* Options */}
            {detailVis?.options !== false && optionChoices.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">옵션</label>
                <div className="flex flex-wrap gap-2">
                  {optionChoices.map((opt) => (
                    <button key={opt} type="button" onClick={() => handleToggleOption(opt)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${form.options.includes(opt) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {(visibleTagConditions.length > 0 || visibleCustomTags.length > 0) && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">빠른 검색 태그</label>
                <p className="mb-2 text-xs text-gray-400">선택한 태그가 홈페이지 원클릭 검색에 연동됩니다</p>
                <div className="flex flex-wrap gap-2">
                  {visibleTagConditions.map((tc) => (
                    <button key={tc.conditionKey} type="button" onClick={() => handleTogglePredefinedTag(tc.tag)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        form.predefinedTags.includes(tc.tag)
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>{tc.tag}</button>
                  ))}
                  {visibleCustomTags.map((label) => (
                    <button key={label} type="button" onClick={() => handleTogglePredefinedTag(label)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        form.predefinedTags.includes(label)
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            <Input id="tags" label="커스텀 태그 (쉼표 구분)" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="예: 신축, 올수리, 풀옵션" />

            {/* Hint */}
            {!catGroup && (
              <p className="text-center text-sm text-gray-400">기본정보 탭에서 매물유형을 선택하면 해당 유형에 맞는 항목이 표시됩니다.</p>
            )}
          </div>
        )}

        {/* ═══ Media ═══ */}
        {activeTab === 'media' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">사진 ({form.photos.length}/20)</label>
              {uploading && <span className="text-xs text-primary-600">업로드 중...</span>}
            </div>
            {form.photos.length < 20 && (
              <div
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <p className="text-sm text-gray-500">클릭 또는 드래그하여 사진 업로드</p>
                <p className="mt-1 text-xs text-gray-400">JPG, PNG (최대 10MB, 최대 20장)</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" multiple className="hidden"
                  onChange={(e) => { if (e.target.files) handleFiles(Array.from(e.target.files)); e.target.value = '' }} />
              </div>
            )}
            {form.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {form.photos.map((url, i) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">대표</span>}
                    {i !== 0 && <span className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">{i + 1}</span>}
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {i !== 0 && <button type="button" onClick={() => handleSetPrimary(i)} title="대표 설정" className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-white">★</button>}
                      {i > 0 && <button type="button" onClick={() => handleMovePhoto(i, -1)} title="왼쪽으로" className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-white">←</button>}
                      {i < form.photos.length - 1 && <button type="button" onClick={() => handleMovePhoto(i, 1)} title="오른쪽으로" className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-white">→</button>}
                      <button type="button" onClick={() => handleDeletePhoto(i)} title="삭제" className="rounded bg-red-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-red-600">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Description ═══ */}
        {activeTab === 'description' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">매물 설명</label>
              <button type="button" onClick={handleAIDescription} disabled={aiGenerating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50">
                {aiGenerating ? (
                  <><span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-300 border-t-primary-600" /> 생성 중...</>
                ) : '🤖 AI 자동 생성'}
              </button>
            </div>
            {form.description && <p className="text-xs text-gray-400">AI 생성 후 직접 수정할 수 있습니다.</p>}
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={8}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="매물의 장점, 특징, 주변 환경 등을 자유롭게 작성하세요" />
          </div>
        )}

        {/* ═══ Co-brokerage ═══ */}
        {activeTab === 'co-brokerage' && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_co_brokerage} onChange={(e) => set('is_co_brokerage', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary-600" />
              <span className="font-medium">공동중개 허용</span>
            </label>
            {form.is_co_brokerage && (
              <Input id="co_ratio" label={<>공동중개 수수료 비율 (%) <span className="text-red-500">*</span></>} type="number" step="0.1" value={form.co_brokerage_fee_ratio} onChange={(e) => set('co_brokerage_fee_ratio', e.target.value)} placeholder="예: 50" />
            )}
          </div>
        )}

        {/* ═══ Internal Memo ═══ */}
        {activeTab === 'memo' && (
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-700">내부 메모 (고객에게 비공개)</label>
            <textarea value={form.internal_memo} onChange={(e) => set('internal_memo', e.target.value)} rows={6}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="매물 관련 내부 메모를 작성하세요 (집주인 연락처, 키 보관 장소 등)" />
          </div>
        )}

        {/* ═══ Actions ═══ */}
        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <div>
            {activeTab !== tabs[0].id && (
              <Button type="button" variant="outline" onClick={() => {
                const idx = tabs.findIndex((t) => t.id === activeTab)
                if (idx > 0) setActiveTab(tabs[idx - 1].id)
              }}>← 이전</Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => { if (confirm('작성 중인 내용이 모두 사라집니다. 취소하시겠습니까?')) navigate('/admin/properties') }}>취소</Button>
            {activeTab !== tabs[tabs.length - 1].id && (
              <Button type="button" onClick={handleNext}>다음 →</Button>
            )}
            {!isEdit && activeTab === tabs[tabs.length - 1].id && (
              <Button type="button" isLoading={isLoading} onClick={handleSubmit}>매물 등록</Button>
            )}
          </div>
        </div>

        {/* 수정 모드: 하단 수정 완료 버튼 */}
        {isEdit && (
          <div className="mt-4 flex justify-end border-t border-gray-200 pt-4">
            <Button type="button" isLoading={isLoading} onClick={handleSubmit} className="px-6 py-2.5 text-base">수정 완료</Button>
          </div>
        )}
      </form>
    </div>
  )
}
