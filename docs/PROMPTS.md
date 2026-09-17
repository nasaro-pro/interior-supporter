---
title: "인테리어 프로젝트 관리 플랫폼 — ④ 커서·그록 프롬프트 문서"
subtitle: "헌법 + 5개 프롬프트 + 검증 절차. 1인 개발자가 Cursor(Grok)로 사이트를 완성하기 위한 실행 문서"
version: "v2.1"
date: "2026-09-12"
---

# ④ 커서·그록 프롬프트 문서

> 「③ 아키텍처 문서」가 **무엇을 만들지**를 정의했다면, 이 문서는 그것을 **Cursor(Grok)에게 어떤 순서로 시킬지**를 정의한다. 5개의 프롬프트를 순서대로 붙여넣으면 서비스가 완성된다. 각 프롬프트는 **① 붙여넣을 본문 → ② 완료 판정 → ③ 자주 나오는 실패와 재지시 문구** 3단으로 되어 있다.

---

## 0. 시작 전에

### 0.1 저장소 준비

1. 새 저장소를 만들고 `docs/`에 넣는다.
   - `docs/ARCHITECTURE.md` ← 「③ 아키텍처 문서」
   - `SITE_DESIGN.md` ← 「② 총 사이트 설계문서」(Word를 마크다운으로 변환)
   - `docs/PROMPTS.md` ← 이 문서
2. 저장소 루트에 `AGENTS.md`를 만들고 **1장 헌법**을 그대로 붙여넣는다.
3. Cursor에서 모델은 **Grok 코드 계열**, Composer는 **Agent 모드**로 쓴다.

### 0.2 사용 규칙

| 규칙 | 이유 |
|---|---|
| **P1 → P5 순서대로**, 한 번에 하나만 | 앞 단계의 토대가 없으면 뒤가 잘못된 구조로 생성된다 |
| 한 프롬프트가 끝나면 **완료 판정을 통과**한 뒤 다음으로 | 실패를 안고 넘어가면 뒤에서 몇 배로 커진다 |
| 하위 블록(P3-a 등)마다 **한 커밋** | 되돌릴 지점을 촘촘히 남긴다 |
| 결과가 다르면 **절 번호를 짚어 재지시** | "ARCHITECTURE.md 6.3절과 다르다"가 "이상해"보다 10배 정확하다 |
| AI가 **스키마를 임의로 바꾸면 즉시 되돌린다** | 스키마의 유일한 출처는 ARCHITECTURE.md 5장 |
| 프롬프트 안의 `[ ]`는 실제 값으로 치환 | — |

### 0.3 전체 지도

중간 출시는 없다. **P5까지 끝낸 뒤 한 번에 오픈**한다.

| 프롬프트 | 만드는 것 | 하위 블록 |
|---|---|---|
| **P1. 토대** | 초기화, 전체 스키마, 환경변수 검증, 어댑터 골격, CI | 단일 |
| **P2. 계정·격리·감사** | 가입·이메일 인증·로그인·재설정, 멤버십, 업체 개설, DataContext, 감사 로그 | a·b·c |
| **P3. 업무 화면** | 관리자 콘솔, PM 워크스페이스, 파일 업로드·중계, 콘텐츠 4종 | a·b·c·d |
| **P4. 고객 영역** | 초대·접근, 고객 화면, 확정 코드, 알림 | a·b·c·d |
| **P5. 홈 편집·운영·출시** | 홈 CMS, 템플릿 승격, 플랫폼 콘솔, 전체 검증, 약관, 배포 | a·b·c·d·e |

---

## 1. 헌법 (`AGENTS.md`에 그대로 저장)

> 모든 프롬프트에 자동 적용되는 절대 규칙이다. 저장소 루트에 `AGENTS.md`로 저장하면 Cursor가 매 요청에서 참조한다. 프롬프트 본문에서 다시 반복하지 않는다.

