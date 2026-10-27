# PROGRESS — A 박예원

- 스타터 버전: 2.0 (digest ad6d30540ec9ff9c) / 최종 갱신: 2026-10-14 (통합 파트 3 — A 일반 결함·시드·E2E 정리)
- 환경: 통합 dev Supabase(도쿄 리전, 세션 풀러) 연결 — 마이그레이션·pgTAP·시드·역할별 시나리오를 실 DB 로 확인함.
  통합 도구(`_integration/tools/*.mjs`)가 Supabase CLI 를 대체 (PART2_REPORT §1)
- 근거 문서: `_integration/90_reports/PART2_REPORT.md`, `_integration/90_reports/P2_scenarios.md`(52/52),
  `_integration/90_reports/CR_DECISIONS.md`, 변경 기록 `_integration/80_patches/P2_A_changes.md`·`P3_A_minor_changes.md`

## 1. 요구사항·화면 상태 (01 문서 4.1)

상태 표기
- **검증 완료(통합)** = 통합본에서 실 DB(pgTAP 161/161) + 실행 중 앱 역할별 HTTP 시나리오(52/52) + 단위 테스트로 확인
- **구현 완료(단위·DB)** = 단위 테스트·pgTAP 로 확인, 화면 상호작용 E2E(Playwright)는 아직 실행 전
- E2E: `tests/e2e/a/a-core.spec.ts` 는 파트 3 에서 문구 비의존(data-screen-id/data-ui-key)으로 정리, **미실행**

