# `smart-home` → `jungaepro` 통일 작업 To-Do

운영 도메인이 `jungaepro.com`으로 확정되었으므로 코드/리포/서비스 이름을 모두 `jungaepro`로 통일한다.

## 결정 사항

- **Supabase/Vercel:** 표시 이름(display name)만 변경. 내부 `xxx.supabase.co` ref와 `*.vercel.app` URL은 그대로 둔다. .env, 도메인 연결, 마이그레이션 영향 없음.
- **localStorage 키:** `smart-home-auth` → `jungaepro-auth`로 변경. **기존 로그인 사용자는 모두 강제 로그아웃됨** (현재 운영 사용자 거의 없으므로 수용).
- **GitHub 리포:** rename. GitHub가 구 URL을 자동 리다이렉트하므로 클론된 리포에서 remote만 갱신.
- **로컬 폴더:** `C:\Users\bsuha\Claude-prj\smart-home` → `C:\Users\bsuha\Claude-prj\jungaepro`. Claude Code 세션, VSCode, dev 서버 모두 종료 후 진행.

---

## Phase 1 — 사전 준비 ✅

- [x] **`main` 브랜치 클린 상태로 정리**
  - 현재 unstaged된 `package.json`/`package-lock.json` 처리 (커밋 or stash)
  - 미추적 `nul` 파일 삭제
  - `.claude/`, `docs/` 는 `.gitignore` 검토
- [x] **현재 상태 백업 태그 생성**: `git tag pre-rename-2026-05-12 && git push origin pre-rename-2026-05-12`
- [x] **DB 백업**: Supabase Dashboard → Database → Backups에서 수동 백업 생성

---

## Phase 2 — 코드베이스 내 문자열 치환 ✅

치환 대상 파일 (확인된 항목):

- [x] `package.json` — `"name": "smart-home"` → `"jungaepro"`
- [x] `supabase/config.toml` — `project_id = "smart-home"` → `"jungaepro"`
- [x] `src/api/supabase.ts` — `storageKey: 'smart-home-auth'` → `'jungaepro-auth'`
- [x] `src/App.tsx` — `localStorage.getItem('smart-home-auth')` → `'jungaepro-auth'`
- [x] `src/api/storage.ts` (2곳) — `localStorage.getItem('smart-home-auth')` → `'jungaepro-auth'`
- [x] `CLAUDE.md` — `**Smart Home**` 헤더 → `**Jungaepro**` 또는 `**Jungaepro (구 Smart Home)**`
- [x] `supabase/migrations/00001_initial_schema.sql` 주석 — `-- Smart Home: ...` → `-- Jungaepro: ...`
- [x] `supabase/combined_migration.sql` 주석 — 동일
- [x] `.claude/settings.local.json` — 구 경로 `Claude-APP\smart-home` 관련 permission 항목 정리 (선택)
- [x] `index.html` `<title>` 확인 후 필요 시 변경
- [x] `vercel.json`, `public/_redirects` — 도메인/이름 하드코딩 여부 확인

**검증:**
- [x] `npm run build` 통과
- [x] `npm run dev` 정상 기동
- [x] 로그인 → 로그아웃 (localStorage 키 변경 검증)

---

## Phase 3 — GitHub 리포 rename ✅

- [x] **GitHub 웹**: `haemiru/smart-home` Settings → Repository name → `jungaepro`
- [x] **로컬 remote 갱신**:
  ```bash
  git remote set-url origin https://github.com/haemiru/jungaepro.git
  git remote -v   # 확인
  git fetch origin
  ```
- [x] GitHub Actions / Webhook 사용 여부 확인 (현재 없는 것으로 보임)
- [x] README/배지에 구 URL 포함 여부 검색

---

## Phase 4 — Supabase 프로젝트 이름 변경 ✅

- [x] Supabase Dashboard → Project Settings → General → Project name `smart-home` → `jungaepro`
- [x] **URL/anon key는 변경되지 않음** → `.env`, Vercel 환경변수 수정 불필요
- [x] `supabase/config.toml`의 `project_id` 변경(Phase 2 포함)은 로컬 CLI용이므로 dashboard와 별개로 진행

---

## Phase 5 — Vercel 프로젝트 이름 변경 ✅

- [x] Vercel Dashboard → Project Settings → General → Project Name `smart-home` → `jungaepro`
- [x] Production domain (`www.jungaepro.com`, `*.jungaepro.com`) 연결 상태 재확인
- [x] **`*.vercel.app` URL은 자동으로 바뀌지 않음**. 사용 중인 프리뷰 URL(`smart-home-eight-pi.vercel.app` 등)이 외부에 노출되어 있다면 별도 정리
- [x] Vercel CLI 사용 시 `.vercel/project.json` 자동 갱신 또는 `vercel link` 재실행

