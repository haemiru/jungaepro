import { NavLink } from 'react-router-dom'
import { useNotificationStore } from '@/stores/notificationStore'
import { useFeatureStore, isNavItemPermitted, isNavItemLocked, getRequiredPlan } from '@/stores/featureStore'
import { useAuthStore } from '@/stores/authStore'
import { PLAN_INFO } from '@/config/planFeatures'

export type AdminNavItem = {
  key: string
  label: string
  path: string
  icon: string
  badge?: number
}

const baseNavItems: Omit<AdminNavItem, 'badge'>[] = [
  { key: 'dashboard', label: '대시보드', path: '/admin/dashboard', icon: '📊' },
  { key: 'properties', label: '매물 관리', path: '/admin/properties', icon: '🏠' },
  { key: 'inquiries', label: '문의 관리', path: '/admin/inquiries', icon: '📩' },
  { key: 'customers', label: '고객 관리', path: '/admin/customers', icon: '👥' },
  { key: 'contracts', label: '계약 관리', path: '/admin/contracts', icon: '📝' },
  { key: 'ai-tools', label: 'AI 도구', path: '/admin/ai-tools', icon: '🤖' },
  { key: 'analytics', label: '데이터 분석', path: '/admin/analytics', icon: '📈' },
  { key: 'co-brokerage', label: '공동중개', path: '/admin/co-brokerage', icon: '🤝' },
  { key: 'inspection', label: '임장 관리', path: '/admin/inspection', icon: '🔍' },
  { key: 'rental-mgmt', label: '임대 관리', path: '/admin/rental-mgmt', icon: '🏢' },
  { key: 'legal', label: '등기부등본', path: '/admin/legal/registry', icon: '⚖️' },
]

interface AdminSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const { unansweredInquiryCount } = useNotificationStore()
  const { plan, isLoaded } = useFeatureStore()
  const { user, staffPermissions } = useAuthStore()

  // Show all nav items but mark locked ones — filter only by staff permissions
  const visibleItems = isLoaded
    ? baseNavItems.filter((item) => isNavItemPermitted(item.key, user?.role, staffPermissions))
    : baseNavItems

  const showSettings = isNavItemPermitted('settings', user?.role, staffPermissions)

  const mainNavItems: AdminNavItem[] = visibleItems.map((item) => ({
    ...item,
    badge: item.key === 'inquiries' ? unansweredInquiryCount : undefined,
  }))

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        role="navigation"
        aria-label="관리자 메뉴"
        className={`fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-gray-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {mainNavItems.map((item) => {
              const locked = isLoaded && isNavItemLocked(item.key, plan)
              const reqPlan = locked ? getRequiredPlan(item.key) : null
              const planLabel = reqPlan ? (PLAN_INFO[reqPlan]?.label ?? reqPlan) : null
              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      locked
                        ? 'text-gray-400 hover:bg-gray-50'
                        : isActive
                          ? 'bg-primary-50 font-medium text-primary-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                >
                  <span className={`text-base ${locked ? 'opacity-50' : ''}`}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {locked && planLabel && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-400">{planLabel}</span>
                  )}
                  {!locked && item.badge != null && item.badge > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Bottom: Settings */}
          {showSettings && (
            <div className="border-t border-gray-200 p-3">
              <NavLink
                to="/admin/settings"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-50 font-medium text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <span className="text-base">⚙️</span>
                <span>환경설정</span>
              </NavLink>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