| REQ | 화면 ID | 상태 | 검증 ID | 증거 위치 | 비고 |
|---|---|---|---|---|---|
| REQ-001 업체 가입 | AUTH-02 | 구현 완료(단위·DB) | TC-001 | auth-actions.test.ts, timing.test.ts | A-03 중립 응답 + 실패 응답 시간 평준화(파트 3). 보상 삭제, IP 시간당 5회 |
| REQ-002 로그인·로그아웃 | AUTH-01 | 구현 완료(단위·DB) | TC-002 | P2_scenarios(비로그인 → 307 로그인 리다이렉트), recovery.test.ts | 단일 실패 문구, IP·이메일 제한(A-02) |
| REQ-003 초대 링크 생성·폐기 | PM-10, PM-62 | 구현 완료(단위·DB) | TC-003 | participant-actions.test.ts(A-04) | 토큰 SHA-256 만 저장, 폐기 앱 단 권한 검사 |
| REQ-004 초대 수락 | AUTH-03 | 구현 완료(단위·DB) | TC-004 | invitation.test.ts, auth-actions.test.ts | A-08: 미리보기 server-only 이동, 수락 사용자별 요청 제한 |
| REQ-005 재설정 링크·재설정 | PM-62, AUTH-04 | 구현 완료(단위·DB) | TC-005 | recovery.test.ts, pgTAP a_p2_security_scope | SEC-01(CR-INT-02)·SEC-02(amr) — AUTH-04 E2E 회귀는 미실행 |
| REQ-006 비밀번호 변경 | 헤더 계정 메뉴 | 구현 완료(단위·DB) | TC-006 | — | 현재 비밀번호 확인 |
| REQ-007 영역 선택·전환 | AUTH-05 | 검증 완료(통합) | TC-007 | P2_scenarios(field1 FW-01 자동 선택) | |
| REQ-008 언어 전환 | 헤더 | 구현 완료(단위·DB) | TC-008 | — | 쿠키 + profiles.locale |
| REQ-009 공개 랜딩 | PUB-01 | 검증 완료(통합) | — | P2_scenarios(PUB-01, health 200) | 약관 링크는 CR-INT-06 |
| REQ-010 프로젝트 목록 | PM-01 | 검증 완료(통합) | A-T01 | P2_scenarios(pm1 PM-01), scope-queries.test.ts(A-05) | '내 미답변 요청' 요약 수치 미구현 (5번 D-2) |
| REQ-011 프로젝트 생성 | PM-01 Sheet | 구현 완료(단위·DB) | A-T01 | canonical-slug.test.ts, schema.test.ts | A-09: 대문자 경로 생성, 23505 소속 재확인. PM 생성 허용(CR-A-07) |
| REQ-012 컨테이너·탭 | PM-02, CL-02, SYS-404 | 검증 완료(통합) | A-T03, A-T04 | P2_scenarios(상세 404 실측) | |
| REQ-013 개요 | PM-03 | 검증 완료(통합) | A-T06, A-T08 | P2_scenarios(PM-03) | B·C provider 실제 구현 연결(STUB 폐기 완료) |
| REQ-014 고객 홈 편집 | PM-03 `?mode=edit` | 구현 완료(단위·DB) | A-T08 | helpers.test.ts, project-forms.test.tsx(A-06) | 미리보기 공개 필터는 CR-INT-01 |
| REQ-015 내 프로젝트 | CL-01 | 검증 완료(통합) | A-T08 | P2_scenarios(cust1 CL-01) | |
| REQ-016 고객 홈 | CL-03 | 검증 완료(통합) | A-T08 | P2_scenarios(cust1 CL-03, cust3 404) | |
| REQ-017 프로젝트 설정 | PM-10 | 검증 완료(통합) | A-T05 | P2_scenarios(pm1 PM-10) | |
| REQ-018 참여자 관리 | PM-10 | 구현 완료(단위·DB) | A-T05 | participant-actions.test.ts(A-04·A-10), pgTAP | A-10: PM 재배정 시 기간 초기화·영향 행 확인 |
| REQ-019 보관·복원 | PM-10, PM-21 | 구현 완료(단위·DB) | — | — | DELETE 없음 |
| REQ-020·021 고객 카드 | PM-20, PM-21 | 구현 완료(단위·DB) | A-T02 | scope-queries.test.ts(A-11), canonical-slug.test.ts, pgTAP(DB-08) | 연결 해제·재연결(DB-08) |
| REQ-030 변경이력 | PM-40, PM-41 | 구현 완료(단위·DB) | A-T06 | — | |
| REQ-031 자동 기록 | (DB) | 베이스라인 트리거 | A-T06 | pgTAP 베이스라인 110 | 앱 코드에서 기록하지 않음 |
| REQ-040 알림 | PM-50, CL-50, FW-50 | 검증 완료(통합) | A-T07 | P2_scenarios(PM-50, FW-50), notification-queries.test.ts(A-07·A-14) | 영역별 구분 |
| REQ-041 알림 생성 | (DB) | 베이스라인 트리거 + DB-06 | — | pgTAP | 회수·기간 변경 당사자 알림 |
| REQ-050 업체 정보·로고 | PM-61 | 구현 완료(단위·DB) | A-T05 | — | 로고 업로드는 B files 실구현 |
| REQ-051 구성원 관리 | PM-62 | 구현 완료(단위·DB) | A-T05 | — | E2E A-T05 는 `settings-forbidden` 키로 판정 |
| REQ-052 기본 템플릿 | PM-63 | 구현 완료(단위·DB·로컬 화면) | TC-052, A-T52 | home-template.test.ts, template-form.test.tsx, a_home_template.test.sql | CR-A-10: 페이지 분위기(바탕색 프리셋 7종) + 고객 포털 탭별 이미지 + 안내문·색상 테마·4영역, 페이지별 미리보기. 신규 프로젝트만 적용 |
| REQ-053 저장공간 | PM-64 | 구현 완료(단위·DB) | TC-053 | — | 80% 경고 |

## 2. 추가·변경한 파일 (내 경로)

- `src/features/core/**` — access(CT01)·auth/session/project/participant/client/company/notification 액션·조회, components, schema, notifications/targets.ts
  - 파트 3 신규: `server/invitation-queries.ts`(server-only, A-08), `server/timing.ts`(A-03)
