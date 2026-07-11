import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { UserLayout } from '@/layouts/UserLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { PlanGate } from '@/components/common/PlanGate'
import { TenantGate } from '@/components/common/TenantGate'
import { RouteError } from '@/components/common/ErrorBoundary'
import { NotFoundPage } from '@/pages/NotFoundPage'

// ─── 배포 후 chunk 파일 변경 시 자동 새로고침 ────────────
function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch(() => {
      const hasReloaded = sessionStorage.getItem('chunk_reload')
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1')
        window.location.reload()
        return new Promise<{ default: T }>(() => {}) // 새로고침 중 빈 Promise
      }
      sessionStorage.removeItem('chunk_reload')
      throw new Error('페이지를 불러올 수 없습니다. 새로고침 해주세요.')
    })
  )
}

// 새로고침 성공 시 플래그 제거
sessionStorage.removeItem('chunk_reload')

// ─── Lazy-loaded pages ────────────────────────────────

// Auth
const LoginPage = lazyWithRetry(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazyWithRetry(() => import('@/pages/auth/SignupPage').then((m) => ({ default: m.SignupPage })))
const CallbackPage = lazyWithRetry(() => import('@/pages/auth/CallbackPage').then((m) => ({ default: m.CallbackPage })))

// User
const HomePage = lazyWithRetry(() => import('@/pages/user/HomePage').then((m) => ({ default: m.HomePage })))
const SearchPage = lazyWithRetry(() => import('@/pages/user/SearchPage').then((m) => ({ default: m.SearchPage })))
const PropertyDetailPage = lazyWithRetry(() => import('@/pages/user/PropertyDetailPage').then((m) => ({ default: m.PropertyDetailPage })))
const MyInquiriesPage = lazyWithRetry(() => import('@/pages/user/MyInquiriesPage').then((m) => ({ default: m.MyInquiriesPage })))
const MyContractsPage = lazyWithRetry(() => import('@/pages/user/MyContractsPage').then((m) => ({ default: m.MyContractsPage })))
const MyContractDetailPage = lazyWithRetry(() => import('@/pages/user/MyContractsPage').then((m) => ({ default: m.MyContractDetailPage })))
const MoveInGuidePage = lazyWithRetry(() => import('@/pages/user/MoveInGuidePage').then((m) => ({ default: m.MoveInGuidePage })))
const MarketInfoPage = lazyWithRetry(() => import('@/pages/user/MarketInfoPage').then((m) => ({ default: m.MarketInfoPage })))
const FavoritesPage = lazyWithRetry(() => import('@/pages/user/FavoritesPage').then((m) => ({ default: m.FavoritesPage })))

// Admin
const DashboardPage = lazyWithRetry(() => import('@/pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const PropertiesPage = lazyWithRetry(() => import('@/pages/admin/PropertiesPage').then((m) => ({ default: m.PropertiesPage })))
const PropertyFormPage = lazyWithRetry(() => import('@/pages/admin/PropertyFormPage').then((m) => ({ default: m.PropertyFormPage })))
const InquiriesPage = lazyWithRetry(() => import('@/pages/admin/InquiriesPage').then((m) => ({ default: m.InquiriesPage })))
const InquiryDetailPage = lazyWithRetry(() => import('@/pages/admin/InquiryDetailPage').then((m) => ({ default: m.InquiryDetailPage })))
const CustomersPage = lazyWithRetry(() => import('@/pages/admin/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const CustomerDetailPage = lazyWithRetry(() => import('@/pages/admin/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })))
const ContractsPage = lazyWithRetry(() => import('@/pages/admin/ContractsPage').then((m) => ({ default: m.ContractsPage })))
const ContractFormPage = lazyWithRetry(() => import('@/pages/admin/ContractFormPage').then((m) => ({ default: m.ContractFormPage })))
const ContractTrackerPage = lazyWithRetry(() => import('@/pages/admin/ContractTrackerPage').then((m) => ({ default: m.ContractTrackerPage })))
const ConfirmationDocPage = lazyWithRetry(() => import('@/pages/admin/ConfirmationDocPage').then((m) => ({ default: m.ConfirmationDocPage })))
const AIDescriptionPage = lazyWithRetry(() => import('@/pages/admin/AIDescriptionPage').then((m) => ({ default: m.AIDescriptionPage })))
const ValuationPage = lazyWithRetry(() => import('@/pages/admin/ValuationPage').then((m) => ({ default: m.ValuationPage })))
const ROICalculatorPage = lazyWithRetry(() => import('@/pages/admin/ROICalculatorPage').then((m) => ({ default: m.ROICalculatorPage })))
const LocationAnalysisPage = lazyWithRetry(() => import('@/pages/admin/LocationAnalysisPage').then((m) => ({ default: m.LocationAnalysisPage })))
const SignalPage = lazyWithRetry(() => import('@/pages/admin/SignalPage').then((m) => ({ default: m.SignalPage })))
const InspectionListPage = lazyWithRetry(() => import('@/pages/admin/InspectionListPage').then((m) => ({ default: m.InspectionListPage })))
const InspectionChecklistPage = lazyWithRetry(() => import('@/pages/admin/InspectionChecklistPage').then((m) => ({ default: m.InspectionChecklistPage })))
const InspectionReportPage = lazyWithRetry(() => import('@/pages/admin/InspectionReportPage').then((m) => ({ default: m.InspectionReportPage })))
const RentalManagementPage = lazyWithRetry(() => import('@/pages/admin/RentalManagementPage').then((m) => ({ default: m.RentalManagementPage })))
const RentalDetailPage = lazyWithRetry(() => import('@/pages/admin/RentalDetailPage').then((m) => ({ default: m.RentalDetailPage })))
const RentalSharePage = lazyWithRetry(() => import('@/pages/admin/RentalSharePage').then((m) => ({ default: m.RentalSharePage })))
const CoBrokeragePoolPage = lazyWithRetry(() => import('@/pages/admin/CoBrokeragePoolPage').then((m) => ({ default: m.CoBrokeragePoolPage })))
const CoBrokerageRequestsPage = lazyWithRetry(() => import('@/pages/admin/CoBrokerageRequestsPage').then((m) => ({ default: m.CoBrokerageRequestsPage })))

// Super Admin
const SuperAdminPage = lazyWithRetry(() => import('@/pages/super-admin/SuperAdminPage').then((m) => ({ default: m.SuperAdminPage })))

// Settings
const SettingsLayout = lazyWithRetry(() => import('@/pages/admin/settings/SettingsLayout').then((m) => ({ default: m.SettingsLayout })))
const OfficeSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/OfficeSettingsPage').then((m) => ({ default: m.OfficeSettingsPage })))
const StaffSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/StaffSettingsPage').then((m) => ({ default: m.StaffSettingsPage })))
const FeatureSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/FeatureSettingsPage').then((m) => ({ default: m.FeatureSettingsPage })))
const CategorySettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/CategorySettingsPage').then((m) => ({ default: m.CategorySettingsPage })))
const SearchSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/SearchSettingsPage').then((m) => ({ default: m.SearchSettingsPage })))
const UnitSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/UnitSettingsPage').then((m) => ({ default: m.UnitSettingsPage })))
const FloatingSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/FloatingSettingsPage').then((m) => ({ default: m.FloatingSettingsPage })))
const NotificationSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/NotificationSettingsPage').then((m) => ({ default: m.NotificationSettingsPage })))
const IntegrationSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/IntegrationSettingsPage').then((m) => ({ default: m.IntegrationSettingsPage })))
const BillingSettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/BillingSettingsPage').then((m) => ({ default: m.BillingSettingsPage })))
const SecuritySettingsPage = lazyWithRetry(() => import('@/pages/admin/settings/SecuritySettingsPage').then((m) => ({ default: m.SecuritySettingsPage })))

// ─── Suspense wrapper ─────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
function PageLoader() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

// ─── Router ───────────────────────────────────────────

export const router = createBrowserRouter([
  // Auth routes (public)
  {
    path: '/auth',
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      { path: 'login', element: <S><LoginPage /></S> },
      { path: 'signup', element: <S><SignupPage /></S> },
    ],
  },
  { path: '/auth/callback', element: <S><CallbackPage /></S>, errorElement: <RouteError /> },

  // User portal (public) — wrapped in TenantGate for multi-tenant routing
  {
    path: '/',
    element: <TenantGate><UserLayout /></TenantGate>,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <S><HomePage /></S> },
      { path: 'search', element: <S><SearchPage /></S> },
      { path: 'properties/:id', element: <S><PropertyDetailPage /></S> },
      { path: 'my/inquiries', element: <S><MyInquiriesPage /></S> },
      { path: 'my/contracts', element: <S><MyContractsPage /></S> },
      { path: 'my/contracts/:id', element: <S><MyContractDetailPage /></S> },
      { path: 'my/move-in-guide/:contractId', element: <S><MoveInGuidePage /></S> },
      { path: 'favorites', element: <S><FavoritesPage /></S> },
      { path: 'market-info', element: <S><MarketInfoPage /></S> },
    ],
  },

  // Admin portal (agent, staff only) — TenantGate blocks access from www/root domain
  {
    path: '/admin',
    element: (
      <TenantGate>
        <ProtectedRoute allowedRoles={['agent', 'staff']}>
          <AdminLayout />
        </ProtectedRoute>
      </TenantGate>
    ),
    errorElement: <RouteError />,
    children: [
      { path: 'dashboard', element: <S><DashboardPage /></S> },
      { path: 'properties', element: <S><PropertiesPage /></S> },
      { path: 'properties/new', element: <S><PropertyFormPage /></S> },
      { path: 'properties/:id', element: <S><PropertyFormPage /></S> },
      { path: 'inquiries', element: <S><InquiriesPage /></S> },
      { path: 'inquiries/:id', element: <S><InquiryDetailPage /></S> },
      { path: 'customers', element: <S><CustomersPage /></S> },
      { path: 'customers/:id', element: <S><CustomerDetailPage /></S> },
      { path: 'contracts', element: <S><ContractsPage /></S> },
      { path: 'contracts/new', element: <S><ContractFormPage /></S> },
      { path: 'contracts/:id/edit', element: <S><ContractFormPage /></S> },
      { path: 'contracts/:id/tracker', element: <S><ContractTrackerPage /></S> },
      { path: 'contracts/:id/confirmation', element: <S><ConfirmationDocPage /></S> },
      { path: 'ai-tools', element: <PlanGate navKey="ai-tools"><S><AIDescriptionPage /></S></PlanGate> },
      { path: 'ai-tools/description', element: <PlanGate navKey="ai-tools"><S><AIDescriptionPage /></S></PlanGate> },
      { path: 'analytics', element: <PlanGate navKey="analytics"><S><ValuationPage /></S></PlanGate> },
      { path: 'analytics/valuation', element: <PlanGate navKey="analytics"><S><ValuationPage /></S></PlanGate> },
      { path: 'analytics/roi', element: <PlanGate navKey="analytics"><S><ROICalculatorPage /></S></PlanGate> },
      { path: 'analytics/location', element: <PlanGate navKey="analytics"><S><LocationAnalysisPage /></S></PlanGate> },
      { path: 'analytics/signal', element: <PlanGate navKey="analytics"><S><SignalPage /></S></PlanGate> },
      { path: 'inspection', element: <PlanGate navKey="inspection"><S><InspectionListPage /></S></PlanGate> },
      { path: 'inspection/:id/checklist', element: <PlanGate navKey="inspection"><S><InspectionChecklistPage /></S></PlanGate> },
      { path: 'inspection/:id/report', element: <PlanGate navKey="inspection"><S><InspectionReportPage /></S></PlanGate> },
      { path: 'rental-mgmt', element: <PlanGate navKey="rental-mgmt"><S><RentalManagementPage /></S></PlanGate> },
      { path: 'rental-mgmt/:id', element: <PlanGate navKey="rental-mgmt"><S><RentalDetailPage /></S></PlanGate> },
      { path: 'rental-mgmt/share/:token', element: <S><RentalSharePage /></S> },
      { path: 'co-brokerage', element: <PlanGate navKey="co-brokerage"><S><CoBrokeragePoolPage /></S></PlanGate> },
      { path: 'co-brokerage/pool', element: <PlanGate navKey="co-brokerage"><S><CoBrokeragePoolPage /></S></PlanGate> },
      { path: 'co-brokerage/requests', element: <PlanGate navKey="co-brokerage"><S><CoBrokerageRequestsPage /></S></PlanGate> },
      {
        path: 'settings',
        element: <S><SettingsLayout /></S>,
        children: [
          { path: 'office', element: <S><OfficeSettingsPage /></S> },
          { path: 'staff', element: <S><StaffSettingsPage /></S> },
          { path: 'features', element: <S><FeatureSettingsPage /></S> },
          { path: 'categories', element: <S><CategorySettingsPage /></S> },
          { path: 'search', element: <S><SearchSettingsPage /></S> },
          { path: 'units', element: <S><UnitSettingsPage /></S> },
          { path: 'floating', element: <S><FloatingSettingsPage /></S> },
          { path: 'notifications', element: <S><NotificationSettingsPage /></S> },
          { path: 'integrations', element: <S><IntegrationSettingsPage /></S> },
          { path: 'billing', element: <S><BillingSettingsPage /></S> },
          { path: 'security', element: <S><SecuritySettingsPage /></S> },
        ],
      },
    ],
  },

  // Super Admin (권한은 컴포넌트/라우트 가드에서 확인)
  { path: '/super-admin', element: <S><SuperAdminPage /></S>, errorElement: <RouteError /> },

  // 404
  { path: '*', element: <NotFoundPage /> },
])
