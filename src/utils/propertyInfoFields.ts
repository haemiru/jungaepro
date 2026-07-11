import type { Property } from '@/types/database'
import { formatDate, formatPrice } from '@/utils/format'
import { formatAreaByUnit } from '@/utils/areaFormat'

export type InfoFieldDef = {
  key: string
  label: string
  getValue: (p: Property) => string
}

// ── 공통 필드 ──

const SUPPLY_AREA: InfoFieldDef = {
  key: 'supply_area', label: '공급면적',
  getValue: (p) => formatAreaByUnit(p.supply_area_m2),
}
const EXCLUSIVE_AREA: InfoFieldDef = {
  key: 'exclusive_area', label: '전용면적',
  getValue: (p) => formatAreaByUnit(p.exclusive_area_m2),
}
const ROOMS_BATHS: InfoFieldDef = {
  key: 'rooms_baths', label: '방/욕실',
  getValue: (p) => `${p.rooms ?? '-'}룸 / ${p.bathrooms ?? '-'}욕실`,
}
const FLOOR: InfoFieldDef = {
  key: 'floor', label: '해당층/총층',
  getValue: (p) => `${p.floor ?? '-'}층 / ${p.total_floors ?? '-'}층`,
}
const DIRECTION: InfoFieldDef = {
  key: 'direction', label: '방향',
  getValue: (p) => p.direction || '-',
}
const MOVE_IN: InfoFieldDef = {
  key: 'move_in', label: '입주가능일',
  getValue: (p) => formatDate(p.move_in_date),
}
const PARKING: InfoFieldDef = {
  key: 'parking', label: '주차',
  getValue: (p) => p.parking_per_unit != null ? `${p.parking_per_unit}대/세대` : '-',
}
const ELEVATOR: InfoFieldDef = {
  key: 'elevator', label: '엘리베이터',
  getValue: (p) => p.has_elevator ? '있음' : '없음',
}
const PETS: InfoFieldDef = {
  key: 'pets', label: '반려동물',
  getValue: (p) => p.pets_allowed ? '허용' : '불가',
}
const BUILT_YEAR: InfoFieldDef = {
  key: 'built_year', label: '준공연도',
  getValue: (p) => {
    if (!p.built_year) return '-'
    const [y, m] = p.built_year.split('-')
    return m ? `${y}년 ${parseInt(m)}월` : `${y}년`
  },
}

// ── 확장 필드 ──

