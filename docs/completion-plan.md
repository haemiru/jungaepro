# 중개프로(jungaepro) 완성 계획

> 작성일: 2026-07-11 · 점검 기준 커밋: `06fbc88`
> 실행 도구: Claude Code (Opus) — 각 Phase를 순서대로 진행하되, Phase 내 항목은 독립적이므로 병렬 처리 가능.
> 범위 결정(사용자 확정): 외부 연동 전부 포함하되 **전자서명은 제외**. 미완성 UI는 **구현 가능한 건 구현, 나머지 숨김**.
> PG는 **토스페이먼츠 정기결제 확정** (가맹 신청 승인 대기 중, 2026-07-11 기준). 등기부등본은 **현행(PDF 업로드) 그대로 출시**, API 연동은 완성 범위 외 "향후 업그레이드"로 분류.

## 점검 요약 (2026-07-11 기준)

- 빌드 통과. API 22개 모듈 중 21개 실제 Supabase 연동(mock은 `src/api/legal.ts`뿐). 인증·MFA·Edge Functions(Gemini/Resend/국토부실거래가/네이버뉴스) 실구현.
- 린트 오류 15건 + 경고 4건. ErrorBoundary 없음. SEO 메타 없음. 테스트 0건.
- 결제(PG) 미연동 — `changePlan()`이 DB 컬럼만 변경. 시세/시그널/입지분석은 `marketMockData` 기반.
- CLAUDE.md가 코드보다 구식(“전부 mock” 등 오기재 다수).

---

## Phase 1 — 코드 품질·안정성 (외부 의존 없음, 최우선)

### 1-1. 린트 오류 15건 + 경고 4건 수정
`npx eslint .` 기준. 주요 파일:
- `react-hooks/set-state-in-effect` (8곳): `src/components/home/PropertyGrid.tsx:31`, `src/components/property/NearbyTradePrice.tsx:24`, `src/pages/admin/CustomerDetailPage.tsx:798`, `src/pages/admin/CustomersPage.tsx:51`, `src/pages/admin/InspectionListPage.tsx:19`, `src/pages/admin/PropertiesPage.tsx:70,109`, `src/pages/user/FavoritesPage.tsx:16`
  - 패턴별 해결: 파생 상태는 렌더 중 계산으로, 데이터 페치 초기화는 `useState` 초기값/이벤트 핸들러로 이동
- `react-refresh/only-export-components` (4곳): `src/components/common/AreaUnitToggle.tsx`, `src/components/common/KakaoMap.tsx` — 상수/유틸을 별도 파일로 분리
- `@typescript-eslint/no-unused-vars` (2곳): `src/pages/admin/ContractFormPage.tsx:675,1087`
- `react-hooks/exhaustive-deps` 경고 4곳
- `src/hooks/useSessionTimeout.ts:14` "impure function during render"
- **완료 기준**: `npm run lint` 오류 0건, `npm run build` 통과

### 1-2. 전역 에러 방어
- `src/components/common/ErrorBoundary.tsx` 신규 — 오류 화면(한국어) + 새로고침 버튼
- `src/router.tsx`의 최상위 라우트에 `errorElement` 추가 + 404 페이지 확인
- `src/main.tsx` 또는 `App.tsx`에서 ErrorBoundary로 래핑
- **완료 기준**: 임의 컴포넌트에서 throw 시 흰 화면 대신 안내 화면

### 1-3. 슈퍼관리자 접근 role 기반 전환
- 현재: `src/components/layout/AdminHeader.tsx`(미커밋)에 `user?.email === 'junominu@gmail.com'` 하드코딩
- `users` 테이블에 `is_super_admin boolean` 컬럼(또는 role 확장) 마이그레이션 추가, `admin_get_all_agents()` 등 RPC(`supabase/migrations/00025`, `00026`)의 서버측 권한 체크와 일치시킬 것
- SuperAdminPage 라우트 가드도 동일 기준으로
- **완료 기준**: 이메일 문자열 하드코딩 제거, 클라이언트·서버 양쪽 동일 기준

### 1-4. 저장소 위생
- `docs/`를 `.gitignore`에 추가 여부 결정 — **주의: `docs/사업자등록증.jpg`, `.env` 실키 등 민감 파일이 절대 커밋되지 않도록**. 권장: `docs/`는 gitignore, 이 계획 문서 등 필요 파일만 예외(`!docs/completion-plan.md` 등)
- AdminHeader.tsx 변경은 1-3 완료 후 함께 커밋
- `pdf-lib` 의존성 제거(소스 참조 0건). `puppeteer`는 docs/ 캡처 스크립트 10곳에서 사용하므로 **유지**
- ~~`.env` 실키 로테이션~~ — 불필요로 정정. `.env`는 git 히스토리에 커밋된 적 없고 서버 키가 번들에도 없음. 노출 경로 없음.

