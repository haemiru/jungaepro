import { supabase } from '@/api/supabase'
import { getCurrentUserId } from '@/api/helpers'
import type { RentalProperty, RentalPayment, RepairRequest, RentalPropertyStatus, RepairRequestStatus } from '@/types/database'

export async function fetchRentalProperties(filter?: RentalPropertyStatus | 'all'): Promise<RentalProperty[]> {
  const agentId = await getCurrentUserId()
  let query = supabase.from('rental_properties').select('*').eq('agent_id', agentId)

  if (filter && filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchRentalPropertyById(id: string): Promise<RentalProperty | null> {
  const { data, error } = await supabase
    .from('rental_properties')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function createRentalProperty(data: Omit<RentalProperty, 'id' | 'agent_id' | 'created_at'>): Promise<RentalProperty> {
  const agentId = await getCurrentUserId()

  const { data: rp, error } = await supabase
    .from('rental_properties')
    .insert({ ...data, agent_id: agentId })
    .select()
    .single()

  if (error) throw error
  return rp
}

export async function updateRentalProperty(id: string, data: Partial<RentalProperty>): Promise<RentalProperty | null> {
  const { data: rp, error } = await supabase
    .from('rental_properties')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return rp
}

export async function fetchPayments(rentalPropertyId: string): Promise<RentalPayment[]> {
  const { data, error } = await supabase
    .from('rental_payments')
    .select('*')
    .eq('rental_property_id', rentalPropertyId)
    .order('payment_month', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function togglePaymentStatus(paymentId: string): Promise<RentalPayment | null> {
  // Fetch current state
  const { data: current, error: fetchError } = await supabase
    .from('rental_payments')
    .select('*')
    .eq('id', paymentId)
    .single()

  if (fetchError) {
    if (fetchError.code === 'PGRST116') return null
    throw fetchError
  }

  const isPaid = !current.is_paid
  const { data: updated, error } = await supabase
    .from('rental_payments')
    .update({
      is_paid: isPaid,
      paid_date: isPaid ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq('id', paymentId)
    .select()
    .single()

  if (error) throw error
  return updated
}

export async function fetchRepairRequests(rentalPropertyId?: string): Promise<RepairRequest[]> {
  let query = supabase.from('repair_requests').select('*')

  if (rentalPropertyId) {
    query = query.eq('rental_property_id', rentalPropertyId)
  } else {
    // No specific property — scope to this agent's rental properties
    const agentId = await getCurrentUserId()
    const { data: myProps } = await supabase
      .from('rental_properties')
      .select('id')
      .eq('agent_id', agentId)
    const propIds = (myProps ?? []).map((p) => p.id)
    if (propIds.length === 0) return []
    query = query.in('rental_property_id', propIds)
  }

  query = query.order('requested_at', { ascending: false })

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createRepairRequest(data: {
  rental_property_id: string
  title: string
  description: string
}): Promise<RepairRequest> {
  const { data: req, error } = await supabase
    .from('repair_requests')
    .insert({
      rental_property_id: data.rental_property_id,
      title: data.title,
      description: data.description,
    })
    .select()
    .single()

  if (error) throw error
  return req
}

export async function updateRepairStatus(id: string, status: RepairRequestStatus, memo?: string, cost?: number): Promise<RepairRequest | null> {
  const updateData: Record<string, unknown> = { status }
  if (memo !== undefined) updateData.memo = memo
  if (cost !== undefined) updateData.cost = cost
  if (status === 'completed') updateData.completed_at = new Date().toISOString()

  const { data: req, error } = await supabase
    .from('repair_requests')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return req
}

// Dashboard summary
export async function fetchRentalSummary(): Promise<{
  totalProperties: number
  currentMonthCollectionRate: number
  expiringCount: number
  pendingRepairs: number
}> {
  const agentId = await getCurrentUserId()

  // Total occupied/expiring properties
  const { count: totalCount } = await supabase
    .from('rental_properties')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .neq('status', 'vacant')

  // Expiring count
  const { count: expiringCount } = await supabase
    .from('rental_properties')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('status', 'expiring')

  // Agent's rental property IDs for scoping payments and repairs
  const { data: myProps } = await supabase
    .from('rental_properties')
    .select('id')
    .eq('agent_id', agentId)
  const propIds = (myProps ?? []).map((p) => p.id)

  // Pending repairs
  let pendingRepairs = 0
  if (propIds.length > 0) {
    const { count } = await supabase
      .from('repair_requests')
      .select('*', { count: 'exact', head: true })
      .in('rental_property_id', propIds)
      .neq('status', 'completed')
    pendingRepairs = count ?? 0
  }

  // Current month collection rate
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  let currentPayments: { is_paid: boolean }[] | null = null
  if (propIds.length > 0) {
    const { data } = await supabase
      .from('rental_payments')
      .select('is_paid')
      .in('rental_property_id', propIds)
      .like('payment_month', `${currentMonth}%`)
    currentPayments = data
  }

  const total = currentPayments?.length ?? 0
  const paid = currentPayments?.filter((p) => p.is_paid).length ?? 0
  const collectionRate = total > 0 ? Math.round((paid / total) * 100) : 100

  return {
    totalProperties: totalCount ?? 0,
    currentMonthCollectionRate: collectionRate,
    expiringCount: expiringCount ?? 0,
    pendingRepairs: pendingRepairs ?? 0,
  }
}

// Share link
export async function createShareLink(rentalPropertyId: string, expiresInDays: number): Promise<{ token: string; url: string }> {
  const token = `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const expires = new Date()
  expires.setDate(expires.getDate() + expiresInDays)

  const { error } = await supabase
    .from('rental_share_links')
    .insert({
      rental_property_id: rentalPropertyId,
      token,
      expires_at: expires.toISOString(),
    })

  if (error) throw error
  return { token, url: `/admin/rental-mgmt/share/${token}` }
}

// fetchShareData — 공유 링크용 공개 조회 (RLS 공개 읽기 정책 기반)
export async function fetchShareData(token: string): Promise<{
  property: RentalProperty
  payments: RentalPayment[]
  repairs: RepairRequest[]
} | null> {
  // Attempt DB fetch — share links are public reads
  const { data: link, error: linkError } = await supabase
    .from('rental_share_links')
    .select('*')
    .eq('token', token)
    .single()

  if (linkError || !link) return null
  if (new Date(link.expires_at) < new Date()) return null

  const { data: property } = await supabase
    .from('rental_properties')
    .select('*')
    .eq('id', link.rental_property_id)
    .single()

  if (!property) return null

  const { data: payments } = await supabase
    .from('rental_payments')
    .select('*')
    .eq('rental_property_id', property.id)
    .order('payment_month', { ascending: false })

  const { data: repairs } = await supabase
    .from('repair_requests')
    .select('*')
    .eq('rental_property_id', property.id)
    .order('requested_at', { ascending: false })

  return {
    property,
    payments: payments ?? [],
    repairs: repairs ?? [],
  }
}