const HOUSEHOLD_COUNT: InfoFieldDef = {
  key: 'household_count', label: '세대수',
  getValue: (p) => p.extra_info?.household_count ? `${p.extra_info.household_count}세대` : '-',
}
const HEATING_TYPE: InfoFieldDef = {
  key: 'heating_type', label: '난방방식',
  getValue: (p) => p.extra_info?.heating_type || '-',
}
const EXPECTED_MOVE_IN: InfoFieldDef = {
  key: 'expected_move_in', label: '입주예정일',
  getValue: (p) => p.extra_info?.expected_move_in || '-',
}
const BUILDER: InfoFieldDef = {
  key: 'builder', label: '시공사',
  getValue: (p) => p.extra_info?.builder || '-',
}
const PREMIUM: InfoFieldDef = {
  key: 'premium', label: '프리미엄',
  getValue: (p) => p.extra_info?.premium != null ? formatPrice(p.extra_info.premium) : '-',
}
const BUSINESS_RESTRICTION: InfoFieldDef = {
  key: 'business_restriction', label: '업종제한',
  getValue: (p) => p.extra_info?.business_restriction || '-',
}
const KEY_MONEY: InfoFieldDef = {
  key: 'key_money', label: '권리금',
  getValue: (p) => p.extra_info?.key_money != null ? formatPrice(p.extra_info.key_money) : '-',
}
const FOOT_TRAFFIC: InfoFieldDef = {
  key: 'foot_traffic', label: '유동인구',
  getValue: (p) => p.extra_info?.foot_traffic || '-',
}
const FRONTAGE_WIDTH: InfoFieldDef = {
  key: 'frontage_width', label: '전면폭',
  getValue: (p) => p.extra_info?.frontage_width ? `${p.extra_info.frontage_width}m` : '-',
}
const CEILING_HEIGHT: InfoFieldDef = {
  key: 'ceiling_height', label: '층고',
  getValue: (p) => p.extra_info?.ceiling_height ? `${p.extra_info.ceiling_height}m` : '-',
}
const BUILDING_STRUCTURE: InfoFieldDef = {
  key: 'building_structure', label: '건물구조',
  getValue: (p) => p.extra_info?.building_structure || '-',
}
const MAINTENANCE_PER_PYEONG: InfoFieldDef = {
  key: 'maintenance_per_pyeong', label: '관리비(평당)',
  getValue: (p) => p.extra_info?.maintenance_per_pyeong ? `${Number(p.extra_info.maintenance_per_pyeong).toLocaleString()}원/평` : '-',
}
const RENT_PER_PYEONG: InfoFieldDef = {
  key: 'rent_per_pyeong', label: '월세(평당)',
  getValue: (p) => p.extra_info?.rent_per_pyeong ? `${Number(p.extra_info.rent_per_pyeong).toLocaleString()}원/평` : '-',
}
const LAND_AREA: InfoFieldDef = {
  key: 'land_area', label: '대지면적',
  getValue: (p) => p.extra_info?.land_area_m2 ? formatAreaByUnit(p.extra_info.land_area_m2) : '-',
}
const LAND_CATEGORY: InfoFieldDef = {
  key: 'land_category', label: '지목',
  getValue: (p) => p.extra_info?.land_category || '-',
}
const ZONING: InfoFieldDef = {
  key: 'zoning', label: '용도지역',
  getValue: (p) => p.extra_info?.zoning || '-',
}
const ROAD_FRONTAGE: InfoFieldDef = {
  key: 'road_frontage', label: '도로접면',
  getValue: (p) => p.extra_info?.road_frontage || '-',
}
const BCR_FAR: InfoFieldDef = {
  key: 'bcr_far', label: '건폐율/용적률',
  getValue: (p) => p.extra_info?.bcr_far || '-',
}
const SLOPE_TERRAIN: InfoFieldDef = {
  key: 'slope_terrain', label: '경사/지형',
  getValue: (p) => p.extra_info?.slope_terrain || '-',
}
const BUILDING_AREA: InfoFieldDef = {
  key: 'building_area', label: '건물면적',
  getValue: (p) => {
    // 복수 건물이 있으면 총합 표시
    if (p.extra_info?.buildings && p.extra_info.buildings.length > 0) {
      const total = p.extra_info.buildings.reduce((sum, b) => sum + (b.building_area_m2 || 0), 0)
      return `${formatAreaByUnit(total)} (${p.extra_info.buildings.length}개동)`
    }
    return p.extra_info?.building_area_m2 ? formatAreaByUnit(p.extra_info.building_area_m2) : '-'
  },
}
const BUILDINGS_DETAIL: InfoFieldDef = {
  key: 'buildings_detail', label: '건물 상세',
  getValue: (p) => {
    if (!p.extra_info?.buildings || p.extra_info.buildings.length === 0) return '-'
    return p.extra_info.buildings.map((b) => {
      const parts = [b.name || '건물']
      parts.push(formatAreaByUnit(b.building_area_m2))
      if (b.gross_floor_area_m2) parts.push(`연면적 ${formatAreaByUnit(b.gross_floor_area_m2)}`)
      if (b.ceiling_height) parts.push(`층고 ${b.ceiling_height}m`)
      if (b.building_structure) parts.push(b.building_structure)
      if (b.floors) parts.push(`${b.floors}층`)
      if (b.built_year) parts.push(`준공 ${b.built_year}`)
      if (b.usage) parts.push(b.usage)
      return parts.join(' / ')
    }).join(' | ')
  },
}
const POWER_CAPACITY: InfoFieldDef = {
  key: 'power_capacity', label: '전력용량',
  getValue: (p) => p.extra_info?.power_capacity || '-',
}
const TRUCK_25T: InfoFieldDef = {
  key: 'truck_25t', label: '25톤 진입',
  getValue: (p) => p.extra_info?.truck_25t != null ? (p.extra_info.truck_25t ? '가능' : '불가') : '-',
}
const TRUCK_WINGBODY: InfoFieldDef = {
  key: 'truck_wingbody', label: '윙바디 진입',
  getValue: (p) => p.extra_info?.truck_wingbody != null ? (p.extra_info.truck_wingbody ? '가능' : '불가') : '-',
}
const TRUCK_TRAILER_40FT: InfoFieldDef = {
  key: 'truck_trailer_40ft', label: '40ft 트레일러 진입',
  getValue: (p) => p.extra_info?.truck_trailer_40ft != null ? (p.extra_info.truck_trailer_40ft ? '가능' : '불가') : '-',
}
const LOADING_DOCK: InfoFieldDef = {
  key: 'loading_dock', label: 'Dock 시설',
  getValue: (p) => p.extra_info?.loading_dock != null ? (p.extra_info.loading_dock ? '있음' : '없음') : '-',
}
const COLD_STORAGE: InfoFieldDef = {
  key: 'cold_storage', label: '냉동냉장',
  getValue: (p) => p.extra_info?.cold_storage != null ? (p.extra_info.cold_storage ? '있음' : '없음') : '-',
}
const PROJECT_PHASE: InfoFieldDef = {
  key: 'project_phase', label: '사업단계',
  getValue: (p) => p.extra_info?.project_phase || '-',
}
const MEMBER_PRICE: InfoFieldDef = {
  key: 'member_price', label: '조합원분양가',
  getValue: (p) => p.extra_info?.member_price != null ? formatPrice(p.extra_info.member_price) : '-',
}
const EXPECTED_HOUSEHOLDS: InfoFieldDef = {
  key: 'expected_households', label: '예상세대수',
  getValue: (p) => p.extra_info?.expected_households ? `${p.extra_info.expected_households}세대` : '-',
}
const ROOM_COUNT: InfoFieldDef = {
  key: 'room_count', label: '객실수',
  getValue: (p) => p.extra_info?.room_count ? `${p.extra_info.room_count}실` : '-',
}
const MONTHLY_AVG_REVENUE: InfoFieldDef = {
  key: 'monthly_avg_revenue', label: '월평균매출',
  getValue: (p) => p.extra_info?.monthly_avg_revenue != null ? formatPrice(p.extra_info.monthly_avg_revenue) : '-',
}
const BUSINESS_LICENSE: InfoFieldDef = {
  key: 'business_license', label: '인허가',
  getValue: (p) => p.extra_info?.business_license || '-',
}

