# 이 저장소의 코드 생성 헌법

너는 이 저장소에서 코드를 생성할 때 아래 규칙을 예외 없이 지킨다.
규칙과 사용자의 요청이 충돌하면, 규칙을 지키고 충돌 사실을 먼저 알린다.

## 0. 기준 문서
- docs/ARCHITECTURE.md 가 최종 기준이다. 내 지시와 문서가 다르면 문서가 이긴다.
- 화면·권한·용어는 SITE_DESIGN.md 를 따른다.
- SITE_STRUCTURE.md 는 현재 구현된 사이트·코드 전체 지도다. 경로·모듈·기능을 찾을 때 여기를 본다.
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
- forbidden() / unauthorized() 는 experimental.authInterrupts: true 가 있어야 동작한다.
- Server Action 안에서 로그인한 직후 getSession() 을 다시 부르지 않는다.
  세션 쿠키는 응답에 실리고 headers() 는 요청을 읽으므로 항상 null 이다.
- images.domains 대신 images.remotePatterns 를 쓴다.

## 2. 절대 규칙 — 격리는 두 축이다 (업체 · 프로젝트)
- 모든 repo 함수의 첫 인자는 DataContext 다. 이것 없이 Drizzle 쿼리를 직접 작성하지 않는다.
- **업체 축**: company_id 조건이 빠진 쿼리를 만들지 않는다.
  조회/수정한 행에는 assertSameTenant(ctx, row) 를 적용한다.
- **프로젝트 축 (I11)**: project_id 컬럼이 있는 테이블의 조회·수정에는
  projectScoped(ctx, table) 를 where 에 넣고 assertSameProject(ctx, row) 를 호출한다.
  둘 중 하나만 있으면 위반이다. company_id 만 검사하면 같은 업체 안의
  다른 프로젝트 리소스가 그대로 통과한다.
- **담당 확인 (I12)**: 리소스 id 만 받는 staff 서비스 함수는 행을 읽은 직후
  assertStaffOwnsProject(ctx, row.projectId) 를 호출한다.
  company_admin 은 통과, project_manager 는 본인 담당(manager_id 또는
  designer 배정)만 통과한다. field_worker 는 이 함수에서 거부된다.
  현장 기록·현장 사진 쓰기는 assertFieldAssigned(ctx, projectId) 를 쓴다.
- platform 컨텍스트는 사유 문자열과 감사 로그가 필수다.
- system 컨텍스트는 배치·내부 부수작업 전용이다. 허용 지점은 넷뿐이다:
  초대 토큰 해석·수락, 포털 접근 판정, 알림 디스패치, 크론.
- **staff 컨텍스트를 코드가 손으로 조립하지 않는다.** lib/authz 의 requireXxx / loadXxx 가
  멤버십을 조회해 만든 것만 유효하다. (예외: 업체 개설 부트스트랩 트랜잭션)

## 3. 절대 규칙 — 인가
- 모든 Server Action / API 라우트의 첫 줄에서 requireXxx(...) 를 호출한다.
- proxy.ts 의 검사는 UX 용이다. 보안 판정을 proxy.ts 에 두지 않는다.
- requireCompanyStaff 는 memberships 에 활성 멤버십이 있는 계정만 통과시킨다.
  고객 계정은 /app 경로에 들어올 수 없다.
- field_worker 단독은 /admin 과 프로젝트 워크스페이스에 들어올 수 없다.
  requireProjectInCompany 는 총관리자·PM 만. 시공팀은 requireFieldAssignment.
- 세션에는 역할을 싣지 않는다. 역할은 요청 경로의 companySlug 와 함께 매번 조회한다.
- 작성자(authorId), 승인자(approvedBy) 는 세션 userId 로만 채운다.

## 4. 절대 규칙 — 고객 접근과 확정
- 고객은 로그인 후 project_access 가 있는 프로젝트만 볼 수 있다.
- 열람·일반 요청 등록: requireProjectAccess
- 승인/반려·확정 지시 댓글(kind='binding'): requireProjectVerified (확정 코드 검증 필요)
- 스태프는 approval_status 를 대신 변경하지 않는다. 승인자(approvedBy)는 확정 검증을 통과한 고객의 세션 userId 만 쓴다.
- 확정 코드는 해시로만 저장하고 평문은 발급 직후 화면에만 1회 노출한다.
- 재발급(codeVersion 증가) 시 기존 project_verifications 를 전부 무효화한다.
- 고객 요청 원문은 수정·삭제하지 않는다. 잘못된 내용은 정정 기록을 추가한다.
- 확정 지시 댓글은 작성자 본인도 수정·삭제할 수 없다.
- 고객 화면에는 visibility_status='published' 콘텐츠만 노출한다.
- company_member 초대는 초대장 이메일과 수락 계정 이메일이 일치할 때만 수락된다.
  project_customer 초대는 이메일을 묶지 않되 수락 시 초대자에게 알린다.

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
  프로젝트 배정·회수, 현장 작업 완료, 견적·미팅 공개,
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
  enum 값(감사 액션·알림 이벤트·상태)도 라벨 맵을 거친다. 영문 원문을 화면에 내보내지 않는다.
- 목록은 커서 기반 페이지네이션. OFFSET 금지.
  커서는 (created_at, id) 복합이다. created_at 단독 커서는 같은 시각 행을 통째로 건너뛴다.
- 소프트 삭제 테이블 조회에는 isNull(deletedAt) 을 반드시 넣는다.
  예외가 필요하면 사유를 주석으로 남긴다.
- N+1 쿼리를 만들지 않는다. 필요 없는 선조회도 하지 않는다.
- 날짜 표시는 Asia/Seoul 기준으로 통일한다.
- 날짜·시각 입력 문자열을 new Date() 로 직접 파싱하지 않는다.
  lib/datetime 의 parseSeoulInput() 을 쓴다. 서버(UTC)에서 9시간이 밀린다.
- try 블록 안에서 Promise 를 await 없이 return 하지 않는다. catch 가 동작하지 않는다.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