---

## Phase 6 — 로컬 폴더 rename ✅

> ⚠️ 이 단계 진행 전에 **Claude Code 세션, VSCode, dev 서버, 터미널 모두 종료** 필요

- [x] PowerShell에서:
  ```powershell
  cd C:\Users\bsuha\Claude-prj
  Rename-Item smart-home jungaepro
  ```
- [x] VSCode에서 새 경로(`C:\Users\bsuha\Claude-prj\jungaepro`) 열기
- [x] `npm install` 재실행 (symlink 경로 캐시 갱신)
- [x] `npm run dev` 정상 기동 확인

---

## Phase 7 — Claude Code 메모리 디렉토리 이전

Claude Code는 작업 디렉토리 경로 기반으로 메모리 폴더를 자동 생성한다. 폴더명을 바꾸면 새 메모리 폴더가 만들어져 기존 메모리에 접근하지 못한다.

- [x] 기존 메모리 폴더 위치:
  `C:\Users\bsuha\.claude\projects\C--Users-bsuha-Claude-prj-smart-home\`
- [x] 새 폴더로 복사:
  `C:\Users\bsuha\.claude\projects\C--Users-bsuha-Claude-prj-jungaepro\`
  - `memory/` 하위 5개 파일(MEMORY.md, feedback_commit_push_notify, feedback_session_summary, project_confirmation_doc, project_last_session) 복사 완료 (2026-05-13)
  - 메모리 내용에 `smart-home` 문자열 없음 → 경로 의존 없음 확인
- [x] 새 폴더에서 Claude Code 실행하여 메모리 로드 확인 (`MEMORY.md` 정상 인식)
- [x] 구 폴더 삭제 완료 (2026-05-13, 8개 파일 / 1.64MB 제거)

---

## Phase 8 — 최종 검증

**자동 확인 완료 (2026-05-13):**
- [x] 최종 커밋 메시지: `chore: rename project smart-home → jungaepro` (6173ea8)
- [x] `git push` 완료 → `main` is up to date with `origin/main`
- [x] Remote URL: `https://github.com/haemiru/jungaepro.git`
- [x] `npm run build` 통과 (29.04s, 에러 없음 / chunk size 경고만)

**사용자 직접 확인 (2026-05-13):**
- [ ] 로컬 `npm run dev` → 로그인/회원가입/매물 조회/계약 작성 전체 흐름 1회 점검
- [x] Vercel 자동 배포 성공 (커밋 `6173ea8` Ready 48s, Production Current)
- [x] `https://jungaepro.com` 프로덕션 정상 동작 (홈페이지 정상 로딩 확인)
- [x] `gangnam.jungaepro.com` 서브도메인 라우팅 정상 (TenantGate 정상 작동 → 슬러그 미등록 시 안내 페이지 표시)
- [ ] Supabase 연결, Edge Function (`generate-content`) 정상 호출 (AI 기능 한 번 호출해보기)

---

## 잔여 작업 (rename과 별개의 후속 작업)

### 1. Vercel ↔ GitHub 저장소 표시 (보류)
Vercel deployments 리스트에서 저장소명이 여전히 `smart-home`으로 표시되지만, **연결 자체는 정상**(푸시→자동배포 동작 확인됨). 순전히 display 이슈이므로 별도 조치 안 함.

- 필요 시 Vercel Project Settings → Git → Disconnect → `haemiru/jungaepro` 재연결로 표시 갱신 가능

### 2. 로고 이미지 파일 교체 ✅
- [x] `public/logo.png`를 jungaepro 브랜드 J 마크로 교체 (Canva 생성 → 1024×1024 PNG, 4.5MB → 234KB)
- [x] 커밋 `095338f chore: replace logo with jungaepro brand mark` 푸시 완료
- [ ] favicon (`public/favicon*`) 별도 점검
- [ ] `index.html` `<title>`, meta 태그 별도 점검

---

## 롤백 플랜

- 코드: `git reset --hard pre-rename-2026-05-12`
- GitHub 리포: 다시 rename (자동 리다이렉트 유지됨)
- 폴더: `Rename-Item jungaepro smart-home`
- Supabase/Vercel display name: 다시 변경 (URL/ref 변동 없으므로 안전)
- DB: Phase 1 백업 복원 (이번 작업에서는 DB 변경 없음, 사실상 불필요)