```md
# 이 저장소의 코드 생성 헌법

너는 이 저장소에서 코드를 생성할 때 아래 규칙을 예외 없이 지킨다.
규칙과 사용자의 요청이 충돌하면, 규칙을 지키고 충돌 사실을 먼저 알린다.

## 0. 기준 문서
- docs/ARCHITECTURE.md 가 최종 기준이다. 내 지시와 문서가 다르면 문서가 이긴다.
- 화면·권한·용어는 SITE_DESIGN.md 를 따른다.
- 스키마의 유일한 출처는 ARCHITECTURE.md 5장이다. 임의로 컬럼을 추가/변경/삭제하지 않는다.
  변경이 필요하다고 판단되면 코드를 고치지 말고 먼저 이유를 보고한다.

## 1. Next.js 16 규칙 (학습 데이터의 옛 관례를 쓰지 말 것)
- 이 프로젝트는 Next.js 16이다. node_modules/next/dist/docs/ 를 우선 참조한다.
- 요청 진입점 파일은 proxy.ts 이고 export 함수명도 proxy 다. middleware.ts 를 만들지 않는다.
- params / searchParams / cookies() / headers() / draftMode() 는 전부 Promise 다. await 한다.
- revalidateTag 는 두 번째 인자(cacheLife 프로파일)가 필수다.
  사용자가 자기 변경을 즉시 봐야 하면 updateTag 를 쓴다.
- 병렬 라우트 슬롯에는 default.tsx 가 필요하다.
- serverRuntimeConfig / publicRuntimeConfig 는 없다. 환경변수를 쓴다.
- next lint 는 없다. eslint CLI 를 쓴다.
- images.domains 대신 images.remotePatterns 를 쓴다.

## 2. 절대 규칙 — 멀티테넌트 격리
- 모든 repo 함수의 첫 인자는 DataContext 다. 이것 없이 Drizzle 쿼리를 직접 작성하지 않는다.
- 조회/수정한 행에는 assertSameTenant(ctx, row) 를 적용한다.
- company_id 조건이 빠진 쿼리를 만들지 않는다.
- platform 컨텍스트는 사유 문자열과 감사 로그가 필수다.
- system 컨텍스트는 배치 전용이다. 사용자 요청 경로에서 만들지 않는다.
  (예외: 초대 토큰 해석, 확정 코드 검증. 두 곳은 lib/authz 전용 헬퍼로만 제공한다)

## 3. 절대 규칙 — 인가
- 모든 Server Action / API 라우트의 첫 줄에서 requireXxx(...) 를 호출한다.
- proxy.ts 의 검사는 UX 용이다. 보안 판정을 proxy.ts 에 두지 않는다.
- requireCompanyStaff 는 memberships 에 활성 멤버십이 있는 계정만 통과시킨다.
  고객 계정은 /app 경로에 들어올 수 없다.
- 세션에는 역할을 싣지 않는다. 역할은 요청 경로의 companySlug 와 함께 매번 조회한다.
- 작성자(authorId), 승인자(approvedBy) 는 세션 userId 로만 채운다.

## 4. 절대 규칙 — 고객 접근과 확정
- 고객은 로그인 후 project_access 가 있는 프로젝트만 볼 수 있다.
- 열람·일반 댓글: requireProjectAccess
- 승인/반려·확정 지시 댓글(kind='binding'): requireProjectVerified (확정 코드 검증 필요)
- 스태프는 approval_status 를 대신 변경하지 않는다. 승인자(approvedBy)는 확정 검증을 통과한 고객의 세션 userId 만 쓴다.
- 확정 코드는 해시로만 저장하고 평문은 발급 직후 화면에만 1회 노출한다.
- 재발급(codeVersion 증가) 시 기존 project_verifications 를 전부 무효화한다.
- 확정 지시 댓글은 수정·삭제할 수 없다.
- 고객 화면에는 visibility_status='published' 콘텐츠만 노출한다.

## 5. 절대 규칙 — 벤더 종속 금지
- better-auth 는 src/lib/auth 밖에서 import 하지 않는다.
- @aws-sdk/* 는 src/lib/storage 밖에서 import 하지 않는다.
- resend 는 src/lib/notify 밖에서 import 하지 않는다.
- 결제 SDK 는 src/lib/payments 밖에서 import 하지 않는다.
- src/lib/db 의 클라이언트는 modules/*/repo.ts 밖에서 import 하지 않는다.
- app/ 아래 파일은 modules/*/index.ts 만 import 한다.

## 6. 절대 규칙 — 감사 로그
- 가입/로그인/로그인 실패/이메일 인증/비밀번호 재설정,
  멤버 초대·역할 변경·비활성화, 프로젝트 접근 허용·회수,
  확정 코드 발급·검증 성공·실패, 공개 상태 변경, 승인/반려, 확정 지시 댓글,
  파일 업로드·삭제, 댓글 수정·삭제, 템플릿 제안·승인·반려,
  업체 생성·상태 변경, 테넌트 경계 초월 조회
  → recordAudit 를 같은 트랜잭션 안에서 호출한다.
- before/after 에 개인정보 원문(연락처·주소)을 넣지 않는다.
  예외: 확정 지시 댓글은 본문을 그대로 남긴다.

## 7. 이미지·파일
- 버킷은 완전 비공개다. 외부로 서명 URL 을 내보내지 않는다.
- 이미지는 /api/files/[objectId] 가 권한 확인 후 중계한다.
- next/image 는 이 내부 경로만 쓴다. remotePatterns 에 스토리지 도메인을 넣지 않는다.
- presigned 업로드 URL 에는 Content-Type 과 Content-Length 를 조건으로 서명한다.
- 외부 링크 미리보기는 사설 IP 를 차단하고, 이미지를 우리 스토리지에 복사해 보관한다.

## 8. 코딩 컨벤션
- TypeScript strict. any 금지(불가피하면 사유 주석).
- 서버 컴포넌트가 기본. 상호작용 부분만 'use client'.
- DB 컬럼 snake_case / TS camelCase.
- 모든 입력은 Zod 로 서버에서 검증한다.
- 사용자에게 보이는 문자열은 src/lib/messages 상수로 모은다. 한국어 기본.
- 목록은 커서 기반 페이지네이션. OFFSET 금지.
- 소프트 삭제 테이블 조회에는 isNull(deletedAt) 을 반드시 넣는다.
- N+1 쿼리를 만들지 않는다.
- 날짜 표시는 Asia/Seoul 기준으로 통일한다.

## 9. 하드코딩 금지
- 요금제 한도, 보관 기간, 레이트리밋 수치, 파일 크기 한도, 코드 만료 시간은
  코드 상수로 박지 않고 platform_settings 또는 환경변수에서 조회한다.
- ARCHITECTURE.md 3.1 표에 없는 런타임 패키지를 임의로 추가하지 않는다.

## 10. 지금 만들지 않는 것
- 결제 연동. subscriptions/invoices 스키마는 만들되 결제 로직은 구현하지 않는다.
- 요금제 제한. plan_enforcement_enabled=false 일 때 항상 허용이다.
- 저장공간 차단과 용량 경고 메일. 집계만 한다.
- 카카오 알림톡/SMS 실제 발송. 인터페이스와 빈 구현체만 둔다.
- 소셜 로그인.
- 내가 요청하지 않은 화면·기능·라이브러리.

## 11. 작업 방식
- 한 번에 요청받은 범위만 만든다. 범위를 넘는 리팩터링을 하지 않는다.
- 기존 파일을 지우거나 크게 옮기기 전에 먼저 알린다.
- 끝나면 (1) 만든 파일 목록, (2) 스키마 변경 여부, (3) 남은 TODO 를 요약한다.

## 12. 간결함
- 요청받은 동작에 필요한 코드만 만든다. 예비 추상화, 미사용 헬퍼, 중복 래퍼, 장황한 주석을 만들지 않는다.
- 같은 일을 더 짧은 코드로 할 수 있으면 짧게 한다. 파일이 커지면 나누기 전에 죽은 코드부터 지운다.
- 운영이 어려워질 정도로 무겁게 만들지 않는다.
```

---

## 2. P1 — 토대

> **목표**: 화면은 없지만, 이후 모든 코드가 올라탈 구조·스키마·검증 장치를 완성한다.

### 2.1 프롬프트

