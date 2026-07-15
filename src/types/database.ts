export type UserRole = 'customer' | 'agent' | 'staff'
export type PlanType = 'free' | 'basic' | 'pro'
export type StaffRole = 'associate_agent' | 'assistant'
export type TransactionType = 'sale' | 'jeonse' | 'monthly'
export type PropertyStatus = 'draft' | 'active' | 'contracted' | 'completed' | 'hold'

export type InquiryType = 'property' | 'price' | 'contract' | 'other'
export type InquiryStatus = 'new' | 'checked' | 'in_progress' | 'answered' | 'closed'
export type CustomerType = 'lead' | 'interest' | 'consulting' | 'contracting' | 'completed'
export type CustomerSource = 'inquiry' | 'direct' | 'referral' | 'website'
export type ActivityType = 'inquiry' | 'phone_call' | 'visit' | 'site_tour' | 'contract_consult' | 'other'

export type ContractTemplateType =
  | 'apartment_sale' | 'apartment_lease'
  | 'officetel_sale' | 'officetel_lease'
  | 'commercial_sale' | 'commercial_lease'
  | 'building_sale'
  | 'land_sale' | 'land_lease'
  | 'factory_sale' | 'factory_lease'
  | 'knowledge_center_sale' | 'knowledge_center_lease'

export type ContractStatus = 'contract_writing' | 'confirmation_writing' | 'in_progress' | 'completed'

export type ContractStepType =
  | 'contract_signed' | 'down_payment' | 'mid_payment' | 'final_payment'
  | 'ownership_transfer' | 'move_in_report' | 'fixed_date' | 'moving'
  | 'maintenance_settle' | 'completed'

export type User = {
  id: string
  email: string
  role: UserRole
  display_name: string
  phone: string | null
  avatar_url: string | null
  is_super_admin: boolean
  created_at: string
}

export type AgentProfile = {
  id: string
  user_id: string
  office_name: string
  representative: string
  business_number: string
  license_number: string
  address: string
  phone: string
  fax: string | null
  business_hours: Record<string, unknown> | null
  logo_url: string | null
  description: string | null
  specialties: string[] | null
  insurance_info: Record<string, unknown> | null
  is_verified: boolean
  subscription_plan: PlanType
  subscription_started_at: string
  invite_code: string | null
  slug: string | null
  created_at: string
}

export type CustomDomain = {
  id: string
  agent_id: string
  domain: string
  is_verified: boolean
  verification_token: string
  verified_at: string | null
  created_at: string
}

export type TenantProfile = {
  id: string
  office_name: string
  representative: string
  address: string
  phone: string
  fax: string | null
  logo_url: string | null
  description: string | null
  specialties: string[] | null
  business_hours: Record<string, unknown> | null
  subscription_plan: string
}

export type StaffMember = {
  id: string
  agent_profile_id: string
  user_id: string
  role: StaffRole
  permissions: Record<string, unknown> | null
  is_active: boolean
  created_at: string
}

export type AgentFeatureSetting = {
  id: string
  agent_id: string
  feature_key: string
  is_enabled: boolean
  is_locked: boolean
  settings_json: Record<string, unknown> | null
  updated_at: string
}

export type BuildingInfo = {
  name: string               // 건물명 (예: A동, 창고1, 공장동)
  building_area_m2: number   // 건물면적 (㎡)
  gross_floor_area_m2?: number // 연면적 (㎡)
  ceiling_height?: number    // 층고 (m)
  building_structure?: string // 건물구조
  floors?: number            // 층수
  built_year?: string        // 준공연도 (예: 2020-06)
  usage?: string             // 용도 (예: 생산동, 사무동, 창고동)
}

