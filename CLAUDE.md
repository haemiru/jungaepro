# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Jungaepro** (구 Smart Home) — 공인중개사 올인원 업무 플랫폼. 매물 관리, 계약, CRM, 문의, AI 도구, 통계, 법률/서식, 공동중개, 현장점검, 임대 관리 등을 하나의 웹앱에서 제공.

## Commands

```bash
npm run dev      # Vite dev server (port 5173)
npm run build    # TypeScript check + production build → dist/
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Tech Stack

- **React 19** + TypeScript + Vite 7
- **Tailwind CSS v4** (`@tailwindcss/vite` plugin, no config file — customization in `src/styles/index.css` via `@theme` and `@utility`)
- **Zustand** for state management (stores in `src/stores/`)
- **React Router v6** — `createBrowserRouter` in `src/router.tsx`
- **Supabase** (PostgreSQL, Auth, Storage, Realtime) — client in `src/api/supabase.ts`
- **react-hot-toast** for notifications
- Deployment: Vercel (`vercel.json`) or Netlify (`public/_redirects`)

## Architecture

### Multi-Tenant Subdomain Architecture

Each agent gets a subdomain: `{slug}.smarthome.co.kr`. Pro+ plans can also use custom domains.

- **Tenant Resolution** (`src/utils/tenantResolver.ts`): parses `window.location.hostname` to identify tenant source (slug, custom_domain, landing, dev_default)
- **Tenant Store** (`src/stores/tenantStore.ts`): Zustand store holding resolved `TenantProfile`, `agentId`, and status (`loading` | `resolved` | `not_found` | `landing`)
- **TenantGate** (`src/components/common/TenantGate.tsx`): wraps User Portal routes — shows `LandingPage` for platform root, `TenantNotFoundPage` for invalid slugs, or children for resolved tenants
- **Initialization**: `App.tsx` runs `initTenant()` in parallel with `initAuth() → initFeatures()`
- **Data Scoping**: all User Portal API calls accept optional `agentId` param from tenant store
- **Dynamic Branding**: `UserGNB` and `UserFooter` display tenant's logo, office name, address, etc.
- **Admin Slug Management**: `OfficeSettingsPage` includes subdomain input with real-time availability check
- **Dev Environment**: `localhost:5173` uses `VITE_DEV_TENANT_SLUG` env var or falls back to mock tenant
- **DB**: `agent_profiles.slug` (unique, 3-63 chars), `custom_domains` table, `reserved_slugs` table, RPC functions `resolve_tenant_by_slug()` and `resolve_tenant_by_domain()`

### Dual Portal System

Two independent portals with separate layouts:

1. **User Portal** (`/`) — public browsing portal (wrapped in `TenantGate`)
   - `UserLayout`: `UserGNB` (desktop menu + mobile hamburger) → content → `UserFooter` → `UserMobileNav` (mobile bottom tabs) → `FloatingFAB`
   - Homepage: Hero search → Category tabs → 2-column (sidebar filters + property grid) → Quick search → AI recommendations → Carousel → Hot issues → Links
   - All data queries scoped to tenant's `agentId` via `useTenantStore`

2. **Admin Portal** (`/admin/*`) — agent/staff only (ProtectedRoute + RBAC)
   - `AdminLayout`: `AdminHeader` (search + notifications + profile dropdown) → `AdminSidebar` (desktop) / `AdminMobileNav` (mobile bottom tabs) → content
   - Sidebar items driven by `agent_feature_settings` (feature ON/OFF per agent)

### Admin Dashboard

- **Dashboard** (`/admin/dashboard`) — 7-section overview:
  1. Summary cards (4-grid): new inquiries, active contracts, properties, customers — clickable → respective pages
  2. Monthly performance: registrations, contracts closed, total transaction amount + BarChart trend
  3. Unanswered inquiries (top 5) with status icons and relative time
  4. Today's schedule: today/tomorrow inspection appointments
  5. Property stats (top 5): horizontal bar chart — views, inquiries, favorites
  6. Activity feed: 10-item timeline with icons and links
  7. Todo list: auto-generated items (unanswered inquiries, upcoming payments, repair requests) with checkbox
- Mock API in `src/api/dashboard.ts` — aggregated dashboard data

### Routing

- `src/router.tsx` — central route definition with **React.lazy + Suspense** code splitting for all pages
- User portal routes are **public** (no auth required for browsing)
- Admin portal routes require `agent` or `staff` role
- Auth pages: `/auth/login`, `/auth/signup`, `/auth/callback`

### Auth Flow

- Supabase Auth: email/password (with email verification) + Google OAuth
- Signup is multi-step: role selection → account info → agent office info (if agent)
- Agent accounts require admin verification (`is_verified`) before full feature access
- Auth state managed in `src/stores/authStore.ts` — initializes on app mount, listens for auth changes via `onAuthStateChange`

### Homepage State

- `src/stores/homeFilterStore.ts` — Zustand store for category selection, deal type / price / area / room / floor filters, search query
- Filter data and mock property data in `src/utils/mockData.ts` — data-driven rendering to support future admin config
- `src/components/home/` — section components: `HeroSection`, `CategoryTabs`, `PropertyFilters` (sidebar + chips), `PropertyCard`, `PropertyGrid`, `QuickSearchGrid`, `AIRecommendations`, `UrgentCarousel`, `HotIssuesSection`, `RelatedLinksSection`

### Feature Modules

Each feature lives in `src/features/{name}/` with its own `components/`, `hooks/`, `utils/` subdirectories:

`auth`, `properties`, `contracts`, `crm`, `inquiries`, `ai-tools`, `analytics`, `legal`, `co-brokerage`, `inspection`, `rental-mgmt`, `settings`

### Inquiry System

- User portal: FloatingFAB + PropertyDetailPage inquiry modals → `createInquiry()` → shows inquiry number (INQ-YYYYMMDD-NNN)
- User portal: `/my/inquiries` — inquiry history with expandable reply view
- Admin portal: `/admin/inquiries` — table with status/type filters, unanswered count badge
- Admin portal: `/admin/inquiries/:id` — detail with reply form, AI draft (Gemini 실구현), channel selection (email/SMS — 알림톡은 카카오 비즈메시지 연동 전까지 숨김), reply draft 임시저장 (localStorage `inquiry-draft-{id}`)
- Notification store (`src/stores/notificationStore.ts`) — Zustand store for real-time notifications, integrated with AdminHeader bell + AdminSidebar badge

### CRM (Customer Management)

- `/admin/customers` — dual view: pipeline (kanban board) + list (table)
- `/admin/customers/:id` — tabs: profile, activity timeline, matching properties (문의/상담 연계 + 선호조건 검색, 실구현), consultation records (CRUD 실구현), AI 진성 분석, memo
- Customer scoring: view +5, favorite +10, inquiry +20, appointment +30, contract_view +40, 7-day inactivity -15
- Pipeline stages: lead → interest → consulting → contracting → completed
- Inquiry → CRM auto-linkage (Supabase 실연동)

### Contract System

- `/admin/contracts` — list with status tabs (작성중/서명대기/서명완료/계약완료)
- `/admin/contracts/new` — 4-step wizard: property selection → template selection → auto-mapping + manual input → preview with print
- `/admin/contracts/:id/tracker` — vertical timeline with checkable steps, D-Day display, due dates, notes, required documents
- `/my/contracts` — user-facing read-only contract list + timeline tracker with progress bar
- 12 contract templates covering apartment/officetel/commercial/building/land/factory/knowledge center (sale + lease)
- Auto-generated process steps: sale (6 steps) vs lease (8 steps)
- Template recommendation based on property category
- Required documents per step

### AI Features (Gemini 3 Pro)

- **Common**: `src/api/gemini.ts` — `generateContent(prompt, systemPrompt?)` via Supabase Edge Function (`supabase/functions/generate-content/`). API key stays server-side (`GEMINI_API_KEY` Supabase secret). Retry logic lives in the Edge Function.
- **AI Description Generator** (`/admin/ai-tools/description`) — property selection or manual input, platform (blog/naver/instagram) + tone (professional/friendly/emotional), generates 3 versions
- **AI Legal Review** — button on `/admin/contracts/:id/tracker`, reviews contract against 7 laws (공인중개사법, 민법, 주택임대차보호법, etc.), categorizes as 적합/주의/위반
- **AI Draft Reply** — button on `/admin/inquiries/:id`, generates inquiry reply draft with property context
- **AI Chatbot** — user portal floating widget (via FloatingFAB), FAQ auto-response, after-hours inquiry submission
- **AI Customer Analysis** — "진성 분석" tab on `/admin/customers/:id`, analyzes activity data, provides sincerity score, conversion probability, recommended actions
- **Move-in Guide** — admin generates via contract tracker for lease contracts, user views at `/my/move-in-guide/:contractId`
- Generation logs saved to `ai_generation_logs` table
- API key는 Supabase secret(`GEMINI_API_KEY`) — 클라이언트 env에 두지 않는다

### Data Analytics (Recharts)

- **Market Info** (`/market-info` user, `/admin/analytics/valuation` admin) — complex price trend line chart (6mo/1yr/3yr), pyeong comparison bar chart, fair value band chart (ComposedChart with Area+Line), regional price summary table
- **ROI Calculator** (`/admin/analytics/roi`) — real-time calculation: ROI, Cap Rate, monthly cashflow, break-even point. Inputs: purchase price, loan ratio, interest rate, deposit, monthly rent, taxes, vacancy rate, holding period. Leverage comparison bar chart, cumulative profit line chart
- **Location Analysis** (`/admin/analytics/location`) — address input → 6 category score bars (transport/school/amenity/foot_traffic/development/safety), grade A+~F, PDF download (jspdf + html2canvas-pro), share link
- **Buy/Sell Signal** (`/admin/analytics/signal`) — traffic light system (🟢매수적기/🟡관망/🔴매도적기), 5 weighted indicators (txVolume 25%, priceChange 25%, supplyChange 20%, interestRate 15%, unsold 15%), weighted average → threshold-based color, Seoul 12 districts + Gyeonggi 8 cities mock data
- Mock data in `src/utils/marketMockData.ts` — complexes, price trends, pyeong comparisons, fair value ranges, location profiles, signal seeds, regional summaries

### Field Inspection (임장 관리)

- **Inspection List** (`/admin/inspection`) — scheduled/in-progress/completed tabs, new inspection modal (property selection or manual input)
- **Checklist** (`/admin/inspection/:id/checklist`) — mobile-optimized UI with large touch targets, 7 categories (구조/외관, 내부 상태, 수도/배관, 전기/가스, 창호/방범, 옵션/가전, 주차/환경), 23 check items
  - Each item: 양호/보통/불량 status + note + 사진 첨부 (Supabase Storage 업로드, 항목별 1장)
  - Progress bar, offline detection (navigator.onLine), auto-save
- **Report** (`/admin/inspection/:id/report`) — auto-generated on completion, grade A~F based on good/normal/bad ratios, category breakdown bar chart, attention items list, AI analysis via Gemini
- `src/api/inspections.ts` — Supabase `inspections` 테이블 실연동 (checklist template·grade calculation은 순수 함수)

### Rental Management (임대 관리)

- **Dashboard** (`/admin/rental-mgmt`) — summary cards (properties, collection rate, expiring, repairs), property table with payment/repair status icons
- **Detail** (`/admin/rental-mgmt/:id`) — tenant/contract info, payment history table + bar chart (Recharts), repair request tickets with status management
- **Landlord Share** (`/admin/rental-mgmt/share/:token`) — read-only public page via token-based share link (30-day expiry), shows payment history, repairs, contract info
- DB tables: `rental_properties`, `rental_payments`, `repair_requests`, `rental_share_links`
- `src/api/rental.ts` — Supabase 실연동 (수납/수리/공유 링크)

### Legal/Administrative (법률 행정)

- **등기부등본 관리** (`/admin/legal/registry`) — 인터넷등기소에서 발급받은 PDF 업로드·보관·열람·삭제 (Supabase Storage). 문서 목록은 localStorage(`registry-docs`) 기반. 등기부 **조회 API 연동은 향후 업그레이드** (CODEF/하이픈 — docs/completion-plan.md 참조)
- **E-Signature** — 범위 제외 (사용자 결정). ContractTrackerPage에 UI 주석 상태로 보존, 설정 화면에서도 숨김. `src/api/legal.ts`의 mock(`lookupRegistry`/`requestSignature`)은 미사용 상태로 유지

### Co-Brokerage (공동중개)

- **Shared Property Pool** (`/admin/co-brokerage`) — card-style list of properties shared by other agents, search, stats (매매/임대), request modal with message
- **Request Management** (`/admin/co-brokerage/requests`) — tabs for received/sent requests, approve with commission ratio slider, reject with confirmation
- Information disclosure levels: basic (위치/면적/가격) → approved (상세사진/내부정보) → contracted (집주인연락처)
- DB tables: `shared_properties`, `co_brokerage_requests` (status: pending/approved/rejected)
- Mock API in `src/api/co-brokerage.ts` — 5 shared properties, 4 requests, CRUD

### Admin Settings (환경설정)

- **Settings Layout** (`/admin/settings`) — left sub-menu (desktop) / horizontal scroll tabs (mobile) + right content `<Outlet />`
- **Office Info** (`/admin/settings/office`) — form: 사무소명, 대표자, 사업자번호, 면허번호, 주소, 연락처, 팩스, 영업시간 (day-by-day), 로고 upload, 소개글, 전문 분야 (multi-select), 보증보험 정보
- **Staff** (`/admin/settings/staff`) — list table, invite modal, role assignment (lead_agent/associate_agent/assistant), permission toggle matrix (9 permissions), activate/deactivate/delete
- **Features** (`/admin/settings/features`) — 8 category groups, each feature: name + description + toggle. Locked features (🔒), Pro features, Gemini features (⚡). Disable confirmation dialog
- **Categories** (`/admin/settings/categories`) — system categories grouped by type (주거/상업/산업/토지/건물), ON/OFF toggle, reorder (UP/DOWN), custom category add modal (name/emoji/color)
- **Search** (`/admin/settings/search`) — filter group ON/OFF + order, quick search cards ON/OFF + order, result settings (sort/page size/view mode)
- **Units** (`/admin/settings/units`) — area (㎡/평), price (만원/억원), distance (m/km), date/time formats
- **Floating** (`/admin/settings/floating`) — button ON/OFF + order + URL/phone config, FAB color picker, preview
- **Notifications** (`/admin/settings/notifications`) — matrix: 7 notification types × 3 channels (push/email/alimtalk)
- **Integrations** (`/admin/settings/integrations`) — 8 external services grouped by category, connect/disconnect with URL input
- **Billing** (`/admin/settings/billing`) — current plan display, plan comparison (Free/Basic/Pro/Enterprise), payment history table
- **Security** (`/admin/settings/security`) — password change, 2FA toggle, login records table, active sessions with terminate
- Mock API in `src/api/settings.ts` — comprehensive mock data for all settings sections

### Database

- SQL migrations in `supabase/migrations/`
- Tables: `users`, `agent_profiles`, `staff_members`, `agent_feature_settings`, `properties`, `property_categories`, `property_favorites`, `inquiries`, `inquiry_replies`, `customers`, `customer_activities`, `contracts`, `contract_process`, `ai_generation_logs`, `move_in_guides`, `inspections`, `rental_properties`, `rental_payments`, `repair_requests`, `rental_share_links`, `shared_properties`, `co_brokerage_requests`, `custom_domains`, `reserved_slugs`
- All tables have Row Level Security (RLS) policies
- TypeScript types in `src/types/database.ts` — must use `type` aliases (not `interface`) for Row types to satisfy Supabase's `GenericSchema` constraint

### Feature Settings Integration

- `src/stores/featureStore.ts` — Zustand store that loads `agent_feature_settings` on app init
- `isNavItemVisible()` maps sidebar nav keys to feature keys; hides nav items when all related features are OFF
- AdminSidebar filters nav items based on feature store state
- Initialized in `App.tsx` alongside auth store

### API 연동 현황

`src/api/`의 22개 모듈 중 21개가 **실제 Supabase 연동**이다 (Auth·DB·Storage·Edge Functions). Edge Functions 4종: `generate-content`(Gemini), `send-email`(Resend), `real-trade-price`(국토부 실거래가 + `real_trade_cache`), `naver-news`. dev에서는 Vite proxy(`/api/*`), prod에서는 Edge Function 직접 호출로 서버 키를 보호한다.

**mock으로 남아 있는 부분** (외부 연동 대기 — docs/completion-plan.md Phase 4 참조):
- `src/api/legal.ts` — 등기부 조회(`lookupRegistry`)·전자서명. 현재 미사용 (UI 숨김)
- `src/api/settings.ts`의 `fetchBillingInfo` — 결제 이력/다음 결제일 하드코딩. PG(토스페이먼츠) 연동 시 교체
- `src/utils/marketMockData.ts` — 시세/시그널/입지분석 데이터 (화면에 "목업 데이터" 명시)

### Error Handling

- 전역: `src/components/common/ErrorBoundary.tsx` — 클래스 `ErrorBoundary`(App 래핑) + `RouteError`(router errorElement). 렌더 예외 시 한국어 안내 화면
- 국소: try/catch + `react-hot-toast` 패턴 (36개 파일, 199곳)

### Super Admin

- `users.is_super_admin` 플래그 기반 (마이그레이션 00027). 클라이언트(`AdminHeader`, `SuperAdminPage`)와 서버 RPC(`admin_get_all_agents` 등 3종, `is_super_admin()` 헬퍼)가 동일 기준. 이메일 하드코딩 없음
- `/super-admin` — 전체 중개사 목록, 요금제 변경, 사무소 인증 토글 + 승인 안내 메일

### Performance

- **Code splitting**: all pages use `React.lazy()` + `Suspense` with shared `PageLoader` fallback. Main bundle ~560KB (gzip ~168KB), pages split into ~60 chunks
- 지역 지도 SVG 데이터(`src/data/regionMaps.ts`, ~1.2MB)는 `RegionMapCard`에서 동적 import + React 19 `use()`로 분리 — 홈에서 지역 카드가 렌더될 때만 별도 청크로 로드
- Bundle chunks: vendor (react/react-dom), recharts (BarChart/LineChart), and individual page modules

### Maps

`src/components/common/KakaoMap.tsx`는 이름과 달리 **Leaflet + OpenStreetMap 타일** 기반이다 (매물 등록/상세의 위치 지도). 주소 검색은 Daum Postcode SDK, 지오코딩은 Kakao REST(`/api/geocode` proxy) — 유틸은 `src/utils/mapAddress.ts`. 검색 페이지의 지도 보기는 Phase 4-3에서 추가 예정 (현재 숨김).

### Path Aliases

`@/*` maps to `src/*` (configured in both `tsconfig.app.json` and `vite.config.ts`)

### Custom CSS Utilities

Defined in `src/styles/index.css` via `@utility`:
- `scrollbar-hide` — hides scrollbars on horizontal scroll containers
- `animate-in`, `fade-in`, `slide-in-from-bottom-2` — entry animations for FAB

## UI Language

Korean (한국어). All user-facing text uses Korean strings.

## Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEV_TENANT_SLUG=demo
```

Copy `.env.example` to `.env` and fill in values.

Gemini API key is a **Supabase secret** (not in client bundle):
```bash
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
supabase functions deploy generate-content
```

## Responsive Design

Mobile-first. Breakpoints: mobile (<640px), tablet (640–1024px), desktop (>1024px).
- User portal: desktop GNB collapses to hamburger on mobile, bottom tab nav (홈/검색/찜/상담/MY)
- Admin portal: desktop sidebar collapses to hamburger/overlay on mobile, bottom tab nav (대시보드/매물/고객/더보기)
- Homepage 2-column layout: sidebar filters on desktop → horizontal scroll chips on mobile
- Property grid: 4 cols desktop → 2 cols mobile