```
docs/ARCHITECTURE.md 의 3장(기술 스택), 4장(애플리케이션 구조), 5장(데이터)을 읽고
프로젝트 토대를 만들어줘. 화면 기능은 아직 만들지 마.

[1] 초기화
- Next.js 16 App Router + TypeScript(strict) + Tailwind CSS
- 패키지 매니저 pnpm, package.json 의 packageManager 필드로 버전 고정
- 런타임 의존성은 캐럿(^) 없이 정확한 버전으로 고정
- ARCHITECTURE.md 3.1 표의 패키지를 설치해줘:
  drizzle-orm, drizzle-kit, postgres, better-auth, zod, react-hook-form,
  @hookform/resolvers, @tanstack/react-query, @dnd-kit/core, @dnd-kit/sortable,
  nanoid, date-fns, date-fns-tz, sharp, @aws-sdk/client-s3,
  @aws-sdk/s3-request-presigner, resend, sanitize-html, cheerio,
  @sentry/nextjs, vitest, @playwright/test, eslint, prettier
  (표에 없는 패키지는 추가하지 마)
- shadcn/ui 설치 후 컴포넌트 추가: button, input, textarea, select, table, dialog,
  badge, tabs, calendar, dropdown-menu, sonner, card, separator, avatar, alert, checkbox
- ESLint flat config + Prettier
- scripts: dev, build, start, typecheck, lint, selfcheck, test:unit, test:integration,
  test:e2e, db:generate, db:migrate, db:check, db:seed

[2] 폴더 구조
ARCHITECTURE.md 4.1·4.2절 구조를 그대로 만들어줘.
각 라우트에는 "준비 중" 텍스트만 있는 page.tsx 를 두고,
modules/ 15개 폴더에 빈 schema.ts, repo.ts, service.ts, dto.ts, policy.ts, index.ts 를 만들어줘.

[3] 환경변수 검증
- src/lib/config/env.ts 에 ARCHITECTURE.md 부록 A 변수를 Zod 로 정의하고 부팅 시 parse
- 필수 변수 누락 시 빌드 실패
- NODE_ENV !== 'production' 인데 DATABASE_URL 이 운영 호스트면 예외를 던지는 가드
- .env.example 은 키 이름만 (값 비움)

[4] 데이터베이스
- src/lib/db/client.ts : DATABASE_URL 만으로 연결
- src/lib/db/enums.ts : ARCHITECTURE.md 5.3절 열거형 전체
- 5.4~5.8절 테이블을 각 모듈 schema.ts 에 나눠서 작성 (문서 그대로, 임의 변경 금지)
- src/lib/db/schema.ts 에서 전체 재수출
- drizzle.config.ts + 초기 마이그레이션 생성
- 생성된 마이그레이션 파일은 수정하지 말고,
  5.9절 불변식 중 CHECK 로 표현 가능한 것(I2, I8, I9)을
  drizzle/manual/0001_checks.sql 로 별도 작성하고,
  db:migrate 스크립트가 생성 마이그레이션 → manual 순서로 적용하게 해줘

[5] 어댑터 골격 (인터페이스와 시그니처만, 내부는 TODO)
- src/lib/storage/ : types.ts(StorageAdapter: signUpload, head, get, delete), r2.ts, index.ts
- src/lib/notify/ : types.ts(NotificationChannelAdapter), dispatch.ts,
  channels/{inapp,email,kakao-alimtalk,sms}.ts (뒤 둘은 isAvailable()=false 빈 구현)
- src/lib/payments/ : types.ts(PaymentAdapter), index.ts — 호출 시 NotImplementedError
- src/lib/ratelimit/ : Postgres 카운터 테이블 기반
- src/lib/errors/ : DomainError, UnauthorizedError, ForbiddenError, TenantViolationError,
  VerificationRequiredError, NotFoundError, RateLimitError + HTTP 매핑
- src/lib/messages/ : 사용자 노출 문자열 상수 모듈

[6] 검증 장치
- vitest + playwright 설정
- pnpm selfcheck : ARCHITECTURE.md 19.4절 스크립트를 실행하고 위반 시 exit 1
- .github/workflows/ci.yml : 19.5절 그대로
- src/proxy.ts : 4.5절 코드 그대로 (인가 판정은 넣지 마)

끝나면 만든 파일 목록과 실행 방법을 요약해줘.
```

### 2.2 완료 판정

| # | 확인 | 기대 |
|---|---|---|
| 1 | `pnpm dev` | 정상 기동 |
| 2 | `pnpm typecheck` | 에러 0 |
| 3 | `pnpm db:generate` | 마이그레이션 생성 |
| 4 | 마이그레이션 SQL 눈으로 확인 | 테이블 목록이 ARCHITECTURE.md 5장과 일치 |
| 5 | `company_id` 확인 | 테넌트 테이블에 존재. **단 `users`·`templates`(platform)·`audit_logs`는 nullable이 정상**(5.1절 예외) |
| 6 | `ls src/proxy.ts` | 존재. `src/middleware.*`는 없음 |
| 7 | `drizzle/manual/0001_checks.sql` | 존재하고 `db:migrate`가 적용 |
| 8 | `.env.example` | 키만 있고 값은 비어 있음 |
| 9 | `pnpm selfcheck` | 통과 |

### 2.3 자주 나오는 실패

| 증상 | 재지시 |
|---|---|
| `middleware.ts`를 만듦 | "Next.js 16에서는 진입점이 proxy 다. src/proxy.ts 로 바꾸고 export 함수명도 proxy 로 해줘." |
| 스키마 컬럼 임의 변경 | "ARCHITECTURE.md 5장과 다른 컬럼이 있다. 문서와 1:1로 다시 맞춰줘. 임의 추가 금지." |
| CHECK를 생성 마이그레이션에 직접 씀 | "5.1절대로 생성 파일은 건드리지 말고 drizzle/manual/ 에 별도 SQL 로 분리해줘." |
| 어댑터 내부까지 구현 | "P1에서는 인터페이스와 시그니처만 필요하다. 내부는 TODO 로 되돌려줘." |
| 표에 없는 패키지 설치 | "AGENTS.md 9절 위반이다. ARCHITECTURE.md 3.1 표에 없는 패키지를 제거해줘." |

---

## 3. P2 — 계정 · 격리 · 감사

> **목표**: 보안 뼈대를 완성한다. 여기가 부실하면 이후 모든 화면이 위험하다. 가장 꼼꼼히 검수할 단계다.

### 3.1 P2-a 테넌시 코어와 감사 로그

```
docs/ARCHITECTURE.md 6장(멀티테넌시·인가)과 12장(감사 로그)을 읽고 코어를 구현해줘. UI 는 아직 없다.

[1] src/lib/tenancy/
- 6.3절 DataContext 타입 4종(staff/customer/platform/system)을 그대로
- isStaff, hasRole 타입 가드
- assertSameTenant(ctx, row) : 불일치 시 TenantViolationError
- scoped(ctx, table) : company_id 필터 헬퍼
- createPlatformContext(userId, reason) : 사유가 비면 예외,
  생성 시 recordAudit('cross_tenant_query') 호출
- systemJob(name) : 배치 전용 컨텍스트 생성기 (lib 밖으로 재수출하지 마)

[2] src/modules/audit/
- recordAudit(input, ctx?, tx?) : 12.1절대로.
  반드시 비즈니스 트랜잭션과 같은 트랜잭션에서 기록되도록 tx 핸들을 받을 수 있게
- before/after 에서 phone·email·address·연락처류를 자동 마스킹하는 유틸
- listAuditLogs(ctx, filter) : 커서 페이지네이션

[3] 예시 리포지토리
- src/modules/project/repo.ts 의 findProjectById 를 6.3절 코드 그대로

[4] 통합 테스트 (tests/integration)
- 업체 A 컨텍스트로 업체 B 프로젝트 조회 → TenantViolationError
- platform 컨텍스트 생성 시 cross_tenant_query 감사 로그가 남는지
- recordAudit 실패 시 비즈니스 트랜잭션이 롤백되는지
```

### 3.2 P2-b 인증과 계정

