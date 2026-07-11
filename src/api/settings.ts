import { supabase, supabaseAuth } from '@/api/supabase'
import { getAgentProfileId } from '@/api/helpers'
import type { AgentProfile, AgentFeatureSetting, StaffMember, PropertyCategory, StaffRole, PlanType } from '@/types/database'

// ──────────────────────────────────────────
// Office Settings (agent_profiles table)
// ──────────────────────────────────────────

export type BusinessHours = {
  [day: string]: { open: string; close: string; isOpen: boolean }
}

export async function fetchOfficeSettings(): Promise<AgentProfile> {
  const agentId = await getAgentProfileId()
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('*')
    .eq('id', agentId)
    .single()

  if (error) throw error
  return data
}

export async function updateOfficeSettings(data: Partial<AgentProfile>): Promise<AgentProfile> {
  const agentId = await getAgentProfileId()
  const { data: updated, error } = await supabase
    .from('agent_profiles')
    .update(data)
    .eq('id', agentId)
    .select()
    .single()

  if (error) throw error
  return updated
}

/** Public: fetch agent specialties for the user portal hero section.
 *  When agentId is provided, fetches that specific agent's specialties. */
export async function fetchAgentSpecialties(agentId?: string): Promise<string[]> {
  let query = supabase
    .from('agent_profiles')
    .select('specialties')

  if (agentId) {
    query = query.eq('id', agentId)
  }

  const { data, error } = await query.limit(1).maybeSingle()

  if (error || !data) return []
  return (data.specialties as string[]) ?? []
}

// ──────────────────────────────────────────
// Staff Management (staff_members + users tables)
// ──────────────────────────────────────────

export type StaffWithUser = StaffMember & {
  display_name: string
  email: string
  phone: string | null
  last_login: string | null
}

