# 토스페이먼츠 정기결제 연동 — 현황 & 이어하기 가이드

> 최종 업데이트: 2026-07-15 (Opus) · Phase 4-1 (docs/completion-plan.md)
> **이 문서 하나만 보면 다음에 이어서 작업 가능.**

## TL;DR (현재 상태)

- ✅ **연동 코드 100% 완성 + 검증 완료** (lint 0 · build 통과 · test 27/27)
- ✅ **dev 환경 세팅 완료** — `.env` 키 4종 입력됨, 원격 Supabase에 마이그레이션 적용됨, 토스 시크릿 키 인증 통과 확인
- ⛔ **실제 결제 E2E는 대기 중** — 토스 상점에 **자동결제(빌링) 계약이 활성화돼야** 결제창이 열림. 카드 등록 시도 시 토스가 `"자동 결제(빌링) 계약이 안 되어 있습니다"`로 거절(우리 코드 정상, 순수 토스 계약 이슈).

## ⛔ 유일한 병목 & 다음에 할 일

**자동결제(빌링)는 일반결제와 달리 테스트 환경에서도 토스 계약이 선행돼야 한다.** (토스 FAQ: "자동결제는 추가 리스크 검토 및 계약 후 사용")

### 이어하기 체크리스트
1. [ ] **토스에 자동결제 도입 요청** — 고객센터 1544-7772 / support@tosspayments.com
   - 문구 예: *"정기 구독형 SaaS(부동산 중개 플랫폼)입니다. 자동결제(빌링) 도입 신청합니다. 테스트/라이브 MID에 자동결제 계약 활성화 부탁드립니다."*
   - 진행 중인 가맹 심사에 자동결제(빌링)가 포함됐는지도 확인.
2. [ ] 계약 활성화되면 개발자센터 **API 키** 메뉴에서 **자동결제로 계약된 MID의 키**를 받아 `.env`의 `VITE_TOSS_CLIENT_KEY`·`TOSS_SECRET_KEY` **2줄만 교체** (코드 변경 0)
3. [ ] `npm run dev` → 중개사 로그인 → 환경설정 > 결제 > **Basic 시작하기** → 토스 테스트 결제창 → 테스트 카드 → 복귀 후 확인:
   - 카드 등록 + 첫 결제 완료 토스트 / 현재 요금제 Basic / 결제수단·결제이력 표시
   - Supabase Table Editor에서 `billing_subscriptions`(billing_key 존재)·`payment_history`(paid 1건) 확인
4. [ ] Pro 업그레이드(즉시청구 2번째 이력) / 해지(만기유지, `cancel_at_period_end`) / 예약취소 흐름 확인
5. [ ] `billing-cron` 수동 호출로 자동갱신 시뮬레이션: `curl -X POST -H "x-cron-secret: <CRON_SECRET>" https://<PROJECT_REF>.functions.supabase.co/billing-cron`
6. [ ] 프로덕션 배포 (아래 "프로덕션 배포 체크리스트")

## 완료된 것 (파일)

| 영역 | 파일 | 내용 |
|---|---|---|
| DB | `supabase/migrations/00030_billing.sql` | `billing_subscriptions`(빌링키 보관, service_role 전용 RLS)·`payment_history`(소유자 읽기)·`get_my_subscription()` SECURITY DEFINER RPC·pg_cron 스케줄 주석 템플릿 |
| Edge Fn | `supabase/functions/payment/index.ts` | issue(빌링키 발급+첫결제)/change(업·다운그레이드)/cancel. verify_jwt=true |
| Edge Fn | `supabase/functions/payment-webhook/index.ts` | 토스 결제상태 웹훅→payment_history 갱신. verify_jwt=false |
| Edge Fn | `supabase/functions/billing-cron/index.ts` | 만기 구독 자동결제·pending 전환·실패 시 past_due. x-cron-secret 보호 |
| Edge Fn | `supabase/functions/_shared/toss.ts` | 토스 API 헬퍼(issueBillingKey/chargeBilling/plan상수) |
| dev | `vite.config.ts` `paymentProxy()` | `/api/payment` — Edge Function 미러링(service-role DB 쓰기) |
| 클라 | `src/api/payment.ts` | 토스 SDK 카드등록 + fetchBillingInfo/changePlan/cancelSubscription |
| UI | `src/pages/admin/settings/BillingSettingsPage.tsx` | 카드등록·업다운그레이드·해지·예약취소·결제이력 + 리다이렉트 처리 |
| 설정 | `supabase/config.toml` | payment(verify_jwt=true)/payment-webhook·billing-cron(false) |
| 타입 | `src/types/database.ts` | BillingSubscription·PaymentHistory·MySubscription + 테이블/RPC 등록 |
| env | `.env.example` | VITE_TOSS_CLIENT_KEY·TOSS_SECRET_KEY·CRON_SECRET·SUPABASE_SERVICE_ROLE_KEY |
| 의존성 | `package.json` | `@tosspayments/tosspayments-sdk` 추가 |
| 정리 | `src/api/settings.ts` | mock `fetchBillingInfo`/`changePlan` 제거(payment.ts로 이동) |