```
docs/ARCHITECTURE.md 7.1~7.3절을 읽고 계정 시스템을 구현해줘.

[1] Better Auth 설정 — src/lib/auth/server.ts
- 7.1절 설정 코드를 그대로 사용해줘. 특히:
  drizzleAdapter 에 usePlural: true (우리 테이블은 복수형)
  advanced.database.generateId 로 uuid 유지
  emailAndPassword: enabled, minPasswordLength 10, requireEmailVerification
  emailVerification: sendOnSignUp, autoSignInAfterVerification
  session: 30일 만료, 24시간 회전, cookieCache 비활성(계정 정지 즉시 반영)
  user.additionalFields: isPlatformAdmin (input:false), phone
- P1에서 만든 users/sessions/accounts/verifications 테이블과 매핑이 맞는지 확인하고,
  Better Auth 가 요구하는 컬럼이 빠졌으면 먼저 보고해줘 (임의로 스키마를 바꾸지 마)

[2] 파사드 — src/lib/auth/index.ts
- getSession, requireSession, signOut 만 노출
- 이 파일 밖에서는 better-auth 를 import 하지 않는다
- getSession 은 매 요청 DB에서 세션·계정 상태를 확인한다 (7.8절)

[3] 화면
- /signup : 이름·이메일·비밀번호 + [약관 동의] + [개인정보 국외 이전 동의(별도 체크박스)]
  두 동의는 분리하고, 동의 시각과 약관 버전을 저장해줘 (ARCHITECTURE.md 15.2절)
- /verify-email, /login, /forgot-password, /reset-password
- 로그인 실패 메시지는 계정 존재 여부를 노출하지 않게 통일
- 로그인 후 목적지: 초대 토큰 있으면 초대 수락 → 멤버십 있으면 /app/{slug}
  → project_access 있으면 /portal → 아무것도 없으면 /onboarding/company
- 레이트리밋(14.3절): 로그인 계정당 10분 10회·IP당 10분 30회, 가입 IP당 1시간 5회,
  인증메일 주소당 1분 1회·1일 5회. 수치는 platform_settings 에서 읽어와
- signup / login / login_failed / email_verified / password_reset 감사 로그

[4] platform_settings 시드 (pnpm db:seed)
plan_enforcement_enabled=false, audit_retention_days={"default":180,...},
verify_code_length=8, verify_attempt_limit=5, verify_attempt_window_min=10,
invite_expire_days=7, max_image_mb=20, max_pdf_mb=50,
rate_limits={...14.3절 값...}
```

### 3.3 P2-c 업체 개설과 멤버십

```
docs/ARCHITECTURE.md 7.4절과 6.4절을 읽고 업체·멤버십을 구현해줘.

[1] src/lib/authz/
- requirePlatformAdmin(reason), requireCompanyStaff(slug), requireCompanyAdmin(slug),
  requireProjectStaff(projectId) 를 구현하고 각각 DataContext 를 반환하게 해줘
- requireCompanyStaff 는 memberships 에 활성 멤버십이 있는 계정만 통과시킨다.
  고객 계정(멤버십 없음)은 여기서 403 이어야 한다
- src/modules/membership/policy.ts : 6.4절 staffPolicy 그대로

[2] /onboarding/company
7.4절 흐름대로 한 트랜잭션에서:
companies(status='active', planTier='free') +
memberships(company_admin) + memberships(project_manager) +
subscriptions(free 레코드만) + 기본 notification_preferences
→ recordAudit('company_create') → /app/{slug}/admin 이동
요금제 선택 단계는 만들지 마 (전 기능 무료 개방 중)

[3] /app/[companySlug]/admin/members
- 멤버 목록(이름·이메일·역할 배지·상태)
- 이메일 초대 (invitations, kind='company_member', role 지정, 7일 만료)
- 역할 부여·회수 토글: 총관리자가 각 멤버의 project_manager 멤버십을 켜고 끌 수 있게.
  본인 PM 멤버십도 회수 가능하되, 업체에 company_admin 이 0명이 되는 조작은 막아줘
- 멤버 비활성화 시 해당 사용자 세션 즉시 무효화
- member_invite / member_role_change / member_deactivate 감사 로그

[4] /invite/[token]
- 토큰 해석은 lib/authz 전용 헬퍼로만(system 컨텍스트를 밖으로 흘리지 마)
- 로그인 상태면 즉시 수락, 아니면 가입/로그인 후 자동 수락
- kind='company_member' → memberships 생성
- kind='project_customer' → project_access 생성 (P4에서 사용)
- 만료·이미 사용된 토큰은 안내 화면

[5] 통합 테스트
- 고객 계정(멤버십 없음)이 requireCompanyStaff 를 통과하지 못하는지
- 마지막 company_admin 의 역할 회수가 거부되는지
- 멤버 비활성화 직후 해당 세션 요청이 차단되는지
```

### 3.4 완료 판정

| # | 확인 | 기대 |
|---|---|---|
| 1 | 가입 → 인증 메일 → 로그인 | 전 과정 동작 |
| 2 | 국외 이전 동의 체크박스 | 약관 동의와 **분리**되어 있고 저장됨 |
| 3 | 업체 개설 후 DB | `companies` 1건 + `memberships` 2건(admin·PM) |
| 4 | 대표 계정으로 프로젝트 콘텐츠 편집 | 가능 (PM 멤버십 보유) |
| 5 | 멤버십 없는 계정으로 `/app/{slug}` | 403 |
| 6 | 마지막 총관리자 역할 회수 | 거부 |
| 7 | `audit_logs` | signup·login·company_create·member_* 기록 |
| 8 | `grep -rn "better-auth" src/ \| grep -v "src/lib/auth"` | 결과 없음 |
| 9 | `pnpm test:integration` | P2 테스트 전부 통과 |

### 3.5 자주 나오는 실패

| 증상 | 재지시 |
|---|---|
| 세션에 role을 넣음 | "한 계정이 여러 업체에 속할 수 있어 세션에 역할을 실으면 안 된다. 7.2절대로 요청 경로의 companySlug 와 함께 매번 조회해줘." |
| `usePlural` 누락으로 테이블 못 찾음 | "7.1절대로 drizzleAdapter 에 usePlural: true 와 generateId 를 넣어줘." |
| `requireCompanyStaff`가 멤버십을 안 봄 | "6.4절 위반이다. memberships 활성 여부로 판정하게 고쳐줘. 고객 계정은 403 이어야 한다." |
| 감사 로그를 비동기로 기록 | "12.1절대로 같은 트랜잭션에서 기록하고, 실패하면 전체 롤백되게 해줘." |
| 동의 체크박스를 하나로 합침 | "15.2절 위반이다. 국외 이전 동의는 별도 체크박스로 분리해줘." |

---

## 4. P3 — 업무 화면

> **목표**: 업체 직원이 실제로 일할 수 있는 상태. 분량이 가장 크므로 4개로 나눠 순서대로 요청한다.

### 4.1 P3-a 관리자 콘솔

```
SITE_DESIGN.md 3.C 와 ARCHITECTURE.md 부록 C 를 참고해서
/app/[companySlug]/admin 하위를 구현해줘.

- layout.tsx : requireCompanyStaff(slug). 사이드바 네비게이션.
  스태프 공통: 대시보드, 고객, 프로젝트
  총관리자 전용(페이지에서 requireCompanyAdmin 재가드): 멤버, 설정, 감사로그, 템플릿, 저장공간, 알림 정책
- /admin : 대시보드 — 진행 중 프로젝트 수, 상태 분포, 최근 활동 10건(감사 로그 기반)
- /admin/customers : 고객 연락처 목록 + 등록/수정 다이얼로그
  (이름·연락처·이메일·메모. 이메일은 선택 입력)
- /admin/projects : 프로젝트 목록 + 생성 다이얼로그
  (고객 선택, 담당 PM 배정, 주소, 계약일, 시작·종료일)
- /admin/members : P2-c 에서 만든 화면 연결
- /admin/notifications : 이벤트별 인앱/이메일 수신 설정(notification_preferences)
- /admin/audit-log : 감사 로그 테이블(필터: 행위유형·기간·행위자, 커서 페이지네이션)
- /admin/storage : 사용량 표시만 (차단·경고 없음)
- /admin/settings : 업체 정보, 로고·브랜드 색상 업로드

모든 데이터 접근은 requireXxx 가 돌려준 DataContext 로만.
목록은 전부 커서 기반 페이지네이션.
```