### 1-5. 번들 최적화
- `RegionMapCard` 청크 1,212KB 원인 분석(지역 GeoJSON 내장 추정) → 동적 import 또는 데이터 분리/압축
- **완료 기준**: 최대 청크 700KB 이하 또는 지연 로딩으로 초기 경로에서 제외

---

## Phase 2 — 미완성 기능 정리 (구현 가능한 건 구현, 나머지 숨김)

### 구현할 것
| 항목 | 위치 | 구현 방향 |
|---|---|---|
| 문의 답변 임시저장 | `src/pages/admin/InquiryDetailPage.tsx:140` | localStorage 키 `inquiry-draft-{id}`에 저장/복원 (DB 불필요) |
| 임장 체크리스트 사진 첨부 | `src/pages/admin/InspectionChecklistPage.tsx:249` | `src/api/storage.ts` 패턴 재사용, `inspection-photos` 경로 업로드 + 항목별 URL 저장 |
| 위치분석 PDF 다운로드 | `src/pages/admin/LocationAnalysisPage.tsx:61` | `ConfirmationDocPage.tsx:159`의 jspdf + html2canvas-pro 동적 import 패턴 재사용 |

### 숨길 것 (연동 전까지 UI 제거 — 코드는 주석이 아니라 feature flag 또는 조건부 렌더로)
| 항목 | 위치 | 처리 |
|---|---|---|
| 전자서명 (사용자 결정: 범위 제외) | `src/pages/admin/ContractTrackerPage.tsx` 주석 블록, `src/api/legal.ts:107` | 주석 유지, 설정 > 연동의 전자서명 카테고리도 숨김 |
| 유저 임장 예약 버튼 | `src/pages/user/PropertyDetailPage.tsx:218` | 버튼 제거 (문의하기로 대체) |
| 맞춤매물 추천 발송 / 상담 스크립트 | `src/pages/admin/CustomerDetailPage.tsx:1050,1056` | 버튼 숨김 |
| 알림톡 채널 선택 | `src/pages/admin/InquiryDetailPage.tsx:126` | Phase 4-2 연동 전까지 채널 목록에서 제외 |
| 검색페이지 지도 영역 | `src/pages/user/SearchPage.tsx:285` | Phase 4-3에서 구현 예정이므로 그때까지 영역 숨김 |

### 확정 항목 (사용자 결정 완료)
- `src/pages/admin/RegistryPage.tsx` (고아 페이지): **등기부 PDF 업로드·보관 기능만 살려 `/admin/legal/registry` 라우트 연결**, mock 조회 UI는 숨김. **이 상태로 출시 확정** — API 실연동은 완성 범위 외 "향후 업그레이드" 참조.
- 유저 임장 예약 버튼: **제거 확정**, 문의하기로 유도.
- `docs/` gitignore: **확정** (사업자등록증.jpg 등 민감 파일 커밋 방지. `!docs/completion-plan.md`, `!docs/ppt-opus-prompt.md` 예외 유지).

### 문서 정합화
- CLAUDE.md 전면 갱신: "Mock API Pattern" 문단 삭제→실연동 현황 기술, AI 기능 "placeholder" 표기 7곳 수정, 존재하지 않는 `/admin/legal/registry` 라우트 기재 정정, KakaoMap(실제 Leaflet) 등
- `src/api/rental.ts:247` stale 주석, `CustomerDetailPage.tsx:605` stale 주석 정리

---

## Phase 3 — 출시·마케팅 준비 (PPT 발송 전 필수)

### 3-1. SEO/공유 메타
- `index.html`: meta description, Open Graph(og:title/description/image/url), Twitter Card, canonical
- OG 이미지 1장 제작(1200×630, 로고+슬로건) → `public/og-image.png`
- `public/robots.txt`, `public/sitemap.xml`(랜딩/로그인/가입 정도의 정적 구성)
- favicon 정비(`public/logo.png` 유지 여부, `rename-to-jungaepro-todo.md` 136행 잔여 항목)
- 테넌트 서브도메인별 동적 title(선택): `TenantGate`에서 `document.title = 사무소명`