> ⚠️ **아직 커밋 안 됨** — 신규 6 + 수정 7 파일. 리뷰 후 커밋 필요.

## 설계·정책 결정 (사용자 확정)

- **통합 방식**: 토스 v2 빌링(결제창 인증). 카드정보는 토스 호스팅 창에서만 입력, billingKey는 서버(Edge Function/dev 프록시)에만 저장. `customerKey = agent_profiles.id`.
- **자동갱신**: Supabase **pg_cron** (매일 만기 구독 → billing-cron). 스케줄 활성화는 go-live 시.
- **결제 정책 (표준 SaaS)**: 업그레이드=즉시 청구+즉시 적용(기간 now+1개월 리셋). 다운그레이드·해지=이번 결제기간 끝까지 현재 플랜 유지 후 전환(`pending_plan`), 환불 없음. 현재 플랜 재선택=예약 취소(재개).
- **source of truth**: `agent_profiles.subscription_plan`이 유효 플랜(featureStore·매물 수 제한이 읽음). `billing_subscriptions`는 결제 원장.
- **보안**: `billing_key`는 클라이언트에 절대 노출 안 함. RLS로 service_role만 접근, 클라는 `get_my_subscription()` RPC로 안전 컬럼만 조회.

## 환경 세팅 현황 (2026-07-15 기준)

- `.env`(dev): `VITE_TOSS_CLIENT_KEY`(test_ck_)·`TOSS_SECRET_KEY`(test_sk_)·`SUPABASE_SERVICE_ROLE_KEY`·`CRON_SECRET` **입력 완료**
- 원격 Supabase(`lxszaaxjgauyyjqgagjz`): `00030_billing.sql` **적용 완료** (billing_subscriptions·payment_history·get_my_subscription 확인됨)
- 프로덕션 시크릿·함수 배포: **미완료** (아래 참조)
- 사전점검 스크립트: `scratchpad/verify-billing-setup.mjs` (env·마이그레이션·토스 키 확인용, 재사용 가능)

## 프로덕션 배포 체크리스트 (토스 계약 후)

1. [ ] `supabase functions deploy payment`
2. [ ] `supabase functions deploy payment-webhook --no-verify-jwt`
3. [ ] `supabase functions deploy billing-cron --no-verify-jwt`
   - (config.toml에 verify_jwt 설정돼 있으나 배포 플래그로도 명시)
4. [ ] 시크릿: `supabase secrets set TOSS_SECRET_KEY=live_sk_... CRON_SECRET=<랜덤>`
5. [ ] pg_cron 스케줄 등록: `00030_billing.sql` 하단 주석의 `cron.schedule(...)` (URL·CRON_SECRET 채워서). pg_cron·pg_net 확장은 대시보드 Database > Extensions에서 활성화
6. [ ] 토스 대시보드에 웹훅 URL 등록: `https://<PROJECT_REF>.functions.supabase.co/payment-webhook`
7. [ ] 빌드 env(Vercel): `VITE_TOSS_CLIENT_KEY=live_ck_...`
8. [ ] 라이브 소액 결제 1회 + 웹훅 수신 확인

## 검증 명령

```bash
npm run lint      # 0
npm run build     # tsc + vite 통과 (BillingSettingsPage 청크 ~10KB)
npm test          # 27/27
node "<scratchpad>/verify-billing-setup.mjs"   # env·마이그레이션·토스 키 사전점검
```

## 알아둘 점 (caveats)

- **자동결제 계약 = 진짜 병목**: 코드가 아니라 토스 계약. 이게 켜지기 전엔 결제창 자체가 안 열림.
- dev 프록시는 `SUPABASE_SERVICE_ROLE_KEY`로 원격 DB에 직접 쓴다 → dev 테스트도 실제 원격 데이터에 반영됨(주의).
- `billing-cron`은 pg_cron으로 매일 호출 예정이나, 수동 호출(`x-cron-secret`)로도 테스트 가능.
- 다운그레이드 시 기존 초과 매물은 유지되고 신규 등록만 제한(`PLAN_PROPERTY_LIMIT`, `properties.ts` 등록 시 체크).

## 관련 문서
- `docs/completion-plan.md` — 전체 Phase 로드맵·실행 로그
- `CLAUDE.md` — "결제 (토스페이먼츠 정기결제)" 섹션
- 다음 트랙 후보: 4-2 알림톡(카카오 채널 대기), 잔여 #8 성능(실거래 3년조회 병렬 호출)