- `src/shared/lib/{rate-limit,action}.ts` (새 파일), `src/shared/ui/*` (공통 컴포넌트 + shadcn 20종)
- `src/app/layout.tsx`, `src/app/{not-found,error}.tsx`, `src/app/(public)/page.tsx`, `src/app/(auth)/**`, `src/app/auth/confirm/route.ts`, `src/app/api/health/route.ts`
- `src/app/app/**`·`src/app/portal/**`·`src/app/field/**` 의 A 소유 layout·page
- `public/fonts/PretendardVariable.woff2`, `public/fonts/Pretendard-LICENSE.txt` (OFL 1.1)
- `messages/{ko,en}/{common,auth,errors,projects,clients,history,settings,notifications}.json`
- `supabase/seed.sql` (통합 시드 기준, 비밀번호 주입식·field3/field4 추가), `supabase/migrations/20261013000100~150_a_*.sql`(파트 2)
- `tests/e2e/a/a-core.spec.ts`, 단위 테스트 `src/features/core/*.test.ts(x)`

## 3. STUB 목록

- 병합 완료로 A 의 STUB(B·C provider·files·탭 자리 page)은 전부 폐기됨 — 통합본에 `STUB(A)` 표시 파일 0개.

## 4. 변경 요청 (CR)

판정은 `_integration/90_reports/CR_DECISIONS.md` 기준. "잠정 승인" = 통합 책임자가 위임 판정으로 반영, 최종 서명 대기.

| CR ID | 요청자 | 사유 | 변경 전 → 후 | 통합 판정 | 적용 위치 |
|---|---|---|---|---|---|
| CR-A-01 → **CR-INT-01** | A | 계약에 B·C provider·해석기 export 이름이 없음 | `summaryProvider`·`documentsProvider`·`nextScheduleProvider`·`notificationTarget` 이름 고정 | **잠정 승인** (규약대로 구현 완료) | B 6개·C 3개 파일 별칭, `integration.ts` 주석은 스타터 v2.1 |
| CR-A-05 → **CR-INT-01** | A | subtitleKey 형식·고객 미리보기 공개 필터 불명확 | subtitleKey=`ns.key`, `viewer.as='customer'` 면 provider 가 공개·미보관만 반환 | **잠정 승인** | B·C provider 고객 필터 (INT-01) |
| **CR-INT-02** | 통합(A 마이그레이션) | SEC-01 재설정 링크 대상 과다 | 모든 업체 owner·타 업체 구성원·회수 참여자·타 업체 참여 고객 제외 | **잠정 승인** | `20261013000100_a_password_reset_scope.sql` |
| **CR-INT-03** | 통합(B) | 재확정 불가·사유 길이 | 유효 확정 부분 unique, 사유 CHECK 520 | **잠정 승인** | `20261013000200_b_…` |
| **CR-INT-04** | 통합(A 마이그레이션) | 시공팀이 projects 전체 열람 | 직접 조회 차단 + `project_brief`/`field_projects` RPC | **잠정 승인** | `20261013000110_a_field_project_scope.sql`, `access.ts` |
| CR-A-02 → CR-INT-06 | A | 약관·개인정보 화면 ID 없음 | PUB-02/03 등록 + 문안 | 승인 권고 (문안 필요) | 스타터 v2.1 `screens.ts`·`routes.ts` |
| CR-A-03 → CR-INT-11 | A | `next dev` 가 AGENTS.md 수정 | `agentRules: false` | 승인 권고 | 스타터 v2.1 `next.config.ts` |
| CR-A-04 → CR-INT-12 | A | shadcn `cn` import 경로 | import 를 `@/shared/lib/utils` 로 (A 방식 표준) | **승인** | README 안내 |
| CR-A-07 (신규) | A | PM 구성원의 프로젝트 생성 허용 여부 | 현행 유지: 업체 구성원(PM 포함) 생성 가능 — RLS projects insert 정책과 일치 | 정책 확인 요청 | `project-actions.ts` 주석 |
| **CR-A-10** (신규) | A | 기본 템플릿이 안내문뿐이라 고객 홈 모양(배경·테마·영역)을 업체 단위로 정할 수 없음 | `company_settings` +4컬럼(default_home_sections·home_theme·page_images·page_tone), `projects` +3컬럼(home_theme·page_images·page_tone), `project_defaults()` 확장, 배경 검사 트리거 2개. 배경은 계약 변경 없이 `company_logo` kind 재사용(1MB) | 대기 (A 경로 안에서 구현 완료) | `20261024000100_a_home_template.sql`·`20261025000100_a_page_theme.sql`, PM-63·PM-03·CL-02 레이아웃(포털 전 탭). 설계: `progress/CR_고객홈_템플릿_설계안.md` |
| CR-A-09 (신규) | A | A-08 로 `getInvitationPreview` 를 server-only 모듈로 옮기며 service_role 사용 파일이 1개 늘어남 | TC-909 허용 목록(`eslint.config.mjs`, 고정)에 `src/features/core/server/invitation-queries.ts` 추가 | 대기 | 현재는 해당 import 1줄에 근거 주석 + eslint-disable |
| (A-02 후속) | A | 프록시 홉 수 | `TRUSTED_PROXY_HOPS`(선택, 기본 1) 문서화 | 승인 권고 | 배포 런북 |