export type PropertyExtraInfo = {
  // 주거 공통
  household_count?: number
  heating_type?: string
  // 분양권
  expected_move_in?: string
  builder?: string
  premium?: number
  // 상가
  business_restriction?: string
  key_money?: number
  foot_traffic?: string
  frontage_width?: number
  // 사무실 / 상가 / 지식산업센터
  ceiling_height?: number
  building_structure?: string
  maintenance_per_pyeong?: number
  rent_per_pyeong?: number
  // 토지
  land_area_m2?: number
  land_category?: string
  zoning?: string
  road_frontage?: string
  bcr_far?: string
  slope_terrain?: string
  // 공장/창고
  building_area_m2?: number  // (하위호환) 단일 건물 면적
  buildings?: BuildingInfo[] // 복수 건물 정보
  power_capacity?: string
  truck_25t?: boolean
  truck_wingbody?: boolean
  truck_trailer_40ft?: boolean
  loading_dock?: boolean
  cold_storage?: boolean
  // 재개발
  project_phase?: string
  member_price?: number
  expected_households?: number
  // 숙박/펜션
  room_count?: number
  monthly_avg_revenue?: number
  business_license?: string
}

export type Property = {
  id: string
  agent_id: string
  category_id: string | null
  title: string
  transaction_type: TransactionType
  address: string
  address_detail: string | null
  dong: string | null
  ho: string | null
  latitude: number | null
  longitude: number | null
  sale_price: number | null
  deposit: number | null
  monthly_rent: number | null
  maintenance_fee: number | null
  supply_area_m2: number | null
  exclusive_area_m2: number | null
  rooms: number | null
  bathrooms: number | null
  total_floors: number | null
  floor: number | null
  direction: string | null
  move_in_date: string | null
  parking_per_unit: number | null
  has_elevator: boolean
  pets_allowed: boolean
  options: string[] | null
  description: string | null
  status: PropertyStatus
  is_urgent: boolean
  is_co_brokerage: boolean
  co_brokerage_fee_ratio: number | null
  internal_memo: string | null
  view_count: number
  inquiry_count: number
  favorite_count: number
  built_year: string | null
  tags: string[] | null
  photos: string[] | null
  extra_info: PropertyExtraInfo | null
  created_at: string
  updated_at: string
}

export type PropertyCategory = {
  id: string
  agent_id: string | null
  name: string
  icon: string | null
  color: string | null
  sort_order: number
  is_system: boolean
  is_active: boolean
  required_fields: Record<string, unknown> | null
}

export type PropertyFavorite = {
  id: string
  user_id: string
  property_id: string
  created_at: string
}

export type Inquiry = {
  id: string
  inquiry_number: string
  user_id: string | null
  name: string
  phone: string
  email: string | null
  inquiry_type: InquiryType
  property_id: string | null
  preferred_visit_date: string | null
  content: string
  status: InquiryStatus
  agent_id: string
  created_at: string
  updated_at: string
}

export type InquiryReply = {
  id: string
  inquiry_id: string
  agent_id: string
  content: string
  sent_via: string[]
  sent_at: string | null
  created_at: string
}

export type Customer = {
  id: string
  agent_id: string
  user_id: string | null
  name: string
  phone: string
  email: string | null
  customer_type: CustomerType
  preferences: Record<string, unknown>
  score: number
  source: CustomerSource
  memo: string | null
  created_at: string
  updated_at: string
}