### 4.2 P3-b PM 워크스페이스 틀

```
SITE_DESIGN.md 3.D 대로 PM 워크스페이스를 만들어줘.

- /app/[companySlug]/projects : 내 담당 프로젝트 목록 (총관리자는 전체)
- /app/[companySlug]/projects/new : 프로젝트 생성
  ARCHITECTURE.md 8.3절 createProject 코드를 그대로 써줘.
  PM 단독 권한이면 담당자를 본인으로 강제하고, 총관리자는 임의 배정 가능
- /projects/[projectId]/layout.tsx : requireProjectStaff(projectId) + 탭 네비게이션
  (개요 / 홈 편집 / 디자인 / 자재 / 요청 / 사진 / 일정 / 참여자 / 설정)
  '홈 편집' 탭은 P5에서 구현하므로 지금은 "준비 중" 상태로 둬
- /overview : 개요, 현재 진행 공정, 담당자, 최근 업데이트, 다음 일정
- /settings : 기본 정보 수정, 프로젝트 보관(archive)

프로젝트 생성 시 pages 레코드(빈 고객 홈)도 같은 트랜잭션에서 만들고
recordAudit('project_create') 를 포함해줘.
```

### 4.3 P3-c 파일 업로드와 중계

```
docs/ARCHITECTURE.md 10장을 읽고 파일 파이프라인을 구현해줘.

[1] src/lib/storage/r2.ts
- presigned PUT URL 발급 시 Content-Type 과 Content-Length 를 조건으로 서명 (10.1절)
- head, get(스트림), delete

[2] POST /api/uploads/sign
권한 확인 → 확장자·크기 사전 검증 → 10.2절 규약대로 objectKey 생성
→ storage_objects INSERT(status=pending) → presigned URL(5분) 반환

[3] POST /api/uploads/complete
HEAD 로 실제 크기·타입 확인 → 매직바이트 검증 → 불일치 시 quarantined 후 삭제
→ sharp 로 긴 변 600px WebP 썸네일 생성 후 thumbKey 저장
→ status=ready → companies.storage_used_mb 갱신 → recordAudit('file_upload')
용량이 초과돼도 업로드를 막지 마 (집계만, 10.6절)

[4] GET /api/files/[objectId]?v=thumb|full — ADR-11 의 핵심
- 세션 확인 → 객체 조회 → 연결 콘텐츠의 company/project/visibility 확인
  · 업체 스태프: 같은 company 면 허용
  · 고객: project_access 가 있고 연결 콘텐츠가 published 일 때만 허용
- R2 에서 스트리밍, Cache-Control: private, max-age=3600, immutable
- 외부로 서명 URL 을 절대 내보내지 마

[5] next.config.ts
- images.qualities = [60, 75], minimumCacheTTL = 14400
- remotePatterns 에 스토리지 도메인을 넣지 마 (이미지는 전부 내부 경로다)

[6] 공용 업로더 컴포넌트
components/shared/uploader.tsx : 드래그앤드롭, 진행률, 다중 업로드
```

### 4.4 P3-d 콘텐츠 화면 4종

```
SITE_DESIGN.md 4.3~4.5, 5.1, 5.2 와 ARCHITECTURE.md 8.2, 8.4~8.6, 8.8 을 참고해서
프로젝트 콘텐츠 화면을 구현해줘.

[공통] 공개 상태 컨트롤
- 초안 → 검토 → 공개 / 예약 전이 UI 를 공용 컴포넌트로 만들어 전 화면에서 재사용
- draft 에서 published 로 직접 전이는 불가능해야 한다 (8.2절)
- 모든 전이에 recordAudit('visibility_change') + before/after

[디자인] /designs
- 버전 목록(최신순), 새 버전 등록(파일 업로드 + 버전명 + 변경 설명)
- versionNo 는 같은 트랜잭션에서 MAX+1
- 공개 상태·승인 상태 배지

[자재] /materials
- 공간 7종 탭
- 등록 폼: 제품명·브랜드·규격·색상·적용위치·설명 +
  이미지는 (a) 직접 업로드 또는 (b) 외부 링크 붙여넣기 둘 다 지원
- (b) 선택 시 POST /api/link-preview 를 호출해 미리보기를 수집한다.
  ARCHITECTURE.md 10.7절대로: http(s)만 허용, 사설 IP·로컬호스트 차단,
  5초 타임아웃, 리다이렉트 3회 제한, 응답 1MB 상한,
  cheerio 로 og:title/og:image/og:site_name 추출,
  og:image 를 우리 스토리지에 복사(category='link')한 뒤 linkImageObjectId 저장.
  실패하면 링크만 저장하고 도메인 이름과 링크 버튼만 표시
- 구매 진행 스테퍼: 견적→주문→배송→설치→완료.
  전이 시 material_status_history 기록, 되돌릴 때는 사유 필수

[진행 사진] /photos
- 공정 11종 탭, 다중 업로드, 촬영일·설명
- 업로드 직후 상태는 항상 draft, 선택 항목 일괄 공개 액션
- Before/After 짝 지정 UI (pairGroupId + before/after 역할)

[일정] /schedule
- 월간 뷰 + 목록 뷰 토글, 일정 등록/수정
- 일정도 다른 콘텐츠와 동일하게 draft 에서 시작한다.
  공개해야 고객 화면에 보인다 (5.7절 schedules 기본값 확인)

[요청사항] /requests
- 댓글 목록(작성자·시각·구분 배지), 답글 작성
- 확정 지시 댓글(kind='binding')은 "확정 지시" 배지로 구분해 보여주고 수정·삭제 불가
- 일반 댓글 수정 시 이전 본문을 edit_history 에 append (원본 삭제 금지), 본인만 수정 가능
- 삭제는 PM·총관리자만, 소프트 삭제 + recordAudit('comment_delete')
```

### 4.5 완료 판정

| # | 확인 | 기대 |
|---|---|---|
| 1 | 업체 개설 → 고객 등록 → 프로젝트 생성 | 끊김 없이 진행 |
| 2 | PM 계정으로 `/projects/new` | 담당자가 본인으로 고정 |
| 3 | 다른 업체 프로젝트 URL 직접 입력 | 403 |
| 4 | 사진 20장 업로드 | 성공, 썸네일 생성, `storage_used_mb` 증가 |
| 5 | 확장자 위조 파일 업로드 | 격리 후 삭제 |
| 6 | 자재에 외부 링크 붙여넣기 | 제목·이미지 미리보기 수집, 이미지가 우리 스토리지에 복사됨 |
| 7 | 링크에 `http://127.0.0.1` 입력 | 거부 |
| 8 | 디자인을 초안 → 공개로 직접 시도 | 불가 |
| 9 | 일정 생성 직후 | 초안 상태(고객에게 안 보임) |
| 10 | `pnpm selfcheck` | 통과 |