## 5. 결정 필요·충돌·규격과 다르게 한 것

- 충돌: `files` 메시지 ns / 문서 02 8장 = A … / 코드 ownership.json = B / 제안: 02 문서 수정
- 충돌: `screens.ts` 소유 / 문서 02 3장 = A … / 코드 frozen / 제안: 문서에 "변경은 CR" 명시
- 충돌: 03 문서 8.4 알림 정리 `delete` / 원칙 P-05 → CR-INT-05(운영자 배치 예외 명문화) 승인 권고
- D-1: SYS-403 별도 경로 없음 → 권한 없음은 화면 안 `ForbiddenState`, 존재 숨김은 `notFound()`(SYS-404)
- D-2: REQ-010 '내 미답변 요청' 요약 수치 — 계약에 카운트 제공자 없음. 결정 전 미표시
- A-03 응답 시간 평준화: 실패 경로는 요청 시작부터 최소 700ms(+0~150ms 지터)까지 대기. 네트워크 지터 수준 차이는 남고, 요청 제한이 2차 방어선
- 결정 필요(CR-A-10): ③ 분위기 프리셋 색(hex 14개)을 `page-theme.ts` 한 곳에 둠 — 해석 a) 현행 유지 / b) 고정 파일 `globals.css` 에 `--page-*` 토큰으로 옮기기(통합 CR). ① 배경을 `company_logo` kind 로 재사용 → 저장공간(PM-64) 종류별 합계에 '로고'로 합산됨. 해석 a) 현행 유지 / b) 계약 `FileKind` 에 `home_background` 추가(B 파일 어댑터·`FILE_RULES` 동시 변경, 용량 상향 가능). ② 기존 프로젝트 일괄 적용 — a) 미제공(POL-026 현행, 채택) / b) 버튼 추가(정책 개정 필요)
- CR-A-10 로컬 화면 확인 시 CSP `upgrade-insecure-requests` 때문에 http 로컬 Supabase 의 서명 이미지 URL 이 https 로 바뀌어 차단됨(기존 로고도 동일). 운영(https)에는 영향 없음 — 로컬 확인은 브라우저 CSP 우회로 진행
- 시드 비밀번호(A-13): `seed.sql` 에 값 없음. `app.seed_password` 를 주입해야 실행되며 미설정이면 예외로 중단(운영 실수 적용 가드). 통합 도구는 `.env.local` `SEED_PASSWORD`, E2E 는 `E2E_SEED_PASSWORD`

## 6. 평가 기록 (14.5 양식)

