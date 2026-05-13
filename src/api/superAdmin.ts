import { supabase } from '@/api/supabase'

export type AdminAgent = {
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
}

export async function fetchAllAgents(): Promise<AdminAgent[]> {
  const { data, error } = await supabase.rpc('admin_get_all_agents')
  if (error) throw error
  return data ?? []
}

export async function updateAgentPlan(agentId: string, plan: string): Promise<void> {
  const { error } = await supabase.rpc('admin_update_agent_plan', {
    target_agent_id: agentId,
    new_plan: plan,
  })
  if (error) throw error
}

export async function verifyAgent(agentId: string, verified: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_verify_agent', {
    target_agent_id: agentId,
    verified,
  })
  if (error) throw error
}