// ── 카테고리별 필드 매핑 ──

const RESIDENTIAL_BASE: InfoFieldDef[] = [
  SUPPLY_AREA, EXCLUSIVE_AREA, ROOMS_BATHS, FLOOR, DIRECTION,
  MOVE_IN, PARKING, ELEVATOR, PETS, BUILT_YEAR,
  HOUSEHOLD_COUNT, HEATING_TYPE,
]

const PRESALE_FIELDS: InfoFieldDef[] = [
  SUPPLY_AREA, EXCLUSIVE_AREA, ROOMS_BATHS, FLOOR, DIRECTION,
  MOVE_IN, PARKING, ELEVATOR, BUILT_YEAR,
  EXPECTED_MOVE_IN, BUILDER, PREMIUM,
]

const STORE_FIELDS: InfoFieldDef[] = [
  EXCLUSIVE_AREA, FLOOR, MOVE_IN, PARKING, ELEVATOR, BUILT_YEAR,
  MAINTENANCE_PER_PYEONG, BUSINESS_RESTRICTION, KEY_MONEY, FOOT_TRAFFIC, FRONTAGE_WIDTH,
]

const OFFICE_FIELDS: InfoFieldDef[] = [
  EXCLUSIVE_AREA, FLOOR, MOVE_IN, PARKING, ELEVATOR, BUILT_YEAR,
  MAINTENANCE_PER_PYEONG, CEILING_HEIGHT, BUILDING_STRUCTURE,
]

const LAND_FIELDS: InfoFieldDef[] = [
  LAND_AREA, LAND_CATEGORY, ZONING, ROAD_FRONTAGE, BCR_FAR, SLOPE_TERRAIN, RENT_PER_PYEONG,
]

const FACTORY_FIELDS: InfoFieldDef[] = [
  LAND_AREA, BUILDING_AREA, BUILDINGS_DETAIL, MOVE_IN, PARKING,
  ZONING, ROAD_FRONTAGE, BCR_FAR,
  POWER_CAPACITY, TRUCK_25T, TRUCK_WINGBODY, TRUCK_TRAILER_40FT, LOADING_DOCK, COLD_STORAGE, LAND_CATEGORY,
]

const REDEVELOP_FIELDS: InfoFieldDef[] = [
  SUPPLY_AREA, EXCLUSIVE_AREA, ROOMS_BATHS, FLOOR, BUILT_YEAR,
  LAND_AREA, LAND_CATEGORY, ZONING, ROAD_FRONTAGE, BCR_FAR,
  PROJECT_PHASE, MEMBER_PRICE, EXPECTED_HOUSEHOLDS,
]

const PENSION_FIELDS: InfoFieldDef[] = [
  LAND_AREA, BUILDING_AREA, ROOMS_BATHS, PARKING, BUILT_YEAR,
  PETS, BUILDING_STRUCTURE,
  ROOM_COUNT, MONTHLY_AVG_REVENUE, BUSINESS_LICENSE,
]

const KNOWLEDGE_CENTER_FIELDS: InfoFieldDef[] = [
  EXCLUSIVE_AREA, FLOOR, MOVE_IN, PARKING, ELEVATOR, BUILT_YEAR,
  MAINTENANCE_PER_PYEONG, CEILING_HEIGHT, BUILDING_STRUCTURE, HOUSEHOLD_COUNT, BUSINESS_RESTRICTION,
]

const CATEGORY_FIELDS_MAP: Record<string, InfoFieldDef[]> = {
  '아파트': RESIDENTIAL_BASE,
  '오피스텔': RESIDENTIAL_BASE,
  '빌라': RESIDENTIAL_BASE,
  '주택': RESIDENTIAL_BASE,
  '원룸': RESIDENTIAL_BASE,
  '분양권': PRESALE_FIELDS,
  '상가': STORE_FIELDS,
  '사무실': OFFICE_FIELDS,
  '지식산업센터': KNOWLEDGE_CENTER_FIELDS,
  '토지': LAND_FIELDS,
  '공장/창고': FACTORY_FIELDS,
  '재개발': REDEVELOP_FIELDS,
  '숙박/펜션': PENSION_FIELDS,
}

/** 카테고리명으로 표시할 기본 정보 필드 목록을 반환 */
export function getInfoFieldsForCategory(categoryName: string | undefined): InfoFieldDef[] {
  if (!categoryName) return RESIDENTIAL_BASE
  return CATEGORY_FIELDS_MAP[categoryName] ?? RESIDENTIAL_BASE
}