| 평가 ID | 평가일 | 담당 | 작업·REQ·화면 | 역할·업체·프로젝트 | 입력·행동·예상 | 실제 결과 | 증거 | 결과 | 비고 |
|---|---|---|---|---|---|---|---|---|---|
| A-T01 | 2026-10-13 | 통합 | PM-01→PM-03 | pm1·X·P1 | 목록·개요 표시 | PM-01·PM-03 200 | P2_scenarios | 통과(HTTP) | 클릭 이동 E2E 미실행 |
| A-T03 | 2026-10-13 | 통합 | TASK-002 | pm1/pm2·owner-y | 미배정·타 업체 직접 URL → 404 | 404 | P2_scenarios, access.test.ts | 통과 | |
| A-T05 | 2026-10-14 | A | TASK-007·015 | pm1·X | 업체 설정 동작 불가 | 단위 통과 | participant-actions.test.ts, e2e(미실행) | 부분 | E2E 는 `settings-forbidden` 판정 |
| A-T07 | 2026-10-13 | 통합 | TASK-010 | pm1·field1 | 영역별 알림 | PM-50·FW-50 200 | P2_scenarios, notification-queries.test.ts | 통과 | |
| A-T08 | 2026-10-13 | 통합 | TASK-006·009 | cust1·cust3 | 비공개 미노출, 미초대 404 | 404 | P2_scenarios | 통과 | 360px 시각 점검은 visual 도구 |
| A-T52 | 2026-10-24 | A | REQ-052·014·016 | owner-x·pm1·cust1·X | 템플릿(배경·파랑·순서·문서 숨김) 저장 → 새 프로젝트 고객 홈에 반영, 기존 프로젝트 불변, PM 은 금지 | 기대대로 | 로컬 Supabase + next start + Playwright 스크린샷, pgTAP 183/183 | 통과(로컬) | 통합 dev DB 미적용 |
| A-T09 | 2026-10-07 | A | TASK-003 | — | 제외 화면 없음 | 통과 | registry.test.ts | 통과 | |
| TC-018 | 2026-10-13 | 통합 | 기간 만료 시공팀 | field2 | /field·파일 404 | 404 | P2_scenarios | 통과 | |
| TC-904 | 2026-10-07 | A | safeNext | — | 외부·`//` 경로 거절 | 통과 | helpers.test.ts | 통과 | |
| TC-907·908 | 2026-10-07 | A | 화면 ID·열거형 | — | 등록·DB 일치 | 통과 | registry.test.ts | 통과 | |
| TC-911 | 2026-10-14 | A | 요청 제한 | — | 한도 초과 거절 (+초대 수락 사용자별) | 통과 | rate-limit.test.ts, invitation.test.ts | 통과 | |
| DB(RLS) | 2026-10-13 | 통합 | 전체 | — | pgTAP | 161/161 | P2C_pgtap_all.log | 통과 | 베이스라인 110 + 신규 51 |
| 시드 | 2026-10-14 | A | A-13·C-T05/06 준비 | field3·field4 | 시드 적용·로그인 | 적용·GoTrue 로그인 200 | P3_A_minor_changes.md | 통과 | |

## 7. 알려진 문제 · 다음 작업

1. E2E(Playwright) 실행: `tools/playwright.integration.config.mjs` (E2E_SEED_PASSWORD 미지정 시 `.env.local` SEED_PASSWORD 사용) → 6번 표 갱신
2. A-12(`MemberRoleSelect` 제어 컴포넌트·보관 프로젝트 스위처) — `core/components` 담당 작업
3. CR-A-09 (TC-909 허용 목록) · CR-A-07 (PM 생성 정책) 판정
4. 사용자 조치(PART2_REPORT §6): 키 교체, Auth "Allow new users to sign up" 끄기 등

## 8. 검사 결과 (2026-10-14, 파트 3 A 일반 결함)

- `npx tsc --noEmit` 0 · eslint(변경 파일) 0 · prettier 통과
- `npx vitest run src/features/core` 14파일 125개 통과, 전체 `npx vitest run` 61파일 442개 통과
- 시드: `node _integration/tools/apply-seed.mjs` 적용 완료(재실행 안전 확인), field3/field4 로그인 확인
- build·E2E 미실행 (지시 범위 밖)
