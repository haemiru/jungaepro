import { create } from 'zustand'
import { fetchFeatureSettings } from '@/api/settings'
import { isFeatureInPlan } from '@/config/planFeatures'
import type { PlanType } from '@/types/database'

interface FeatureState {
  features: Record<string, boolean>
  plan: PlanType
  isLoaded: boolean
  initialize: () => Promise<void>
  setPlan: (plan: PlanType) => void
  isEnabled: (key: string) => boolean
}

// Mapping from sidebar nav keys to feature_key(s)
const NAV_FEATURE_MAP: Record<string, string[]> = {
  dashboard: [], // always visible
  properties: ['properties'],
  inquiries: ['inquiries'],
  customers: ['crm'],
  contracts: ['contracts'],
  'ai-tools': ['ai_description', 'ai_legal_review', 'ai_reply_draft'],
  analytics: ['avm', 'roi_calculator', 'location_report', 'buy_sell_signal'],
  'co-brokerage': ['co_brokerage'],
  inspection: ['inspection'],
  'rental-mgmt': ['rental_mgmt'],
  legal: ['registry'],
}

export const useFeatureStore = create<FeatureState>((set, get) => ({
  features: {},
  plan: 'free',
  isLoaded: false,

  initialize: async () => {
    try {
      const settings = await fetchFeatureSettings()
      const features: Record<string, boolean> = {}
      for (const s of settings) {
        features[s.feature_key] = s.is_enabled
      }
      set({ features, isLoaded: true })
    } catch {
      // Default: all enabled
      set({ isLoaded: true })
    }
  },

  setPlan: (plan: PlanType) => set({ plan }),

  isEnabled: (key: string) => {
    const { features, plan } = get()
    // Must be in plan AND manually enabled (toggle)
    if (!isFeatureInPlan(key, plan)) return false
    return features[key] !== false
  },
}))

/** Check if a sidebar nav item should be visible */
export function isNavItemVisible(navKey: string, features: Record<string, boolean>, plan: PlanType): boolean {
  const featureKeys = NAV_FEATURE_MAP[navKey]
  if (!featureKeys || featureKeys.length === 0) return true // always visible (e.g., dashboard)
  // Visible if at least one related feature is in the plan AND enabled
  return featureKeys.some((fk) => isFeatureInPlan(fk, plan) && features[fk] !== false)
}

/** Check if a nav item is locked (exists but not in current plan) */
export function isNavItemLocked(navKey: string, plan: PlanType): boolean {
  const featureKeys = NAV_FEATURE_MAP[navKey]
  if (!featureKeys || featureKeys.length === 0) return false
  return !featureKeys.some((fk) => isFeatureInPlan(fk, plan))
}

/** Get the minimum required plan for a nav item */
export function getRequiredPlan(navKey: string): PlanType {
  const featureKeys = NAV_FEATURE_MAP[navKey]
  if (!featureKeys || featureKeys.length === 0) return 'free'
  const plans: PlanType[] = ['free', 'basic', 'pro']
  for (const p of plans) {
    if (featureKeys.some((fk) => isFeatureInPlan(fk, p))) return p
  }
  return 'pro'
}

// Mapping from sidebar nav keys to staff permission keys
const NAV_PERMISSION_MAP: Record<string, string> = {
  properties: 'property_create',
  customers: 'customer_view',
  contracts: 'contract_create',
  'ai-tools': 'ai_tools',
  'co-brokerage': 'co_brokerage',
  settings: 'settings',
}

/** Check if a nav item is permitted for the current staff member */
export function isNavItemPermitted(navKey: string, userRole: string | undefined, staffPermissions: Record<string, boolean> | null): boolean {
  // Non-staff (agent) → all permitted
  if (userRole !== 'staff') return true
  const permKey = NAV_PERMISSION_MAP[navKey]
  // No mapping (dashboard, inquiries, analytics, legal, inspection, rental-mgmt) → always permitted
  if (!permKey) return true
  // Staff with no permissions loaded → deny mapped items
  if (!staffPermissions) return false
  return staffPermissions[permKey] === true
}