export type CustomerActivity = {
  id: string
  customer_id: string
  activity_type: ActivityType
  property_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type Contract = {
  id: string
  contract_number: string
  agent_id: string
  property_id: string | null
  transaction_type: TransactionType
  template_type: ContractTemplateType
  seller_info: Record<string, unknown>
  buyer_info: Record<string, unknown>
  agent_info: Record<string, unknown>
  price_info: Record<string, unknown>
  special_terms: string | null
  status: ContractStatus
  confirmation_doc: Record<string, unknown>
  draft_data: Record<string, unknown> | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export type ContractProcess = {
  id: string
  contract_id: string
  step_type: ContractStepType
  step_label: string
  due_date: string | null
  is_completed: boolean
  completed_at: string | null
  notes: string | null
  sort_order: number
  created_at: string
}

export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed'
export type CheckItemStatus = 'good' | 'normal' | 'bad'
export type InspectionGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export type RentalPropertyStatus = 'occupied' | 'vacant' | 'expiring'
export type RepairRequestStatus = 'requested' | 'confirmed' | 'in_progress' | 'completed'

export type Inspection = {
  id: string
  agent_id: string
  property_id: string | null
  property_title: string
  address: string
  status: InspectionStatus
  scheduled_date: string | null
  completed_date: string | null
  checklist: InspectionCheckItem[]
  overall_comment: string | null
  grade: InspectionGrade | null
  ai_comment: string | null
  photos: string[]
  created_at: string
  updated_at: string
}

export type InspectionCheckItem = {
  id: string
  category: string
  label: string
  status: CheckItemStatus | null
  note: string | null
  photo: string | null
}

export type RentalProperty = {
  id: string
  agent_id: string
  property_id: string | null
  address: string
  unit_number: string
  tenant_name: string
  tenant_phone: string
  deposit: number
  monthly_rent: number
  contract_start: string
  contract_end: string
  status: RentalPropertyStatus
  created_at: string
}

export type RentalPayment = {
  id: string
  rental_property_id: string
  payment_month: string
  amount: number
  is_paid: boolean
  paid_date: string | null
  memo: string | null
  created_at: string
}

export type RepairRequest = {
  id: string
  rental_property_id: string
  title: string
  description: string
  photos: string[]
  status: RepairRequestStatus
  requested_at: string
  completed_at: string | null
  cost: number | null
  memo: string | null
}

export type RentalShareLink = {
  id: string
  rental_property_id: string
  token: string
  expires_at: string
  created_at: string
}

export type CoBrokerageRequestStatus = 'pending' | 'approved' | 'rejected'

export type SharedProperty = {
  id: string
  property_id: string
  agent_id: string
  agent_name: string
  office_name: string
  commission_ratio: number
  is_active: boolean
  property_title: string
  address: string
  transaction_type: TransactionType
  sale_price: number | null
  deposit: number | null
  monthly_rent: number | null
  exclusive_area_m2: number | null
  photos: string[]
  created_at: string
}

export type CoBrokerageRequest = {
  id: string
  shared_property_id: string
  requester_agent_id: string
  requester_name: string
  requester_office: string
  requester_phone: string
  status: CoBrokerageRequestStatus
  message: string
  commission_ratio: number | null
  property_title: string
  address: string
  created_at: string
  updated_at: string
}

export type AIGenerationType = 'description' | 'legal_review' | 'inquiry_reply' | 'chatbot' | 'customer_analysis' | 'move_in_guide'

export type AgentSetting = {
  id: string
  agent_id: string
  setting_key: string
  setting_value: Record<string, unknown>
  updated_at: string
}

export type AIGenerationLog = {
  id: string
  agent_id: string
  type: AIGenerationType
  input_data: Record<string, unknown>
  output_text: string
  created_at: string
}

export type MoveInGuide = {
  id: string
  contract_id: string
  agent_id: string
  content: string
  address: string
  created_at: string
}

// 토스페이먼츠 정기결제
export type BillingSubscription = {
  id: string
  agent_id: string
  customer_key: string
  billing_key: string
  card_company: string | null
  card_last4: string | null
  plan: 'basic' | 'pro'
  status: 'active' | 'canceled' | 'past_due'
  pending_plan: 'free' | 'basic' | 'pro' | null
  cancel_at_period_end: boolean
  current_period_start: string
  current_period_end: string
  created_at: string
  updated_at: string
}

export type PaymentHistory = {
  id: string
  agent_id: string
  order_id: string
  plan: string | null
  amount: number
  status: string
  method: string | null
  receipt_url: string | null
  payment_key: string | null
  approved_at: string | null
  raw: Record<string, unknown> | null
  created_at: string
}

// get_my_subscription() RPC 반환 (billing_key 제외)
export type MySubscription = {
  plan: string
  status: string
  card_company: string | null
  card_last4: string | null
  pending_plan: string | null
  cancel_at_period_end: boolean
  current_period_start: string
  current_period_end: string
}

// Supabase Database type for typed client
// Matches the format generated by `supabase gen types typescript`
// IMPORTANT: Row types must be `type` aliases (not `interface`) to satisfy
// GenericSchema's `Record<string, unknown>` constraint.
export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: {
          id: string
          email: string
          role?: UserRole
          display_name: string
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: UserRole
          display_name?: string
          phone?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      agent_profiles: {
        Row: AgentProfile
        Insert: {
          id?: string
          user_id: string
          office_name: string
          representative: string
          business_number: string
          license_number: string
          address: string
          phone: string
          fax?: string | null
          business_hours?: Record<string, unknown> | null
          logo_url?: string | null
          description?: string | null
          specialties?: string[] | null
          insurance_info?: Record<string, unknown> | null
          is_verified?: boolean
          subscription_plan?: PlanType
          subscription_started_at?: string
          invite_code?: string | null
          slug?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          office_name?: string
          representative?: string
          business_number?: string
          license_number?: string
          address?: string
          phone?: string
          fax?: string | null
          business_hours?: Record<string, unknown> | null
          logo_url?: string | null
          description?: string | null
          specialties?: string[] | null
          insurance_info?: Record<string, unknown> | null
          is_verified?: boolean
          subscription_plan?: PlanType
          subscription_started_at?: string
          invite_code?: string | null
          slug?: string | null
          created_at?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: StaffMember
        Insert: {
          id?: string
          agent_profile_id: string
          user_id: string
          role?: StaffRole
          permissions?: Record<string, unknown> | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          agent_profile_id?: string
          user_id?: string
          role?: StaffRole
          permissions?: Record<string, unknown> | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      agent_feature_settings: {
        Row: AgentFeatureSetting
        Insert: {
          id?: string
          agent_id: string
          feature_key: string
          is_enabled?: boolean
          is_locked?: boolean
          settings_json?: Record<string, unknown> | null
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          feature_key?: string
          is_enabled?: boolean
          is_locked?: boolean
          settings_json?: Record<string, unknown> | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: Property
        Insert: {
          id?: string
          agent_id: string
          category_id?: string | null
          title: string
          transaction_type: TransactionType
          address: string
          address_detail?: string | null
          dong?: string | null
          ho?: string | null
          latitude?: number | null
          longitude?: number | null
          sale_price?: number | null
          deposit?: number | null
          monthly_rent?: number | null
          maintenance_fee?: number | null
          supply_area_m2?: number | null
          exclusive_area_m2?: number | null
          rooms?: number | null
          bathrooms?: number | null
          total_floors?: number | null
          floor?: number | null
          direction?: string | null
          move_in_date?: string | null
          parking_per_unit?: number | null
          has_elevator?: boolean
          pets_allowed?: boolean
          options?: string[] | null
          description?: string | null
          status?: PropertyStatus
          is_urgent?: boolean
          is_co_brokerage?: boolean
          co_brokerage_fee_ratio?: number | null
          internal_memo?: string | null
          view_count?: number
          inquiry_count?: number
          favorite_count?: number
          built_year?: string | null
          tags?: string[] | null
          photos?: string[] | null
          extra_info?: PropertyExtraInfo | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          category_id?: string | null
          title?: string
          transaction_type?: TransactionType
          address?: string
          address_detail?: string | null
          dong?: string | null
          ho?: string | null
          latitude?: number | null
          longitude?: number | null
          sale_price?: number | null
          deposit?: number | null
          monthly_rent?: number | null
          maintenance_fee?: number | null
          supply_area_m2?: number | null
          exclusive_area_m2?: number | null
          rooms?: number | null
          bathrooms?: number | null
          total_floors?: number | null
          floor?: number | null
          direction?: string | null
          move_in_date?: string | null
          parking_per_unit?: number | null
          has_elevator?: boolean
          pets_allowed?: boolean
          options?: string[] | null
          description?: string | null
          status?: PropertyStatus
          is_urgent?: boolean
          is_co_brokerage?: boolean
          co_brokerage_fee_ratio?: number | null
          internal_memo?: string | null
          view_count?: number
          inquiry_count?: number
          favorite_count?: number
          built_year?: string | null
          tags?: string[] | null
          photos?: string[] | null
          extra_info?: PropertyExtraInfo | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_categories: {
        Row: PropertyCategory
        Insert: {
          id?: string
          agent_id?: string | null
          name: string
          icon?: string | null
          color?: string | null
          sort_order?: number
          is_system?: boolean
          is_active?: boolean
          required_fields?: Record<string, unknown> | null
        }
        Update: {
          id?: string
          agent_id?: string | null
          name?: string
          icon?: string | null
          color?: string | null
          sort_order?: number
          is_system?: boolean
          is_active?: boolean
          required_fields?: Record<string, unknown> | null
        }
        Relationships: []
      }
      property_favorites: {
        Row: PropertyFavorite
        Insert: {
          id?: string
          user_id: string
          property_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          created_at?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: Inquiry
        Insert: {
          id?: string
          inquiry_number: string
          user_id?: string | null
          name: string
          phone: string
          email?: string | null
          inquiry_type?: InquiryType
          property_id?: string | null
          preferred_visit_date?: string | null
          content: string
          status?: InquiryStatus
          agent_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          inquiry_number?: string
          user_id?: string | null
          name?: string
          phone?: string
          email?: string | null
          inquiry_type?: InquiryType
          property_id?: string | null
          preferred_visit_date?: string | null
          content?: string
          status?: InquiryStatus
          agent_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      inquiry_replies: {
        Row: InquiryReply
        Insert: {
          id?: string
          inquiry_id: string
          agent_id: string
          content: string
          sent_via?: string[]
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          inquiry_id?: string
          agent_id?: string
          content?: string
          sent_via?: string[]
          sent_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: Customer
        Insert: {
          id?: string
          agent_id: string
          user_id?: string | null
          name: string
          phone: string
          email?: string | null
          customer_type?: CustomerType
          preferences?: Record<string, unknown>
          score?: number
          source?: CustomerSource
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          user_id?: string | null
          name?: string
          phone?: string
          email?: string | null
          customer_type?: CustomerType
          preferences?: Record<string, unknown>
          score?: number
          source?: CustomerSource
          memo?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_activities: {
        Row: CustomerActivity
        Insert: {
          id?: string
          customer_id: string
          activity_type: ActivityType
          property_id?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          activity_type?: ActivityType
          property_id?: string | null
          metadata?: Record<string, unknown>
          created_at?: string
        }
        Relationships: []
      }
      contracts: {
        Row: Contract
        Insert: {
          id?: string
          contract_number: string
          agent_id: string
          property_id?: string | null
          transaction_type: TransactionType
          template_type: ContractTemplateType
          seller_info?: Record<string, unknown>
          buyer_info?: Record<string, unknown>
          agent_info?: Record<string, unknown>
          price_info?: Record<string, unknown>
          special_terms?: string | null
          status?: ContractStatus
          confirmation_doc?: Record<string, unknown>
          pdf_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          contract_number?: string
          agent_id?: string
          property_id?: string | null
          transaction_type?: TransactionType
          template_type?: ContractTemplateType
          seller_info?: Record<string, unknown>
          buyer_info?: Record<string, unknown>
          agent_info?: Record<string, unknown>
          price_info?: Record<string, unknown>
          special_terms?: string | null
          status?: ContractStatus
          confirmation_doc?: Record<string, unknown>
          pdf_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contract_process: {
        Row: ContractProcess
        Insert: {
          id?: string
          contract_id: string
          step_type: ContractStepType
          step_label: string
          due_date?: string | null
          is_completed?: boolean
          completed_at?: string | null
          notes?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          step_type?: ContractStepType
          step_label?: string
          due_date?: string | null
          is_completed?: boolean
          completed_at?: string | null
          notes?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      ai_generation_logs: {
        Row: AIGenerationLog
        Insert: {
          id?: string
          agent_id: string
          type: AIGenerationType
          input_data?: Record<string, unknown>
          output_text: string
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          type?: AIGenerationType
          input_data?: Record<string, unknown>
          output_text?: string
          created_at?: string
        }
        Relationships: []
      }
      move_in_guides: {
        Row: MoveInGuide
        Insert: {
          id?: string
          contract_id: string
          agent_id: string
          content: string
          address: string
          created_at?: string
        }
        Update: {
          id?: string
          contract_id?: string
          agent_id?: string
          content?: string
          address?: string
          created_at?: string
        }
        Relationships: []
      }
      inspections: {
        Row: Inspection
        Insert: {
          id?: string
          agent_id: string
          property_id?: string | null
          property_title: string
          address: string
          status?: InspectionStatus
          scheduled_date?: string | null
          completed_date?: string | null
          checklist?: InspectionCheckItem[]
          overall_comment?: string | null
          grade?: InspectionGrade | null
          ai_comment?: string | null
          photos?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          property_id?: string | null
          property_title?: string
          address?: string
          status?: InspectionStatus
          scheduled_date?: string | null
          completed_date?: string | null
          checklist?: InspectionCheckItem[]
          overall_comment?: string | null
          grade?: InspectionGrade | null
          ai_comment?: string | null
          photos?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      rental_properties: {
        Row: RentalProperty
        Insert: {
          id?: string
          agent_id: string
          property_id?: string | null
          address: string
          unit_number: string
          tenant_name: string
          tenant_phone: string
          deposit: number
          monthly_rent: number
          contract_start: string
          contract_end: string
          status?: RentalPropertyStatus
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          property_id?: string | null
          address?: string
          unit_number?: string
          tenant_name?: string
          tenant_phone?: string
          deposit?: number
          monthly_rent?: number
          contract_start?: string
          contract_end?: string
          status?: RentalPropertyStatus
          created_at?: string
        }
        Relationships: []
      }
      rental_payments: {
        Row: RentalPayment
        Insert: {
          id?: string
          rental_property_id: string
          payment_month: string
          amount: number
          is_paid?: boolean
          paid_date?: string | null
          memo?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          rental_property_id?: string
          payment_month?: string
          amount?: number
          is_paid?: boolean
          paid_date?: string | null
          memo?: string | null
          created_at?: string
        }
        Relationships: []
      }
      repair_requests: {
        Row: RepairRequest
        Insert: {
          id?: string
          rental_property_id: string
          title: string
          description: string
          photos?: string[]
          status?: RepairRequestStatus
          requested_at?: string
          completed_at?: string | null
          cost?: number | null
          memo?: string | null
        }
        Update: {
          id?: string
          rental_property_id?: string
          title?: string
          description?: string
          photos?: string[]
          status?: RepairRequestStatus
          requested_at?: string
          completed_at?: string | null
          cost?: number | null
          memo?: string | null
        }
        Relationships: []
      }
      rental_share_links: {
        Row: RentalShareLink
        Insert: {
          id?: string
          rental_property_id: string
          token: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          rental_property_id?: string
          token?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      shared_properties: {
        Row: SharedProperty
        Insert: {
          id?: string
          property_id: string
          agent_id: string
          agent_name: string
          office_name: string
          commission_ratio?: number
          is_active?: boolean
          property_title: string
          address: string
          transaction_type: TransactionType
          sale_price?: number | null
          deposit?: number | null
          monthly_rent?: number | null
          exclusive_area_m2?: number | null
          photos?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          agent_id?: string
          agent_name?: string
          office_name?: string
          commission_ratio?: number
          is_active?: boolean
          property_title?: string
          address?: string
          transaction_type?: TransactionType
          sale_price?: number | null
          deposit?: number | null
          monthly_rent?: number | null
          exclusive_area_m2?: number | null
          photos?: string[]
          created_at?: string
        }
        Relationships: []
      }
      co_brokerage_requests: {
        Row: CoBrokerageRequest
        Insert: {
          id?: string
          shared_property_id: string
          requester_agent_id: string
          requester_name: string
          requester_office: string
          requester_phone: string
          status?: CoBrokerageRequestStatus
          message: string
          commission_ratio?: number | null
          property_title: string
          address: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shared_property_id?: string
          requester_agent_id?: string
          requester_name?: string
          requester_office?: string
          requester_phone?: string
          status?: CoBrokerageRequestStatus
          message?: string
          commission_ratio?: number | null
          property_title?: string
          address?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_settings: {
        Row: AgentSetting
        Insert: {
          id?: string
          agent_id: string
          setting_key: string
          setting_value?: Record<string, unknown>
          updated_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          setting_key?: string
          setting_value?: Record<string, unknown>
          updated_at?: string
        }
        Relationships: []
      }
      custom_domains: {
        Row: CustomDomain
        Insert: {
          id?: string
          agent_id: string
          domain: string
          is_verified?: boolean
          verification_token?: string
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_id?: string
          domain?: string
          is_verified?: boolean
          verification_token?: string
          verified_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      reserved_slugs: {
        Row: { slug: string }
        Insert: { slug: string }
        Update: { slug?: string }
        Relationships: []
      }
      login_records: {
        Row: {
          id: string
          user_id: string
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: []
      }
      billing_subscriptions: {
        Row: BillingSubscription
        Insert: {
          id?: string
          agent_id: string
          customer_key: string
          billing_key: string
          card_company?: string | null
          card_last4?: string | null
          plan: 'basic' | 'pro'
          status?: 'active' | 'canceled' | 'past_due'
          pending_plan?: 'free' | 'basic' | 'pro' | null
          cancel_at_period_end?: boolean
          current_period_start?: string
          current_period_end: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          billing_key?: string
          card_company?: string | null
          card_last4?: string | null
          plan?: 'basic' | 'pro'
          status?: 'active' | 'canceled' | 'past_due'
          pending_plan?: 'free' | 'basic' | 'pro' | null
          cancel_at_period_end?: boolean
          current_period_start?: string
          current_period_end?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: PaymentHistory
        Insert: {
          id?: string
          agent_id: string
          order_id: string
          plan?: string | null
          amount: number
          status: string
          method?: string | null
          receipt_url?: string | null
          payment_key?: string | null
          approved_at?: string | null
          raw?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          status?: string
          method?: string | null
          receipt_url?: string | null
          payment_key?: string | null
          approved_at?: string | null
          raw?: Record<string, unknown> | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_inquiry_number: {
        Args: Record<string, never>
        Returns: string
      }
      generate_contract_number: {
        Args: Record<string, never>
        Returns: string
      }
      validate_invite_code: {
        Args: { _code: string }
        Returns: { office_name: string; agent_profile_id: string }[]
      }
      resolve_tenant_by_slug: {
        Args: { _slug: string }
        Returns: TenantProfile[]
      }
      resolve_tenant_by_domain: {
        Args: { _domain: string }
        Returns: TenantProfile[]
      }
      admin_get_all_agents: {
        Args: Record<string, never>
        Returns: {
          agent_id: string
          user_id: string
          email: string
          display_name: string
          office_name: string
          representative: string
          slug: string | null
          subscription_plan: string
          is_verified: boolean
          created_at: string
          property_count: number
        }[]
      }
      admin_update_agent_plan: {
        Args: { target_agent_id: string; new_plan: string }
        Returns: undefined
      }
      admin_verify_agent: {
        Args: { target_agent_id: string; verified: boolean }
        Returns: undefined
      }
      get_my_subscription: {
        Args: Record<string, never>
        Returns: MySubscription[]
      }
    }
    Enums: {
      user_role: UserRole
      staff_role: StaffRole
      transaction_type: TransactionType
      property_status: PropertyStatus
      inquiry_type: InquiryType
      inquiry_status: InquiryStatus
      customer_type: CustomerType
      customer_source: CustomerSource
      activity_type: ActivityType
      contract_template_type: ContractTemplateType
      contract_status: ContractStatus
      contract_step_type: ContractStepType
      ai_generation_type: AIGenerationType
      inspection_status: InspectionStatus
      check_item_status: CheckItemStatus
      inspection_grade: InspectionGrade
      rental_property_status: RentalPropertyStatus
      repair_request_status: RepairRequestStatus
      co_brokerage_request_status: CoBrokerageRequestStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