### 3-2. 보안 헤더
- `vercel.json`에 headers 추가: `X-Frame-Options: SAMEORIGIN` (또는 CSP frame-ancestors), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`
- 임대인 공유 페이지(`/admin/rental-mgmt/share/:token`)는 iframe 요구 없음 확인 후 적용

### 3-3. 출시 전 수동 스모크 테스트 (rename-todo 잔여 항목 포함)
- 회원가입(중개사) → 이메일 인증 → 사무소 설정 → 매물 등록 → 유저 포털 노출 → 문의 → 답변 → 계약 작성 → 트래커, 전체 1회
- Edge Function `generate-content` 실호출 1회 검증 (AI 설명 생성)
- `gangnam.jungaepro.com` 등 서브도메인 시나리오

### 3-4. 최소 테스트 기반 (선택이지만 권장)
- vitest 도입, 순수 유틸(`src/utils/format.ts`, 스코어링, 계약 단계 생성)부터 20~30개 단위 테스트
- **완료 기준**: `npm test` 스크립트 동작

---

## Phase 4 — 외부 연동 (사용자 준비물 필요, 전자서명 제외)

> ⚠️ 각 항목은 사용자가 계정/계약을 먼저 준비해야 함. 아래 "사용자 준비물"이 확보된 항목부터 착수.

### 4-1. PG 결제 연동 (토스페이먼츠 정기결제 — 확정)
- 상태: **가맹 신청 완료, 승인 대기 중** (2026-07-11 기준). 승인 완료 시 착수
- 대상: `src/pages/admin/settings/BillingSettingsPage.tsx`, `src/api/settings.ts:747-776`
- 구현: 정기결제(빌링키) 발급 → Edge Function `payment-webhook`(승인/실패/해지) → `agent_profiles.subscription_plan` 갱신 → `payment_history` 실테이블 신설(마이그레이션) → `fetchBillingInfo()` mock 제거
- 플랜 다운그레이드/해지 시 매물 수 제한(`properties.ts`의 플랜 체크) 연동 확인
- **사용자 준비물**: 토스페이먼츠 가맹 승인 + 시크릿 키 → Supabase secrets
- **완료 기준**: 테스트 결제로 Basic 전환 → 웹훅 반영 → 결제내역 표시

### 4-2. 알림톡 연동 (카카오 비즈메시지 — 솔라피/알리고 등 대행)
- 대상: `src/pages/admin/InquiryDetailPage.tsx` 답변 채널, `src/stores/notificationStore.ts`
- 구현: Edge Function `send-alimtalk` 신설(대행사 REST) → 문의 답변/계약 단계 알림 발송 → 발송 로그 테이블
- **사용자 준비물**: 카카오 비즈니스 채널, 발신프로필 키, 템플릿 사전 승인(문의답변/계약알림 각 1종 이상)
- **완료 기준**: 실기기 수신 확인, 실패 시 SMS/이메일 폴백

### 4-3. 검색페이지 지도
- 대상: `src/pages/user/SearchPage.tsx:285`
- 기존 `src/components/common/KakaoMap.tsx`가 **Leaflet 기반으로 이미 구현**되어 매물 상세에서 사용 중 → 우선 이걸 재사용해 검색 결과 마커 지도 구현(추가 키 불필요). 카카오맵 SDK 전환은 선택
- **완료 기준**: 검색 결과가 지도 마커로 표시, 마커 클릭 → 매물 카드

### 4-4. 시세/분석 실데이터 전환
- 이미 실연동인 국토부 실거래가 Edge Function(`supabase/functions/real-trade-price`, `real_trade_cache` 테이블) 활용
- `src/pages/admin/ValuationPage.tsx`, `src/pages/user/MarketInfoPage.tsx`: 단지 시세 추이·평형 비교를 실거래 데이터 집계로 대체
- `SignalPage`(매수매도 신호)·`LocationAnalysisPage`(입지 점수): 실거래량·가격변동률은 실데이터로 대체하고, 공급/미분양 등 확보 불가 지표는 화면에 "참고용 지표" 라벨 명시
- **완료 기준**: "목업 데이터" 문구 전부 제거 또는 참고용 라벨로 대체

---

## 향후 업그레이드 (완성 범위 외 — 출시 후 검토)

### 등기부등본 API 연동 (사용자 결정: 현행 PDF 업로드로 출시, 추후 업그레이드)
- 배경: 대법원 인터넷등기소는 등기부등본 발급용 공공 오픈 API를 직접 제공하지 않음(등기정보광장 Open API는 통계성 데이터 위주). 실제 열람/발급은 **상용 중계 API**로 가능:
  - CODEF(코드에프) — 인터넷등기소 부동산등기부등본 열람/발급 API: https://developer.codef.io/products/public/each/ck/real-estate-register
  - 하이픈(HYPHEN) — 부동산등기부등본 열람/발급(민원캐시 포함): https://hyphen.im/product-api/view?seq=145
- 비용 구조: 인터넷등기소 법정 수수료(열람 700원/발급 1,000원)가 **건당** 발생 + API 사업자 이용료. 선불 전자민원캐시 충전 + 사업자 계약 필요
- 수익성 주의: Basic 월 3,000원 요금제에서 건당 700원+ 원가는 무제한 제공 불가 → **월 N건 제한 또는 건당 크레딧 차감 방식**으로 설계할 것
- 구현(착수 시): Edge Function `registry-lookup` 신설 → `src/api/legal.ts`의 `lookupRegistry` mock 대체 → RegistryPage 조회 UI 복원 → 조회 결과 PDF를 Storage 보관(기존 업로드 보관과 통합)
- **착수 조건**: CODEF 또는 하이픈 사업자 계약 + API 키 + 민원캐시 충전
- 그 외 향후 후보: 전자서명(카카오/네이버 — 사용자 결정으로 범위 제외), AI 가상스테이징·SNS 포스팅·실시간 채팅(Pro 플랜 기재 기능 중 미구현분)

---

## 사용자 준비물 체크리스트 (Phase 4 착수 조건)

- [x] PG: 토스페이먼츠 정기결제 가맹 신청 (승인 대기 중) → 승인 후 시크릿 키 확보
- [ ] 알림톡: 카카오 비즈니스 채널 개설 + 대행사(솔라피 등) 가입 + 템플릿 승인
- [ ] (선택) 카카오 developers JS 키 — Leaflet 유지 시 불필요

## 실행 로그

### Phase 1 완료 (2026-07-11, Opus)
- **1-1 린트**: 15 오류 + 4 경고 → 0. set-state-in-effect 8곳(async 함수 내부로 이동/파생 계산 전환), react-refresh 4곳(`src/utils/areaFormat.ts`·`src/utils/mapAddress.ts`로 유틸 분리 + 9개 import 갱신), unused-vars 2곳, exhaustive-deps 4곳, useSessionTimeout `Date.now()` 순수성 해결. `npm run lint` 0, `npm run build` 통과.
- **1-2 에러 방어**: `src/components/common/ErrorBoundary.tsx` 신규(클래스 `ErrorBoundary` + 라우터용 `RouteError`, 한국어 안내 화면). `App.tsx`가 ErrorBoundary로 래핑, `router.tsx` 최상위 4개 라우트에 `errorElement` 추가.
- **1-3 슈퍼관리자**: 이메일 하드코딩 5곳 제거. `supabase/migrations/00027_super_admin_flag.sql` 신규(`users.is_super_admin` 컬럼 + 시드 + `is_super_admin()` 헬퍼 + RPC 3종 권한 체크 교체). `User` 타입에 `is_super_admin` 추가. 클라이언트 2곳 `user?.is_super_admin === true`로 전환. **⚠️ 마이그레이션 적용 전까지 슈퍼관리자 UI는 숨김(fail-closed) — DB에 00027 적용 필요.**
- **1-4 저장소 위생**: `.gitignore`에 `docs/` + 예외 3개. `pdf-lib` 제거(미사용 확인). `.env` 키 로테이션은 사용자 작업(아래 참조).
- **1-5 번들**: RegionMapCard 컴포넌트 청크 1,212KB → 3.7KB. 지역 지도 데이터를 동적 import + React 19 `use()`로 분리 → `regionMaps` 별도 lazy 청크(1.2MB, 캐시 가능). 초기 라우트 최대 청크 `index` 560KB(<700KB), 1.2MB 데이터는 초기 경로에서 제외 → 기준 충족. (잔여: 데이터 청크 자체 1.2MB는 향후 지역별 분할/정밀도 축소로 추가 절감 가능.)

**사용자 조치 필요**:
1. ~~`00027_super_admin_flag.sql` 원격 Supabase 적용~~ — **완료(2026-07-11, 사용자 실행)**. 재로그인 시 슈퍼관리자 접근 복원됨.

### Phase 1 검증 완료 (2026-07-11, Fable)
- 4개 리스크 지점(set-state 리팩터링/RegionMapCard use()/ErrorBoundary/00027) 전부 통과. 홈·검색 런타임 스모크(dev 서버 + 브라우저) 콘솔 오류 0, regionMaps 동적 로드 확인.
- **갭 1건 발견·수정**: `.gitignore`의 `docs/` 디렉토리 제외 패턴은 하위 재포함(`!`)이 무효 → `docs/*`로 교정 (check-ignore 검증). `.bkit/` ignore 추가.
- 5개 커밋으로 푸시 완료 (`eb0e183`~`214e6b3`).

### Phase 2 완료 (2026-07-11, Fable 이어서 실행)
- **구현 3건**: ① 문의 답변 임시저장 — localStorage `inquiry-draft-{id}` 저장/복원/발송 후 삭제. ② 임장 체크리스트 사진 첨부 — `uploadInspectionPhoto()`(storage.ts 신규, `{agentId}/inspection/` 경로) + 항목별 첨부/썸네일/삭제, `checklist[].photo`로 DB 저장. ③ 위치분석 PDF 다운로드 — jspdf + html2canvas-pro 동적 import, 면책 문구 포함 캡처.
- **숨김 5건**: 알림톡 채널(문의 답변), 유저 임장 예약 버튼(문의하기로 통합), 맞춤매물 추천 발송/상담 스크립트 버튼, 검색페이지 지도 보기 토글(Phase 4-3에서 복원), 설정의 전자서명(기능 목록 + 연동 목록, 저장된 설정도 fetch 시 필터).
- **RegistryPage**: `/admin/legal/registry` 라우트 연결 + 사이드바 "등기부등본" 항목(⚖️) + featureStore `legal→registry` 매핑. 페이지는 이미 업로드·보관 전용이었음(mock 조회 UI 없음 — 조사 시점 이후 정리된 상태).
- **문서**: CLAUDE.md 갱신 — "Mock API Pattern" 섹션을 "API 연동 현황"(실연동 21/22 + 잔여 mock 목록)으로 교체, AI/CRM/문의/임장/임대/법률 섹션의 stale "placeholder" 표기 정정, Error Handling·Super Admin·Maps(KakaoMap=Leaflet) 섹션 신설, `VITE_GEMINI_API_KEY` 오기재 수정. `rental.ts`·`CustomerDetailPage.tsx` stale 주석 정리.
- 검증: `npm run lint` 0, `tsc` 0, `npm run build` 통과 (RegistryPage 청크 5.96KB 생성 확인).
2. ~~`.env` 실키 로테이션~~ — **불필요로 정정(2026-07-11)**. git 전체 히스토리에 `.env`가 커밋된 적 없고, 실키 문자열도 히스토리·번들 어디에도 노출되지 않음을 확인. 노출 경로가 없으므로 로테이션 불필요. (다른 경로로 키가 유출된 정황이 있을 때만 로테이션.)

### Phase 3 완료 (2026-07-12, Opus)
- **3-1 SEO/공유 메타**: `index.html`에 description·Open Graph·Twitter Card·canonical·theme-color 추가. OG 이미지 `public/og-image.png`(1200×630, 브랜드 블루+로고+슬로건) 생성 — `scripts/generate-og-image.mjs`(puppeteer). `public/robots.txt`(admin/auth disallow + sitemap), `public/sitemap.xml`(홈/가입/로그인). favicon은 logo.png + apple-touch-icon.
- **3-2 보안 헤더**: `vercel.json`에 X-Content-Type-Options·X-Frame-Options(SAMEORIGIN)·Referrer-Policy·HSTS·Permissions-Policy 추가.
- **3-4 단위 테스트**: vitest 도입(`vitest.config.ts`, `npm test`), `src/utils/format.test.ts` 27케이스(가격 포맷·거래유형별 가격·전화/사업자/주민번호 포맷·체크섬 검증·D-Day). 전부 통과.
- **3-3 스모크 체크리스트**: `docs/smoke-test-checklist.md` — 가입→자동승인→포털→매물→문의→계약→임장→SEO 8개 섹션 수동 E2E 검증 (사용자 실행).
- 검증: lint 0, build 통과, `npm test` 27/27.
- **프로덕션 하드닝(부수 발견·수정)**: Edge Function 4종 배포(naver-news·real-trade-price 신규), 프로덕션 시크릿 5종 설정(RESEND/MOLIT/NAVER/KAKAO), Resend jungaepro.com 인증 + RESEND_FROM. 슈퍼관리자 RPC 버그(00028) + 자동승인(00029) + 가입 알림 메일. 이메일 실배달 확인. → [[jungaepro-prod-infra-wired-2026-07]]

## 권장 실행 순서

Phase 1 → 2 → 3 은 외부 의존이 없으므로 즉시 연속 실행 (예상 규모: 파일 40~50개 수정).
Phase 4 는 준비물 확보된 항목부터 개별 착수. **PPT 발송은 Phase 3 완료 후** 진행 권장 (발송 → 유입 → 첫인상이 SEO/OG/안정성에 직결).