export async function fetchStaffList(): Promise<StaffWithUser[]> {
  const agentId = await getAgentProfileId()
  const { data, error } = await supabase
    .from('staff_members')
    .select('*, users!inner(display_name, email, phone)')
    .eq('agent_profile_id', agentId)

  if (error) throw error

  return (data ?? []).map((s) => {
    const user = s.users as unknown as { display_name: string; email: string; phone: string | null }
    return {
      id: s.id,
      agent_profile_id: s.agent_profile_id,
      user_id: s.user_id,
      role: s.role,
      permissions: s.permissions,
      is_active: s.is_active,
      created_at: s.created_at,
      display_name: user.display_name,
      email: user.email,
      phone: user.phone,
      last_login: null, // Supabase Auth doesn't expose this easily
    }
  })
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function fetchInviteCode(): Promise<string> {
  const agentId = await getAgentProfileId()
  const { data, error } = await supabase
    .from('agent_profiles')
    .select('invite_code')
    .eq('id', agentId)
    .single()

  if (error) throw error
  if (data?.invite_code) return data.invite_code

  // 코드가 없으면 자동 생성
  return regenerateInviteCode()
}

export async function regenerateInviteCode(): Promise<string> {
  const agentId = await getAgentProfileId()
  const code = generateCode()
  const { error } = await supabase
    .from('agent_profiles')
    .update({ invite_code: code })
    .eq('id', agentId)

  if (error) throw error
  return code
}

export async function updateStaffRole(staffId: string, role: StaffRole): Promise<void> {
  const { error } = await supabase
    .from('staff_members')
    .update({ role })
    .eq('id', staffId)

  if (error) throw error
}

export async function updateStaffPermissions(staffId: string, permissions: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('staff_members')
    .update({ permissions })
    .eq('id', staffId)

  if (error) throw error
}

export async function toggleStaffActive(staffId: string): Promise<void> {
  // Fetch current state
  const { data: staff, error: fetchError } = await supabase
    .from('staff_members')
    .select('is_active')
    .eq('id', staffId)
    .single()

  if (fetchError) throw fetchError

  const { error } = await supabase
    .from('staff_members')
    .update({ is_active: !staff.is_active })
    .eq('id', staffId)

  if (error) throw error
}

export async function deleteStaff(staffId: string): Promise<void> {
  const { error } = await supabase
    .from('staff_members')
    .delete()
    .eq('id', staffId)

  if (error) throw error
}

// ──────────────────────────────────────────
// Feature Settings (agent_feature_settings table)
// ──────────────────────────────────────────

export type FeatureGroup = {
  key: string
  label: string
  icon: string
  features: FeatureDefinition[]
}

export type FeatureDefinition = {
  key: string
  label: string
  description: string
  is_enabled: boolean
  is_locked: boolean
  is_pro: boolean
  gemini?: boolean
}

// Static feature group definitions (metadata only)
const featureGroupDefs: FeatureGroup[] = [
  {
    key: 'core', label: '핵심업무', icon: '🔒',
    features: [
      { key: 'properties', label: '매물관리', description: '매물 등록, 수정, 삭제 및 상태 관리', is_enabled: true, is_locked: true, is_pro: false },
      { key: 'contracts', label: '계약서/확인설명서', description: '계약서 작성, 양식 관리, 확인설명서 자동 생성', is_enabled: true, is_locked: true, is_pro: false },
      { key: 'crm', label: '기본CRM', description: '고객 관리, 파이프라인, 활동 기록', is_enabled: true, is_locked: true, is_pro: false },
      { key: 'inquiries', label: '문의관리', description: '문의 접수, 답변, 상태 관리', is_enabled: true, is_locked: true, is_pro: false },
      { key: 'contract_tracker', label: '계약트래커', description: '계약 진행 단계 추적, D-Day, 필요서류', is_enabled: true, is_locked: true, is_pro: false },
      { key: 'basic_valuation', label: '기본시세', description: '시세 조회, 가격 동향 차트', is_enabled: true, is_locked: true, is_pro: false },
    ],
  },
  {
    key: 'ai', label: 'AI 도구', icon: '🤖',
    features: [
      { key: 'ai_description', label: 'AI매물설명', description: '플랫폼별 맞춤 매물 설명글 자동 생성', is_enabled: true, is_locked: false, is_pro: false, gemini: true },
      { key: 'ai_legal_review', label: 'AI법률검토', description: '계약서 법률 검토 및 위험 요소 분석', is_enabled: true, is_locked: false, is_pro: false, gemini: true },
      { key: 'ai_customer_analysis', label: 'AI고객성향', description: '고객 행동 분석, 진성도 평가, 전환 예측', is_enabled: true, is_locked: false, is_pro: false, gemini: true },
      { key: 'ai_chatbot', label: 'AI챗봇', description: '사용자 포털 AI 상담 챗봇', is_enabled: true, is_locked: false, is_pro: false, gemini: true },
      { key: 'ai_staging', label: 'AI가상스테이징', description: 'AI로 매물 사진 가상 인테리어 적용', is_enabled: false, is_locked: false, is_pro: true, gemini: true },
      { key: 'ai_reply_draft', label: 'AI답변초안', description: '문의에 대한 AI 답변 초안 생성', is_enabled: true, is_locked: false, is_pro: false, gemini: true },
    ],
  },
  {
    key: 'marketing', label: '마케팅&분석', icon: '📊',
    features: [
      { key: 'sns_posting', label: 'SNS포스팅', description: '플랫폼별 매물 홍보글 자동 생성', is_enabled: false, is_locked: false, is_pro: true },
      { key: 'avm', label: 'AVM', description: '자동 가치 평가 모델 기반 시세 분석', is_enabled: true, is_locked: false, is_pro: false },
      { key: 'location_report', label: '입지리포트', description: '교통, 학군, 편의시설 등 입지 분석', is_enabled: true, is_locked: false, is_pro: false },
      { key: 'roi_calculator', label: '수익률계산기', description: 'ROI, Cap Rate, 월별 현금흐름 계산', is_enabled: true, is_locked: false, is_pro: false },
      { key: 'buy_sell_signal', label: '매수매도신호등', description: '시장 지표 기반 매수/관망/매도 신호', is_enabled: true, is_locked: false, is_pro: false },
    ],
  },
  {
    key: 'customer_service', label: '고객서비스', icon: '👥',
    features: [
      { key: 'curation_alimtalk', label: '큐레이션&알림톡', description: '맞춤 매물 추천 및 카카오 알림톡 발송', is_enabled: false, is_locked: false, is_pro: true },
      { key: 'scoring', label: '스코어링', description: '고객 행동 기반 자동 점수 부여', is_enabled: true, is_locked: false, is_pro: false },
      { key: 'sincerity_analysis', label: '진성분석(AI)', description: 'AI 기반 고객 진성도 분석', is_enabled: true, is_locked: false, is_pro: false, gemini: true },
      { key: 'realtime_chat', label: '실시간채팅', description: '고객과 실시간 채팅 상담', is_enabled: false, is_locked: false, is_pro: true },
      { key: 'inspection_booking', label: '임장예약', description: '고객 임장 예약 접수 및 관리', is_enabled: false, is_locked: false, is_pro: false },
      { key: 'move_in_guide', label: '전입가이드', description: '임대차 계약 전입 절차 안내 생성', is_enabled: true, is_locked: false, is_pro: false },
    ],
  },
  {
    key: 'field', label: '현장&관리', icon: '📋',
    features: [
      { key: 'inspection', label: '임장체크리스트', description: '현장 점검 체크리스트 및 보고서', is_enabled: true, is_locked: false, is_pro: false },
      { key: 'rental_mgmt', label: '임대관리서비스', description: '임대 물건, 월세 수납, 수리 요청 관리', is_enabled: true, is_locked: false, is_pro: false },
    ],
  },
  {
    key: 'legal', label: '법률&행정', icon: '⚖️',
    features: [
      { key: 'registry', label: '등기부등본', description: '등기부등본 PDF 보관 및 관리', is_enabled: true, is_locked: false, is_pro: false },
      // e_signature(전자서명)는 카카오/네이버 연동 출시 전까지 기능 목록에서 제외
    ],
  },
  {
    key: 'collaboration', label: '협업', icon: '🤝',
    features: [
      { key: 'co_brokerage', label: '공동중개', description: '매물 공유 풀 및 공동중개 요청 관리', is_enabled: true, is_locked: false, is_pro: false },
    ],
  },
  {
    key: 'floating', label: '플로팅버튼', icon: '💬',
    features: [
      { key: 'fab_kakao', label: '카카오상담', description: '카카오톡 채널 상담 연결', is_enabled: true, is_locked: false, is_pro: false },
      { key: 'fab_naver', label: '네이버예약', description: '네이버 예약 연결', is_enabled: false, is_locked: false, is_pro: false },
      { key: 'fab_phone', label: '전화상담', description: '사무소 대표번호 연결', is_enabled: true, is_locked: false, is_pro: false },
      { key: 'fab_inquiry', label: '문의하기', description: '빠른 문의 접수', is_enabled: true, is_locked: false, is_pro: false },
    ],
  },
]

export async function fetchFeatureGroups(): Promise<FeatureGroup[]> {
  const agentId = await getAgentProfileId()
  const { data: settings, error } = await supabase
    .from('agent_feature_settings')
    .select('*')
    .eq('agent_id', agentId)

  if (error) throw error

  // Merge DB settings into static definitions
  return featureGroupDefs.map((g) => ({
    ...g,
    features: g.features.map((f) => {
      const setting = settings?.find((s) => s.feature_key === f.key)
      return {
        ...f,
        is_enabled: setting?.is_enabled ?? f.is_enabled,
      }
    }),
  }))
}

export async function toggleFeature(featureKey: string, enabled: boolean): Promise<void> {
  const agentId = await getAgentProfileId()

  const { error } = await supabase
    .from('agent_feature_settings')
    .upsert(
      { agent_id: agentId, feature_key: featureKey, is_enabled: enabled },
      { onConflict: 'agent_id,feature_key' },
    )

  if (error) throw error
}

export async function fetchFeatureSettings(): Promise<AgentFeatureSetting[]> {
  const agentId = await getAgentProfileId()
  const { data, error } = await supabase
    .from('agent_feature_settings')
    .select('*')
    .eq('agent_id', agentId)

  if (error) throw error
  return data ?? []
}

// ──────────────────────────────────────────
// Category Settings (property_categories table)
// ──────────────────────────────────────────

export async function fetchSettingsCategories(): Promise<PropertyCategory[]> {
  const { data, error } = await supabase
    .from('property_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function toggleCategory(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('property_categories')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) throw error
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  // Update sort_order for each category
  const updates = orderedIds.map((id, i) =>
    supabase
      .from('property_categories')
      .update({ sort_order: i + 1 })
      .eq('id', id),
  )
  await Promise.all(updates)
}

export async function addCustomCategory(data: { name: string; icon: string; color: string }): Promise<PropertyCategory> {
  const agentId = await getAgentProfileId()

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from('property_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = (maxRow?.sort_order ?? 0) + 1

  const { data: cat, error } = await supabase
    .from('property_categories')
    .insert({
      agent_id: agentId,
      name: data.name,
      icon: data.icon,
      color: data.color,
      sort_order: nextOrder,
      is_system: false,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return cat
}

// ──────────────────────────────────────────
// JSONB Settings (agent_settings table)
// ──────────────────────────────────────────

async function fetchAgentSetting<T>(settingKey: string, defaultValue: T): Promise<T> {
  const agentId = await getAgentProfileId()
  const { data, error } = await supabase
    .from('agent_settings')
    .select('setting_value')
    .eq('agent_id', agentId)
    .eq('setting_key', settingKey)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return defaultValue
    throw error
  }
  return data.setting_value as T
}

async function upsertAgentSetting(settingKey: string, value: Record<string, unknown>): Promise<void> {
  const agentId = await getAgentProfileId()

  // Try UPDATE first (avoids silent RLS failure with upsert)
  const { data, error: updateError } = await supabase
    .from('agent_settings')
    .update({ setting_value: value })
    .eq('agent_id', agentId)
    .eq('setting_key', settingKey)
    .select('id')

  if (updateError) throw updateError
  if (data && data.length > 0) return

  // Row doesn't exist — INSERT
  const { error: insertError } = await supabase
    .from('agent_settings')
    .insert({ agent_id: agentId, setting_key: settingKey, setting_value: value })

  if (insertError) throw insertError
}

// ──────────────────────────────────────────
// Region Settings (지역별 인기매물)
// ──────────────────────────────────────────

export type RegionSetting = {
  name: string     // "오송읍", "세종시", "청주시 흥덕구"
  nameEn?: string  // "Oseong", "Sejong" — 지도 카드에 표시 (선택)
}

export async function fetchRegionSettings(): Promise<RegionSetting[]> {
  return fetchAgentSetting<RegionSetting[]>('regions', [])
}

export async function updateRegionSettings(regions: RegionSetting[]): Promise<void> {
  await upsertAgentSetting('regions', regions as unknown as Record<string, unknown>)
}

/** Public: fetch region settings for the user portal.
 *  When agentId is provided, fetches that specific agent's regions.
 *  Tries authenticated path first (RLS), falls back to public read. */
export async function fetchPublicRegionSettings(agentId?: string): Promise<RegionSetting[]> {
  // Try authenticated fetch first (works if user is logged in as agent/staff)
  try {
    const regions = await fetchRegionSettings()
    if (regions.length > 0) return regions
  } catch { /* not logged in or not agent — fall through */ }

  // Public read (requires public RLS policy on agent_settings)
  let query = supabase
    .from('agent_settings')
    .select('setting_value')
    .eq('setting_key', 'regions')

  if (agentId) {
    query = query.eq('agent_id', agentId)
  }

  const { data, error } = await query.limit(1).maybeSingle()

  if (error || !data) return []
  const value = data.setting_value
  if (Array.isArray(value)) return value as RegionSetting[]
  return []
}

/** Public: fetch floating button settings for the user portal.
 *  When agentId is provided, fetches that specific agent's floating config. */
export async function fetchPublicFloatingSettings(agentId?: string): Promise<FloatingSettings> {
  // If agentId provided, use public read path
  if (agentId) {
    const { data, error } = await supabase
      .from('agent_settings')
      .select('setting_value')
      .eq('agent_id', agentId)
      .eq('setting_key', 'floating')
      .limit(1)
      .maybeSingle()

    if (error || !data) return defaultFloatingSettings
    return data.setting_value as FloatingSettings
  }

  // Fallback: authenticated fetch
  return fetchFloatingSettings()
}

// ──────────────────────────────────────────
// Search Settings
// ──────────────────────────────────────────

export type SearchFilterGroup = {
  key: string
  label: string
  is_enabled: boolean
  sort_order: number
  categories?: string[]
}

export type QuickSearchCard = {
  key: string
  label: string
  icon: string
  is_enabled: boolean
  sort_order: number
  conditions: Record<string, unknown>
  categories?: string[]
  is_custom?: boolean
  description?: string
}

export type SearchSettings = {
  filter_groups: SearchFilterGroup[]
  quick_cards: QuickSearchCard[]
  default_sort: string
  items_per_page: number
  default_view: 'grid' | 'list'
  map_center: { lat: number; lng: number }
  map_zoom: number
}

const RESIDENTIAL = ['아파트', '오피스텔', '빌라', '주택', '원룸']
const COMMERCIAL = ['상가', '사무실']

export const defaultSearchSettings: SearchSettings = {
  filter_groups: [
    { key: 'transaction_type', label: '거래방식', is_enabled: true, sort_order: 1 },
    { key: 'price', label: '금액별', is_enabled: true, sort_order: 2 },
    { key: 'area', label: '면적별', is_enabled: true, sort_order: 3, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'rooms', label: '방수별', is_enabled: true, sort_order: 4, categories: RESIDENTIAL },
    { key: 'floor', label: '층수별', is_enabled: true, sort_order: 5, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'direction', label: '방향별', is_enabled: false, sort_order: 6, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'built_year', label: '건축년도별', is_enabled: false, sort_order: 7, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'large_area', label: '대형면적', is_enabled: true, sort_order: 8, categories: ['공장/창고', '토지'] },
    { key: 'ceiling_height', label: '층고', is_enabled: true, sort_order: 9, categories: ['공장/창고'] },
    { key: 'power_capacity', label: '전력용량', is_enabled: true, sort_order: 10, categories: ['공장/창고'] },
    { key: 'land_type', label: '지목', is_enabled: true, sort_order: 11, categories: ['토지'] },
    { key: 'zoning', label: '용도지역', is_enabled: true, sort_order: 12, categories: ['토지', '공장/창고'] },
    { key: 'road_frontage', label: '접도', is_enabled: true, sort_order: 13, categories: ['공장/창고', '토지'] },
  ],
  quick_cards: [
    { key: 'new_built', label: '신축 매물', icon: '🆕', is_enabled: true, sort_order: 1, conditions: { built_within_years: 3 }, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'station_near', label: '역세권', icon: '🚇', is_enabled: true, sort_order: 2, conditions: { walk_minutes: 10 }, categories: [...RESIDENTIAL, ...COMMERCIAL, '토지'] },
    { key: 'school_near', label: '학세권', icon: '🏫', is_enabled: true, sort_order: 3, conditions: { school_walk_minutes: 10 }, categories: RESIDENTIAL },
    { key: 'park_near', label: '공세권', icon: '🌳', is_enabled: true, sort_order: 4, conditions: { park_walk_minutes: 10 }, categories: [...RESIDENTIAL, ...COMMERCIAL, '토지'] },
    { key: 'pet_friendly', label: '반려동물', icon: '🐕', is_enabled: true, sort_order: 5, conditions: { pets_allowed: true }, categories: RESIDENTIAL },
    { key: 'parking', label: '주차 편리', icon: '🅿️', is_enabled: true, sort_order: 6, conditions: { parking_per_unit: 1 }, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'low_maintenance', label: '관리비 저렴', icon: '💰', is_enabled: true, sort_order: 7, conditions: { max_maintenance: 15 }, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'rooftop', label: '탑층', icon: '🌤️', is_enabled: true, sort_order: 8, conditions: { is_top_floor: true }, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'south_facing', label: '남향', icon: '☀️', is_enabled: true, sort_order: 9, conditions: { direction: '남향' }, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'elevator', label: '엘리베이터', icon: '🛗', is_enabled: true, sort_order: 10, conditions: { has_elevator: true }, categories: [...RESIDENTIAL, ...COMMERCIAL] },
    { key: 'urgent', label: '급매물', icon: '🔥', is_enabled: true, sort_order: 11, conditions: { is_urgent: true } },
    { key: 'move_in_now', label: '즉시입주', icon: '📅', is_enabled: false, sort_order: 12, conditions: { move_in_immediate: true } },
    { key: 'wide_yard', label: '넓은 마당', icon: '🏞️', is_enabled: true, sort_order: 13, conditions: { wide_yard: true }, categories: ['공장/창고'] },
    { key: 'private_yard', label: '단독 마당', icon: '🏡', is_enabled: true, sort_order: 14, conditions: { private_yard: true }, categories: ['공장/창고'] },
    { key: 'hoist', label: '호이스트', icon: '🏗️', is_enabled: true, sort_order: 15, conditions: { hoist: true }, categories: ['공장/창고'] },
    { key: 'food_factory', label: '식품공장 가능', icon: '🍽️', is_enabled: true, sort_order: 16, conditions: { food_factory: true }, categories: ['공장/창고'] },
    { key: 'temporary_building', label: '가설 건축물', icon: '🏚️', is_enabled: true, sort_order: 17, conditions: { temporary_building: true }, categories: ['공장/창고'] },
    { key: 'has_office', label: '사무실', icon: '🏢', is_enabled: true, sort_order: 18, conditions: { has_office: true }, categories: ['공장/창고'] },
    { key: 'has_dormitory', label: '기숙사', icon: '🛏️', is_enabled: true, sort_order: 19, conditions: { has_dormitory: true }, categories: ['공장/창고'] },
    { key: 'developable', label: '개발가능', icon: '🏗️', is_enabled: true, sort_order: 20, conditions: { developable: true }, categories: ['토지'] },
    { key: 'road_facing', label: '도로접면', icon: '🛣️', is_enabled: true, sort_order: 21, conditions: { road_frontage_min: 8 }, categories: ['토지'] },
    { key: 'flat_land', label: '평탄지', icon: '🏞️', is_enabled: true, sort_order: 22, conditions: { max_slope: 5 }, categories: ['토지'] },
    { key: 'good_road', label: '접도양호', icon: '🛤️', is_enabled: true, sort_order: 23, conditions: { good_road: true }, categories: ['토지'] },
  ],
  default_sort: 'newest',
  items_per_page: 12,
  default_view: 'grid',
  map_center: { lat: 37.5665, lng: 126.978 },
  map_zoom: 14,
}

export async function fetchSearchSettings(): Promise<SearchSettings> {
  return fetchAgentSetting('search', defaultSearchSettings)
}

export async function updateSearchSettings(data: Partial<SearchSettings>): Promise<void> {
  const current = await fetchSearchSettings()
  await upsertAgentSetting('search', { ...current, ...data } as unknown as Record<string, unknown>)
}

// ──────────────────────────────────────────
// Unit Settings
// ──────────────────────────────────────────

export type UnitSettings = {
  area_unit: 'sqm' | 'pyeong'
  area_dual_display: boolean
  price_unit: 'man' | 'eok'
  price_auto_convert: boolean
  price_separator: boolean
  distance_unit: 'm' | 'km'
  date_format: 'YYYY.MM.DD' | 'YYYY-MM-DD' | 'MM/DD/YYYY'
  time_format: '24h' | '12h'
}

const defaultUnitSettings: UnitSettings = {
  area_unit: 'sqm',
  area_dual_display: true,
  price_unit: 'man',
  price_auto_convert: true,
  price_separator: true,
  distance_unit: 'm',
  date_format: 'YYYY.MM.DD',
  time_format: '24h',
}

export async function fetchUnitSettings(): Promise<UnitSettings> {
  return fetchAgentSetting('unit', defaultUnitSettings)
}

export async function updateUnitSettings(data: Partial<UnitSettings>): Promise<void> {
  const current = await fetchUnitSettings()
  await upsertAgentSetting('unit', { ...current, ...data } as unknown as Record<string, unknown>)
}

// ──────────────────────────────────────────
// Floating Button Settings
// ──────────────────────────────────────────

export type FloatingButtonConfig = {
  key: string
  label: string
  icon: string
  is_enabled: boolean
  sort_order: number
  url?: string
  phone?: string
}

export type FloatingSettings = {
  buttons: FloatingButtonConfig[]
  fab_color: string
}

const defaultFloatingSettings: FloatingSettings = {
  buttons: [
    { key: 'kakao', label: '카카오상담', icon: '💬', is_enabled: true, sort_order: 1, url: 'https://pf.kakao.com/_example' },
    { key: 'naver', label: '네이버예약', icon: '📗', is_enabled: false, sort_order: 2, url: '' },
    { key: 'phone', label: '전화상담', icon: '📞', is_enabled: true, sort_order: 3, phone: '02-1234-5678' },
    { key: 'inquiry', label: '문의하기', icon: '✉️', is_enabled: true, sort_order: 4 },
  ],
  fab_color: '#4F46E5',
}

export async function fetchFloatingSettings(): Promise<FloatingSettings> {
  return fetchAgentSetting('floating', defaultFloatingSettings)
}

export async function updateFloatingSettings(data: Partial<FloatingSettings>): Promise<void> {
  const current = await fetchFloatingSettings()
  await upsertAgentSetting('floating', { ...current, ...data } as unknown as Record<string, unknown>)
}

// ──────────────────────────────────────────
// Notification Settings
// ──────────────────────────────────────────

export type NotificationChannel = 'push' | 'email' | 'alimtalk'
export type NotificationType = 'inquiry' | 'inspection' | 'contract_schedule' | 'registry_change' | 'co_brokerage' | 'view_count' | 'market_change'

export type NotificationSetting = {
  type: NotificationType
  label: string
  channels: Record<NotificationChannel, boolean>
}

const defaultNotificationSettings: NotificationSetting[] = [
  { type: 'inquiry', label: '문의 접수', channels: { push: true, email: true, alimtalk: false } },
  { type: 'inspection', label: '임장 예약', channels: { push: true, email: false, alimtalk: false } },
  { type: 'contract_schedule', label: '계약 일정', channels: { push: true, email: true, alimtalk: true } },
  { type: 'registry_change', label: '등기 변동', channels: { push: true, email: true, alimtalk: false } },
  { type: 'co_brokerage', label: '공동중개', channels: { push: true, email: false, alimtalk: false } },
  { type: 'view_count', label: '조회수 알림', channels: { push: false, email: false, alimtalk: false } },
  { type: 'market_change', label: '시세 변동', channels: { push: false, email: true, alimtalk: false } },
]

export async function fetchNotificationSettings(): Promise<NotificationSetting[]> {
  return fetchAgentSetting('notifications', defaultNotificationSettings)
}

export async function updateNotificationSetting(type: NotificationType, channel: NotificationChannel, enabled: boolean): Promise<void> {
  const current = await fetchNotificationSettings()
  const updated = current.map((s) =>
    s.type === type ? { ...s, channels: { ...s.channels, [channel]: enabled } } : s,
  )
  await upsertAgentSetting('notifications', { value: updated } as unknown as Record<string, unknown>)
}

// ──────────────────────────────────────────
// Integration Settings
// ──────────────────────────────────────────

export type IntegrationConfig = {
  key: string
  label: string
  icon: string
  category: string
  is_connected: boolean
  url?: string
  account_id?: string
}

const defaultIntegrations: IntegrationConfig[] = [
  { key: 'kakao_channel', label: '카카오톡채널', icon: '💬', category: '메시징', is_connected: false, url: '' },
  { key: 'naver_place', label: '네이버스마트플레이스', icon: '📗', category: '예약', is_connected: false, url: '' },
  { key: 'google_calendar', label: 'Google캘린더', icon: '📅', category: '일정', is_connected: false },
  { key: 'instagram', label: '인스타그램', icon: '📸', category: 'SNS', is_connected: false, account_id: '' },
  { key: 'blog', label: '블로그', icon: '📝', category: 'SNS', is_connected: false, url: '' },
  { key: 'band', label: '밴드', icon: '🎵', category: 'SNS', is_connected: false, url: '' },
  // 전자서명(kakao_esign, naver_esign)은 실연동 출시 전까지 목록에서 제외
]

export async function fetchIntegrations(): Promise<IntegrationConfig[]> {
  const list = await fetchAgentSetting('integrations', defaultIntegrations)
  // 과거에 저장된 설정에 전자서명 항목이 남아 있어도 숨긴다
  return list.filter((i) => i.category !== '전자서명')
}

export async function toggleIntegration(key: string, connected: boolean, data?: { url?: string; account_id?: string }): Promise<void> {
  const current = await fetchIntegrations()
  const updated = current.map((i) =>
    i.key === key ? { ...i, is_connected: connected, ...data } : i,
  )
  await upsertAgentSetting('integrations', { value: updated } as unknown as Record<string, unknown>)
}

// ──────────────────────────────────────────
// Billing / Plan (agent_profiles.subscription_plan)
// ──────────────────────────────────────────

export type BillingInfo = {
  current_plan: PlanType
  plan_label: string
  price: number
  next_billing_date: string
  payment_history: { date: string; amount: number; description: string; status: string }[]
}

const PLAN_META: Record<PlanType, { label: string; price: number }> = {
  free: { label: 'Free', price: 0 },
  basic: { label: 'Basic', price: 3000 },
  pro: { label: 'Pro', price: 5000 },
}

export async function fetchBillingInfo(): Promise<BillingInfo> {
  const profile = await fetchOfficeSettings()
  const plan = profile.subscription_plan as PlanType
  const meta = PLAN_META[plan]
  return {
    current_plan: plan,
    plan_label: meta.label,
    price: meta.price,
    next_billing_date: '2026-03-01',
    payment_history: meta.price > 0
      ? [
          { date: '2026-02-01', amount: meta.price, description: `${meta.label} 요금제 (월간)`, status: '결제완료' },
          { date: '2026-01-01', amount: meta.price, description: `${meta.label} 요금제 (월간)`, status: '결제완료' },
          { date: '2025-12-01', amount: meta.price, description: `${meta.label} 요금제 (월간)`, status: '결제완료' },
        ]
      : [],
  }
}

export async function changePlan(plan: PlanType): Promise<void> {
  const agentId = await getAgentProfileId()
  const { error } = await supabase
    .from('agent_profiles')
    .update({
      subscription_plan: plan,
      subscription_started_at: new Date().toISOString(),
    })
    .eq('id', agentId)

  if (error) throw error
}

// ──────────────────────────────────────────
// Security Settings
// ──────────────────────────────────────────

export type LoginRecord = {
  date: string
  ip: string
  device: string
}

export type SecuritySettings = {
  two_factor_enabled: boolean
  login_records: LoginRecord[]
}

export async function fetchSecuritySettings(): Promise<SecuritySettings> {
  const { fetchLoginRecords } = await import('@/api/auth')

  // Check real MFA enrollment status
  let twoFactorEnabled = false
  try {
    const { data } = await supabaseAuth.auth.mfa.listFactors()
    twoFactorEnabled = (data?.totp ?? []).some((f) => f.status === 'verified')
  } catch {
    // Not logged in or MFA not supported — default to false
  }

  // Fetch real login records
  let loginRecords: LoginRecord[] = []
  try {
    loginRecords = await fetchLoginRecords()
  } catch {
    // Table might not exist yet — gracefully degrade
  }

  return {
    two_factor_enabled: twoFactorEnabled,
    login_records: loginRecords,
  }
}

// ──────────────────────────────────────────
// Slug / Subdomain Management
// ──────────────────────────────────────────

const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/

export async function checkSlugAvailability(slug: string): Promise<{ available: boolean; reason?: string }> {
  // Format check
  if (!SLUG_REGEX.test(slug)) {
    return { available: false, reason: '소문자 영문, 숫자, 하이픈만 사용 가능 (3~63자)' }
  }

  // Reserved check
  const { data: reserved } = await supabase
    .from('reserved_slugs')
    .select('slug')
    .eq('slug', slug)
    .single()

  if (reserved) {
    return { available: false, reason: '예약된 주소입니다.' }
  }

  // Duplicate check
  const { data: existing } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('slug', slug)
    .single()

  const agentId = await getAgentProfileId()
  if (existing && existing.id !== agentId) {
    return { available: false, reason: '이미 사용 중인 주소입니다.' }
  }

  return { available: true }
}

export async function updateSlug(slug: string | null): Promise<void> {
  const agentId = await getAgentProfileId()
  const { error } = await supabase
    .from('agent_profiles')
    .update({ slug })
    .eq('id', agentId)

  if (error) throw error
}