---

## 5. P4 — 고객 영역

> **목표**: 이 서비스의 핵심 가치인 고객 화면. **모바일에서 먼저 확인한다.**

### 5.1 P4-a 고객 초대와 접근

```
docs/ARCHITECTURE.md 7.5절과 6.5절을 읽고 고객 접근을 구현해줘.

[1] /app/[companySlug]/projects/[projectId]/access — 참여자 관리
- 참여자 목록(이름·이메일·라벨·접근 시각·확정 여부)
- "초대 링크 만들기": invitations(kind='project_customer', 7일 만료) 생성 후
  링크를 복사 버튼으로 제공 (PM 이 카카오톡·문자로 직접 전달한다)
- 참여자 접근 회수 버튼 → project_access.revokedAt + recordAudit('project_access_revoke')
- 한 프로젝트에 여러 계정을 초대할 수 있다(부부·가족). 라벨 입력 가능

[2] 초대 수락 (P2-c 의 /invite/[token] 확장)
- kind='project_customer' 이면 project_access 생성 + recordAudit('project_access_grant')
- 수락 후 /portal/{projectId}/home 으로 이동

[3] src/lib/authz/portal.ts
- requireCustomerSession(), requireProjectAccess(projectId), requireProjectVerified(projectId)
  를 ARCHITECTURE.md 6.5절 코드 그대로

[4] 통합 테스트
- 접근 권한 없는 계정이 /portal/{id} 접근 → 403
- 접근 회수 직후 해당 계정의 요청 → 403
```

### 5.2 P4-b 확정 코드

```
docs/ARCHITECTURE.md 7.6절을 읽고 확정 코드를 구현해줘.

[1] 발급 — /access 화면
- "확정 코드 발급" 버튼 (담당 PM·총관리자만)
- 8자리 코드 생성(혼동 문자 제외) → 해시로 projects.verificationCodeHash 저장
- codeVersion +1 → 기존 project_verifications 전부 무효화
- 평문 코드는 발급 직후 화면에 1회만 표시(복사 버튼). 다시 볼 수 없음을 안내
- recordAudit('verification_code_issue')

[2] 검증 — /portal/[projectId]/verify
- 코드 입력 → 해시 비교 → 성공 시 project_verifications 기록(codeVersion 포함)
- 실패 시 남은 시도 횟수 안내. 프로젝트·계정당 10분 5회 초과 시 잠금
  (수치는 platform_settings)
- verification_success / verification_failed 감사 로그

[3] 판정
- requireProjectVerified 는 project_verifications.codeVersion 과
  projects.codeVersion 이 같을 때만 통과시킨다 (재발급하면 무효)
```

### 5.3 P4-c 고객 화면

```
SITE_DESIGN.md 3.E 와 ARCHITECTURE.md 4.1·9.1절을 읽고 고객 화면을 구현해줘.
모바일 우선으로 만들어줘 (고객은 대부분 휴대폰으로 본다).

[1] /portal (로그인 필요)
- 내 프로젝트 목록: project_access 가 있는 모든 프로젝트를 카드로.
  다른 업체 프로젝트도 함께 보인다(계정 하나로 여러 업체 가능)
- 각 카드에 업체명·진행 단계·최근 업데이트

[2] /portal/[projectId]/* (requireProjectAccess)
- layout: 업체 brandLogo/brandColor 반영, 하단 탭 네비게이션(모바일)
- /home : 고객 홈. 지금은 기본 레이아웃으로 구현해줘
  (진행 단계 + 최근 업데이트 + 다음 일정). 블록 편집은 P5에서 붙인다
- /design : 최신 공개 디자인 + 이전 버전 + 변경 설명
- /materials : 공간별 자재 카드(직접 업로드 이미지 또는 링크 미리보기, 외부 링크 버튼)
- /photos : 공정별 앨범 + 라이트박스
- /schedule : 일정 목록·달력
- /requests : 댓글 스레드
- 모든 조회는 visibility_status='published' 만. 초안·검토·예약은 절대 노출 금지
- 이미지는 전부 /api/files/[objectId]?v=thumb 를 쓰고 next/image 로 렌더

[3] 쓰기
- 일반 댓글: requireProjectAccess 면 가능
- 승인/반려 버튼, "확정 지시로 남기기" 체크박스: requireProjectVerified 필요.
  미검증 상태면 버튼 옆에 "확정 코드를 입력하면 승인할 수 있습니다" 안내와
  /verify 링크를 보여줘
- 승인 시 approvalStatus·approvedBy·approvedAt·approvalNote 기록 + recordAudit('approval')
- 확정 지시 댓글은 kind='binding' 으로 저장 + recordAudit('binding_comment')

[4] /portal/me
- 계정 정보(이름·이메일·연락처), 비밀번호 변경
- 알림 수신 설정(notification_preferences)
```

### 5.4 P4-d 알림

```
docs/ARCHITECTURE.md 11장을 읽고 알림을 구현해줘.

[1] src/lib/notify/dispatch.ts
이벤트 → 수신자 결정 → 수신 설정 확인 → 채널별 발송
11.1절 이벤트 중 지금 발신부가 존재하는 것만 연결해줘:
design.published / design.approval_requested / design.approved / design.rejected /
material.approval_requested / material.approved / comment.created /
comment.binding_created / schedule.published / schedule.changed / photo.published /
project.created / project.access_granted / verification.code_issued
(template.promotion_requested 와 company.status_changed 는 P5 에서 발신부를 만들 때 연결한다.
 dispatch 에는 핸들러만 미리 등록해 두고 emit 은 하지 마)

[2] 중복 방지
dedupeKey = {eventType}:{targetId}:{yyyymmddHH} 로 항상 채운다(NULL 금지).
사진 10장 일괄 공개 시 메일은 1통

[3] 채널
- 이메일은 Resend 로 실제 발송, 템플릿은 변수 치환형으로 작성
  (나중에 알림톡 템플릿 심사에 그대로 쓰기 위함)
- kakao_alimtalk / sms 는 isAvailable()=false 빈 구현 유지
- 인앱: 헤더 벨 아이콘 드롭다운 + 읽음 처리

[4] 배치
- /api/cron/publish-scheduled : publish_at 이 지난 scheduled 콘텐츠를 published 로 전환
  (blocks, design_versions, materials, progress_photos, schedules 전부)
  system 컨텍스트, 건별 recordAudit('visibility_change', actor=system)
- /api/cron/notification-retry : 실패 알림 지수 백오프 최대 3회
- 모든 /api/cron/* 는 withCronAuth() 공통 래퍼로 CRON_SECRET 헤더를 검증한다 (14.4절)
- vercel.json 에 크론 등록
```

### 5.5 완료 판정

| # | 확인 | 기대 |
|---|---|---|
| 1 | 초대 링크로 가입 → 수락 | `/portal/{id}/home` 진입 |
| 2 | 초대받지 않은 계정으로 `/portal/{id}` | 403 |
| 3 | 초안 상태 사진 | 고객 화면에 미노출 |
| 4 | 미검증 상태에서 승인 버튼 | 비활성 + `/verify` 안내 |
| 5 | 확정 코드 입력 후 승인 | 성공, `approval` 기록 |
| 6 | 코드 재발급 후 같은 계정이 승인 시도 | 거부(세대 불일치) |
| 7 | 코드 6회 오입력 | 잠금 |
| 8 | 확정 지시 댓글 | "확정 지시" 배지, 수정·삭제 불가, 감사 로그에 본문 기록 |
| 9 | 사진 10장 일괄 공개 | 메일 1통 |
| 10 | `/portal` | 두 업체 프로젝트가 한 목록에 보임 |
| 11 | 모바일 뷰 | 가로 스크롤 없이 전 화면 사용 가능 |
| 12 | 크론 라우트에 시크릿 없이 요청 | 401 |

### 5.6 자주 나오는 실패

| 증상 | 재지시 |
|---|---|
| 고객 화면에 초안이 보임 | "AGENTS.md 4절 위반. 고객 조회는 published 만. 모든 포털 쿼리를 점검해줘." |
| 승인에 확정 검증이 빠짐 | "7.6절 V5 위반. 승인·반려와 binding 댓글은 requireProjectVerified 를 거쳐야 한다." |
| 재발급 후에도 기존 검증이 유효 | "codeVersion 비교가 빠졌다. 7.6절 V2와 I10 대로 고쳐줘." |
| 이미지에 서명 URL 사용 | "ADR-11 위반. /api/files/[objectId] 중계로만 제공해줘." |
| P5 기능의 이벤트를 emit | "발신부가 아직 없다. dispatch 핸들러만 두고 emit 은 P5에서 한다." |

---

## 6. P5 — 홈 편집 · 운영 · 출시

### 6.1 P5-a 고객 홈 CMS 편집기

```
SITE_DESIGN.md 4.2 와 ARCHITECTURE.md 9장을 읽고
고객 '홈' 전용 블록 편집기를 /app/[companySlug]/projects/[projectId]/home-editor 에 구현해줘.

중요: CMS 는 고객 홈 한 장에만 적용된다. 디자인·자재·사진·일정·요청 화면은
고정 화면 그대로 두고 건드리지 마 (ADR-12).

[1] 블록 스키마
ARCHITECTURE.md 9.2절 blockContentSchemas 를 그대로.
블록은 참조만 저장한다(자재 id, 디자인 버전 id 등). 데이터를 복사하지 마.

[2] 편집기 (dnd-kit)
- 12열 그리드 드래그 배치 + 크기 조절 (layout: {x,y,w,h})
- 좌측 팔레트 10종: 텍스트·제목 / 이미지·갤러리 / Before&After / 디자인 파일 /
  자재 카드 / 일정·캘린더 / 댓글·요청 / 진행 공정 / 버튼·링크 / 구분·여백
- 블록 메뉴: 복제 / 숨김 / 삭제
- 우측 속성 패널 + 블록별 공개 상태(초안/검토/예약/공개)
- 자동 저장 금지. 명시적 "저장" 버튼, Server Action 한 트랜잭션
- 낙관적 동시성: pages.updated_at 을 버전 토큰으로, 충돌 시 안내
- 저장 후 updateTag 로 고객 화면 캐시 무효화
- 텍스트 블록 HTML 은 저장 시 sanitize-html 로 정제

[3] 렌더러
- components/page-builder/renderer/ 에 블록 타입별 서버 컴포넌트
- 고객 홈(/portal/[projectId]/home)에 연결하되,
  블록이 하나도 없으면 P4에서 만든 기본 레이아웃을 그대로 보여줘
- published 블록만, 참조 대상도 published 인지 재확인
- Before&After 는 두 장 모두 published 일 때만
- 버튼 블록은 대상 콘텐츠가 비공개면 비활성으로 렌더
- 모바일(<768px)에서는 좌표를 무시하고 y→x 순 1열 스택

[4] 미리보기
편집기 상단에 "고객 화면 미리보기" 토글 (실제 렌더러 사용)
```

### 6.2 P5-b 템플릿과 승격

```
docs/ARCHITECTURE.md 8.7절대로 템플릿을 구현해줘.

- 편집기 "템플릿으로 저장" → templates(scope='project')
- "템플릿 적용" → 프로젝트/업체 공통/플랫폼 공통 목록에서 선택 →
  덮어쓰기 또는 이어붙이기 → 덮어쓰기 전 확인 다이얼로그 →
  적용 직전 상태를 audit_logs.before 에 스냅샷으로 기록
- PM "공통 템플릿으로 제안" → promotionStatus='requested' +
  recordAudit('template_promote_request') + 총관리자에게 알림 emit
- /admin/templates : 업체 공통 템플릿 목록 + 승인 대기 큐.
  승인 시 scope='company' 사본을 새로 생성(원본 유지), 반려 시 사유 필수
- 권한은 6.4절 staffPolicy 그대로 (저장은 총관리자, 제안은 PM)
- /platform/templates : 플랫폼 운영자가 scope='platform' 관리,
  모든 업체 목록에 읽기 전용으로 노출
```

### 6.3 P5-c 플랫폼 콘솔과 배치

```
SITE_DESIGN.md 3.B, 4.6 대로 /platform 하위를 구현해줘.

- layout.tsx : requirePlatformAdmin('플랫폼 콘솔 접근')
- /platform/companies : 전체 업체 목록(상태·요금제·사용량·가입일)
- /platform/companies/[id] : 업체 상세, 멤버 목록, 상태 전이
  (active/past_due/suspended) → recordAudit('company_status_change') + 알림 emit
  정지 시 로그인만 차단하고 데이터는 보존
- /platform/audit-log : 업체 경계를 넘는 전체 조회(필터: 업체·행위유형·기간).
  createPlatformContext 를 거치므로 cross_tenant_query 가 기록되는지 확인
- /platform/settings : platform_settings 편집 UI
- /platform/billing : "요금제 미적용 상태" 안내만

배치:
- /api/cron/retention : 보관 기간 지난 감사 로그 정리(기본 상한 180일),
  만료 세션·인증 토큰·초대 정리
- /api/cron/storage-recalc : 업체별 storage_used_mb 재계산
- vercel.json 에 등록 (retention 매일 03:00 KST, storage-recalc 04:00 KST)
```

### 6.4 P5-d 전체 검증

```
docs/ARCHITECTURE.md 20장을 읽고 테스트를 완성해줘.

[1] tests/fixtures/seed.ts
업체 2곳 × 각 프로젝트 2개 × 고객 계정 3개.
**한 계정은 두 업체의 프로젝트에 동시에 참여하도록** 만들어줘 (20.3절).

[2] 20.2절 T-01 ~ T-17 을 전부 작성해줘. 계층 지정을 지켜줘:
- E2E(Playwright): T-01, T-03, T-04, T-08, T-12, T-17
- 통합(Vitest + 테스트 DB): T-02, T-05, T-06, T-07, T-09, T-10, T-11, T-13, T-14, T-15, T-16
- T-01~T-04 에는 @critical 태그

[3] 단위 테스트
- 공개 상태 머신(draft→published 직접 전이 거부)
- 각 모듈 policy.ts 권한 판정
- Zod 스키마 경계값
- 확정 코드 세대 비교 로직

[4] 전체 점검 — 고치기 전에 위반 목록을 먼저 보고해줘
- DataContext 없이 db 를 직접 쓰는 곳
- requireXxx 없이 시작하는 Server Action / API 라우트
- 감사 대상인데 recordAudit 가 없는 곳
- company_id 조건이 없는 쿼리
- 어댑터 폴더 밖의 벤더 SDK import
- 하드코딩된 수치 한도
- 고객 조회 경로에서 published 필터가 빠진 곳
- 승인·binding 경로에서 requireProjectVerified 가 빠진 곳
```

### 6.5 P5-e 약관·배포

```
[1] 법적 고지 페이지
- /terms : 이용약관. 업체–플랫폼 간 개인정보 처리 위탁 관계를 포함해줘
- /privacy : 개인정보처리방침. ARCHITECTURE.md 15.2절대로
  국외 이전 항목(이전받는 자 / 이전 국가 / 이전 일시·방법 / 이전 항목 /
  이용 목적 / 보유 기간)을 표로 명시해줘.
  Vercel(미국), Neon(미국), Cloudflare R2(글로벌), Resend(미국) 을 포함
- 두 문서 모두 "법률 검토 전 초안" 주석을 상단에 달아줘
- /contact : 문의 폼 (제목·내용·연락처, 운영팀 메일로 발송)
- /pricing : 현재는 "무료 사용 안내" 페이지로

[2] 개인정보 런북
docs/RUNBOOK_PRIVACY.md 와 scripts/privacy/ 를 만들어줘 (ARCHITECTURE.md 15.4절):
- 계정 기준 데이터 조회·내보내기 스크립트
- 계정 기준 파기 스크립트(DB + 스토리지 객체, 삭제 사실만 감사 로그)

[3] 배포 준비
- next.config.ts 최종 점검 (이미지 설정은 10.5절대로)
- Sentry 연동, /api/health (DB·스토리지 확인)
- README.md : 로컬 실행·환경변수·마이그레이션·배포 절차
- docs/DEPLOY_CHECKLIST.md : ARCHITECTURE.md 18장 기준
- 마이그레이션은 빌드 중 자동 실행하지 말고 별도 스크립트로 분리
  (생성 마이그레이션 → drizzle/manual/ 순서)
```

### 6.6 완료 판정 (출시 가능 기준)

| # | 확인 | 기대 |
|---|---|---|
| 1 | `pnpm test:unit && pnpm test:integration && pnpm test:e2e` | T-01~T-17 전부 통과 |
| 2 | 홈 편집기에서 블록 10종 배치 후 저장 | 위치·순서 그대로 복원 |
| 3 | 블록을 초안으로 두고 고객 홈 확인 | 미노출 |
| 4 | 블록이 없는 프로젝트의 고객 홈 | 기본 레이아웃이 보임 |
| 5 | 템플릿 저장 → 다른 프로젝트에 적용 | 구성 복제 |
| 6 | PM 제안 → 총관리자 승인 | `scope='company'` 사본 생성, 원본 유지 |
| 7 | 플랫폼 콘솔에서 타 업체 로그 조회 | `cross_tenant_query` 기록 |
| 8 | `/privacy` | 국외 이전 표 포함 |
| 9 | P5-d[4] 위반 목록 | 0건 |
| 10 | `pnpm build` | 성공 |

---

## 7. 출시 전 최종 체크리스트

### 7.1 기능

- [ ] 가입 → 업체 개설 → 고객 등록 → 프로젝트 생성 → 콘텐츠 등록 → 고객 초대 → 공개까지 한 번에 통과
- [ ] 고객이 초대 링크로 가입하고 진행 상황을 확인한다
- [ ] 고객이 확정 코드를 입력하고 디자인을 승인한다
- [ ] PM이 알림 메일을 받는다
- [ ] 모바일에서 고객 화면 전 기능이 동작한다
- [ ] 한 계정이 두 업체 프로젝트를 한 목록에서 본다

### 7.2 보안

- [ ] 다른 업체 데이터에 어떤 경로로도 접근되지 않는다 (T-01, T-02)
- [ ] 고객 계정이 `/app` 에 들어가지 못한다 (T-03)
- [ ] 초안 콘텐츠가 고객에게 노출되지 않는다 (T-08)
- [ ] 확정 코드 없이 승인이 불가능하다 (T-05)
- [ ] 코드 재발급이 기존 확정을 무효화한다 (T-06)
- [ ] 버킷이 비공개이고 외부 서명 URL이 없다
- [ ] 모든 크론 라우트가 시크릿을 검증한다
- [ ] `BETTER_AUTH_SECRET`을 운영용으로 새로 생성했다

### 7.3 법적·운영

- [ ] 개인정보처리방침에 **국외 이전 항목** 명시
- [ ] 가입 시 국외 이전 동의를 **별도 체크박스**로 받는다
- [ ] 이용약관에 업체–플랫폼 처리 위탁 관계 명시
- [ ] 위 문구를 법률 자문으로 확인했다
- [ ] 개인정보 조회·파기 런북과 스크립트가 있다
- [ ] DB 백업(스냅샷 + PITR) 활성화
- [ ] 감사 로그가 쌓이고 조회된다

### 7.4 지금 없는 것이 맞는지 재확인

- [ ] 결제 연동 없음 (스키마만)
- [ ] 요금제 제한 없음 (`plan_enforcement_enabled=false`)
- [ ] 저장공간 차단·경고 없음 (집계만)
- [ ] 알림톡 발송 없음 (채널 슬롯만)
- [ ] 소셜 로그인 없음

---

## 8. 막혔을 때

| 상황 | 대응 |
|---|---|
| 옛 Next.js 관례로 코드를 씀 | "`node_modules/next/dist/docs/`의 Next.js 16 문서를 먼저 읽고 다시 작성해줘." |
| 생성물이 문서와 다름 | 절 번호를 짚는다. "ARCHITECTURE.md 6.3절과 다르다. 그 절대로 맞춰줘." |
| 한 번에 너무 많이 만들어 검수 불가 | 더 쪼갠다. "이번엔 /materials 화면 하나만." |
| 타입 에러가 줄줄이 남 | "`pnpm typecheck` 결과의 에러를 전부 고쳐줘. `any`나 `@ts-ignore`로 덮지 마." |
| 스키마를 마음대로 바꿈 | "스키마 변경은 금지다. 되돌리고 이유만 말해줘." |
| 테넌시 누락이 의심됨 | "`src/lib/tenancy`를 우회해 company_id 없이 쿼리하는 곳을 저장소 전체에서 찾아줘. 고치지 말고 목록만 먼저." |
| 기능이 점점 늘어남 | "AGENTS.md 10절을 확인해줘. 요청하지 않은 기능은 만들지 않는다." |
| Better Auth 연동이 깨짐 | "테이블 매핑(usePlural)과 필수 컬럼을 확인해줘. 스키마를 바꾸기 전에 무엇이 부족한지 먼저 보고해줘." |
