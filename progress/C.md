# PROGRESS — C 이재서

- 스타터 버전: 2.0 / 최종 갱신: 2026-10-14 (파트 3: 디자인 통일 · C-11·C-12 · E2E 통합 시드 재지정)
- 상태 요약: TASK-200~210 구현 완료, 통합본(`_integration/20_merged`)에서 검증 중. 통합 검증: pgTAP 161/161(`90_reports/PART2_REPORT.md`) · 역할별 시나리오 52/52(`90_reports/P2_scenarios.md`). 단위 테스트 전체 504 통과(C 26 파일). E2E(`tests/e2e/c`)는 통합 시드 기준으로 재지정 — 최종 실행은 통합 책임자의 재빌드 후.
- 화면 형식: A 표준 "차분한 스튜디오"(`80_patches/P3_UI_STANDARD.md`). 8766 클론 형식(CR-C-02)은 반려되어 C kit 과 클론 시각 요소를 모두 제거했다 (`80_patches/P3_C_changes.md`).

## 1. 요구사항·화면 상태 (01 문서 4장의 내 REQ 전부)

| REQ | 화면 ID | 상태 | 검증 ID | 증거 위치 | 비고 |
|---|---|---|---|---|---|
| REQ-200 요청 목록 | PM-06, CL-06 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T02 | `lib/list-params.test.ts`, `tests/e2e/c/requests.spec.ts`, P2 시나리오(PM-06·cust2→cust1 404) | 상태 필터·제목 검색·답변 여부·최근 활동, 고객 본인 요청만(RLS+쿼리) |
| REQ-201 요청 작성 | CL-06 Sheet | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T01 | `server/actions.test.ts`, `components/request-ui.test.tsx` | 열 때 클라이언트 UUID, 23505 재시도 성공, 제출 확인(비위험) |
| REQ-202 요청 상세 | PM-16, CL-16 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T01, C-T02 | `lib/thread.test.ts`, P2 시나리오(PM-16, 남의 요청 404) | 원문→정정→답변 서버 시각순, 원문 수정 UI 없음 |
| REQ-203 정정 추가 | CL-16 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T01 | `server/actions.test.ts` | 작성자 본인(RLS), 보관 요청 차단, 상태 자동 변경 없음 |
| REQ-204 답변 작성 | PM-16 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T01 | `server/actions.test.ts` | 추가 전용 |
| REQ-205 처리 상태 | PM-16 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T02 | `schema.test.ts`, `server/actions.test.ts`, pgTAP `c_p2_status_guard` | 허용 전환만 + version·이전 상태 잠금 |
| REQ-210 사진 목록·필터 | PM-07, CL-07 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T04 | `photos/lib/list-params.test.ts`, `group.test.ts`, P2 시나리오 | 공정·촬영일 범위·업로더 독립 필터, 촬영일 묶음 |
| REQ-211 PM 다중 업로드 | PM-07 (?mode=upload) | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T03 | `upload-queue.test.ts`, `upload-pipeline.test.ts`, `photos.spec.ts` | 최대 20장, 동시 3개, 실패분만 재시도, 행 id 고정 |
| REQ-212 사진 상세 | PM-17, CL-17 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T04 | `photos.spec.ts`, P2 시나리오(비공개 사진·원본 404) | 업로더 표시, 원본 다운로드 `/api/files`(B 어댑터) |
| REQ-213 사진 수정·공개 | PM-17 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T04 | `photos/server/actions.test.ts` | 공정·촬영일·설명·공개·보관 |
| REQ-220 시공팀 현장 | FW-01 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T05, C-T06 | `photos/lib/site.test.ts`, `field.spec.ts`, P2 시나리오(field1 FW-01·field2 404) | 1곳 자동 선택·여러 곳 선택 필수, 유효 배정 없으면 field 영역 404(A 레이아웃) |
| REQ-221 시공팀 업로드 | FW-03 (?upload=1) | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T07 | `photos/server/actions.test.ts`, `field.spec.ts` | 현장명 고정, 공개 입력 없음 + DB 비공개 강제 |
| REQ-222 시공팀 사진 상세 | FW-02 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T06, C-T07 | `photos/server/actions.test.ts` | 본인 사진만 수정, 공개·보관 없음 |
| REQ-230 프로젝트 일정 | PM-08, CL-08 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T08 | `schedule/lib/calendar.test.ts`, `ScheduleBoard.test.tsx` | 일요일 시작 월간(md+)·타임라인·모바일 주간 목록 |
| REQ-231 일정 등록·수정 | PM-08, PM-18 Sheet | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T08 | `schedule/schema.test.ts`, `server/actions.test.ts` | 종일·종료일 포함·시각 순서 검증, 관련 항목 서버 재검사 |
| REQ-232 일정 상세 | PM-18, CL-18 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T08, C-T09 | `schedule.spec.ts`, P2 시나리오(비공개 일정 404) | 관련 항목은 볼 수 있을 때만 링크(사진 이름은 `photoLabel`, C-11) |
| REQ-233 전체 캘린더 | PM-30 | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | C-T09 | `schedule/server/queries.test.ts`, P2 시나리오(PM-30) | 편집 가능 프로젝트만, 칩 → PM-18 |
| REQ-234 C 연동 제공 | (계약) | 구현 완료 · 통합 검증(단위·pgTAP·시나리오), E2E 재빌드 후 확정 | A-T07 연동 | `requests/server/integration.test.ts`, `photos/lib/label.test.ts` | summary 3종·해석기 3종, 사진 제목 빈 값 없음(C-11) |

## 2. 추가·변경한 파일 (내 경로)

- `messages/{ko,en}/{requests,photos,schedule}.json` — 키 집합 ko·en 동일 (P3 에서 변경 없음)
- `src/features/requests/**` — 스키마·타입·쿼리·액션·연동, C 공용 서버 도우미 `lib/action-helpers.ts`(C-12), 테스트 가짜 공개 진입점 `testing/index.ts`. **P3: `components/kit/**`·`lib/eyebrow.ts` 삭제, UI 는 `@/shared/ui/*` 사용**
- `src/features/photos/**` — 목록·필터·상세·수정·공개·보관, 업로드 큐·실행기·EXIF, 시공팀 현장, 사진 표시 이름 `lib/label.ts`(C-11)
- `src/features/schedule/**` — 달력 계산·보기 상태, 월간·주간·타임라인·폼·상세, 관련 항목, 전체 캘린더
- 화면 page 15개 + 목록 `(list)/loading.tsx` 7개 + `error.tsx` 15개(표준 `RouteError`). 상세 loading.tsx 없음(상세 notFound = 실제 404)
- `tests/e2e/c/{requests,photos,field,schedule}.spec.ts`, `tests/e2e/c/support/env.ts` (통합 시드)
- `progress/C.md`

## 3. STUB 목록

없음. 개발용 STUB(core·로그인·프로젝트 셸·파일 어댑터·`dev-seed-c.ts`)은 병합 때 A·B 실구현과 통합 시드로 대체되어 폐기됐다.

## 4. 변경 요청 (CR)

| CR ID | 내용 | 결정 (`90_reports/CR_DECISIONS.md`) | C 반영 |
|---|---|---|---|
| CR-C-01 | shadcn `cn` 경로·C 전용 UI kit | CR-INT-12 로 통합, A 표준으로 해결 | P3 에서 C kit 삭제, A 표준(`@/shared/ui/*`)으로 교체 |
| CR-C-02 | 8766 클론 디자인 토큰 | **반려** (02 문서 7.7·헌법 10.5 충돌) | 클론 시각 요소 전부 제거 (P3_C_changes.md 1·2장) |
| CR-C-03 | `next dev` 가 AGENTS.md 수정 → `agentRules:false` | CR-INT-11 로 이관 (승인 권고) | 해당 없음 (C 코드 변경 없음) |

## 5. 결정 필요·충돌·규격과 다르게 한 것

1. **해결 — requests.detail.sharedVisibility 충돌**: POL-018(작성자 본인만 열람)과 반대 문구라 키를 삭제하고 `detail.ownOnly` 하나만 둠 (C 결정 2026-10-07, 중복 키 없음).
2. **결정 — 고객 화면 사진 업로더 표시** (C 결정 2026-10-07): CL-07·CL-17 에 업로더 표시, CL-07 업로더 필터도 제공. 선택지는 고객이 볼 수 있는 공개 사진 기준(RLS)이라 비공개 사진의 업로더는 드러나지 않음. 프로필을 볼 수 없으면(can_see_profile) 역할만 "업체/시공팀". ※ 02 문서 5장 "고객 화면에는 내부 행위자를 그리지 않음" 과 해석 차이 — 통합 책임자 확인 필요.
3. **결정 — 일정 관련 항목의 다른 프로젝트 연결** (C 결정 2026-10-07): 같은 업체에서 편집 가능한 프로젝트의 항목까지 선택 가능(폼에서 프로젝트별 묶음). 저장 때 서버가 "현재 사용자에게 보이고 같은 업체" 인지 다시 검사하고, 아니면 존재를 숨긴 채 `relatedId` 필드 오류(P-01). 상세는 항목이 속한 프로젝트의 정규 경로로 링크하고 "다른 프로젝트: 이름" 표시, 볼 수 없으면 링크 없음. ※ 세부문서 6장 "별도 합의" 항목 — 통합 책임자 확인 필요(헌법 3.5 정책 해석).
4. **결정 — 연동 export 이름** (C 결정 2026-10-07): 계약은 경로·타입만 정하므로 **계약 타입 이름의 camelCase + 같은 값의 default export** 로 통일 — `summary.ts` = `summaryProvider`(requests·photos) / `nextScheduleProvider`(schedule), `notification-target.ts` = `notificationTargetResolver`. A 등록부 예시는 9장. B 도 같은 규약이면 A 가 한 가지 방식으로 가져옴 → A·B 와 공유 필요.
5. **규격과 다르게 한 것: 목록 '더 보기'** — 03 문서 "커서 = 마지막 행" 대신 표시 개수 누적(`?size=30·60…`, 최대 300). 이유: 사진 촬영일 묶음 정렬(촬영일 desc nulls last → created_at → id)에서 3중 커서가 복잡하고, JS 없이 뒤로가기·새로고침에서도 누적 목록이 유지됨. 화면 결과(30개 단위 누적)는 같음.
6. **규격과 다르게 한 것: 업로드 진행률** — supabase-js `uploadToSignedUrl` 은 바이트 진행 이벤트가 없어 단계 기반(대기·올리는 중·확인 중·저장 중·완료) 진행 막대로 표시.
7. **해결(P3) — 화면 형식**: 8766 클론 형식(CR-C-02)은 **반려**. 파트 3 에서 C 전용 kit(`requests/components/kit/**`)과 클론 시각 요소(글자 롤링·괘선 프레임·칸 탭·순차 등장·반경 0·eyebrow 캡션·대형 분할 제목·흐린 배경·임의 px 글자)를 모두 제거하고 A 표준(`@/shared/ui/*`, `80_patches/P3_UI_STANDARD.md`)으로 교체했다. 변경 목록: `80_patches/P3_C_changes.md`.
8. **HEIC (헌법 11장 C 주의)** — `.heic/.heif` 는 선택 단계에서 거절하고 `files.dropzone.heic` 안내(아이폰 "높은 호환성"). 실기기 확인은 미검증.
9. **환경: Node v26** (규격 24). `npm install` EBADENGINE 경고, 빌드·테스트는 통과.
10. **해결 — `ai/` A·B 문서 누락**: 배포 문서 묶음에서 받아 넣음(매니페스트 해시 일치) → 소유권 위반 0.
11. **환경: SWC 캐시 권한 (이 PC 만)** — `@swc/core` 1.16(next-intl 플러그인이 로드)이 `%LOCALAPPDATA%\swc` 의 ACL(앱 컨테이너 SID 상속)을 거부. 이 PC 의 `.env.local`(제출·공유 안 됨)에 `SWC_NATIVE_BINDING_CACHE`(소유자 전용 ACL 폴더)를 넣어 해결. 프로젝트 공유 파일에는 아무 설정도 없으므로 **다른 PC 는 조치 없이 실행**.
12. **해결(통합) — Supabase 키·DB 타입**: 통합 dev Supabase 에 연결, `database.types.ts` 는 통합 책임자가 실 DB 로 생성(파트 2). 로컬 타입 생성기는 더 쓰지 않는다.
13. **해결(통합) — C 전용 시드 STUB 폐기**: `supabase/dev-seed-c.ts`·`.env.test.local` 대신 통합 시드(`supabase/seed.sql` + `tools/seed-extra.mjs`, `90_reports/seed_map.md`)를 쓴다. E2E 비밀번호는 `E2E_SEED_PASSWORD` 환경변수로만 받는다.
14. **세부문서(분담 제안 v1.0) 대비** — 열린 질문은 01 문서 7장 결정 대장의 확정값을 따름(헌법 1.5). 세부문서에서 추가 반영: C-T06 회수 케이스·상세·다운로드 차단 검증, PM-30 뒤로가기 시 달·필터 복원(URL 상태), 인수인계 산출물(아래 9장).

## 6. 평가 기록 (00 헌법 14.5 양식)

| 평가 ID | 평가일 | 담당 / 교차 검토자 | 작업·REQ·화면 ID | 대상 역할·프로젝트 | 예상 결과 | 실제 결과 | 증거 위치 | 결과 |
|---|---|---|---|---|---|---|---|---|
| C-T01 | 2026-10-14 | C / 통합 | REQ-201~204, CL-06·CL-16·PM-16 | cust1·pm1, P1 | 작성 → 답변 → 정정, 원문 보존·시각순 | 단위·컴포넌트 테스트 통과, E2E 는 아래 8장 | `requests.spec.ts`, `request-ui.test.tsx` | E2E_RESULT_T01 |
| C-T02 | 2026-10-14 | C / 통합 | REQ-200·205, PM-06·CL-06 | cust1·cust2·cust3·owner-y | 남의 요청·타 업체 404 | P2 시나리오 통과(cust2→701 404, cust1→703 404) | `P2_scenarios.md`, `requests.spec.ts` | 통과(시나리오) |
| C-T03 | 2026-10-14 | C / 통합 | REQ-211, PM-07 | pm1, P1 | 1장 실패 → 실패분만 재시도 → 3장 | 큐·실행기 단위 통과 | `photos.spec.ts` | E2E_RESULT_T03 |
| C-T04 | 2026-10-14 | C / 통합 | REQ-210·212·213, CL-07·CL-17 | pm1·cust1, P1 | 비공개 사진·원본 404(no-store), 공개 후 열람 | P2 시나리오 통과(502 404, 원본 404) | `P2_scenarios.md`, `photos.spec.ts` | 통과(시나리오) |
| C-T05 | 2026-10-14 | C / 통합 | REQ-220, FW-01 | field1·field3 | 1곳 자동 선택, 여러 곳 선택 전 업로드 비활성 | P2 시나리오 field1 FW-01 통과 | `field.spec.ts` | E2E_RESULT_T05 |
| C-T06 | 2026-10-14 | C / 통합 | REQ-220, FW-01·FW-02 | field2·field4·field1 | 영역·상세·다운로드 404, 다른 현장 id 404 | P2 시나리오 field2 404 통과 | `P2_scenarios.md`, `field.spec.ts` | 통과(시나리오) |
| C-T07 | 2026-10-14 | C / 통합 | REQ-221, FW-03 | field1·pm1, P1 | 업로드 → 같은 현장 목록, 비공개 저장 | 액션 단위 통과 | `field.spec.ts` | E2E_RESULT_T07 |
| C-T08 | 2026-10-14 | C / 통합 | REQ-230·231, PM-08·PM-18·PM-30 | pm1, P1 | 일요일 시작, 시각 순서 검증, PM-08·PM-30 같은 값 | 달력·스키마·액션 단위 통과 | `schedule.spec.ts` | E2E_RESULT_T08 |
| C-T09 | 2026-10-14 | C / 통합 | REQ-232·233, PM-30·CL-18 | pm1·cust1 | PM-30 → PM-18 복원, 비공개 일정 404 | P2 시나리오 통과(603 404) | `P2_scenarios.md`, `schedule.spec.ts` | 통과(시나리오) |

## 7. 알려진 문제 · 다음 작업

- 통합 책임자 재빌드 후 `tests/e2e/c` 를 desktop·mobile 로 실행해 6번 E2E 결과를 확정한다(현재 서버는 P3 이전 빌드라 새 화면이 반영되지 않음).
- 업로드 중 다른 파일을 다시 시도하면 진행 중 작업자가 이어서 처리한다. 작업자가 모두 끝난 직후의 재시도는 '올리기' 를 다시 눌러야 할 수 있음(일반 등급).
- 실기기(iOS Safari·삼성 인터넷)·HEIC 확인 미실시.
- 표준 gap(상세 머리 부품·탭 본문 머리·GET 필터 필드 래퍼·파일 드롭 상자)은 `P3_C_changes.md` 5장 — A 공통화 후보.

## 8. 검사 결과 (2026-10-14, 통합본)

- `npx tsc --noEmit`: C 경로 0 오류 (B `src/features/materials/*` 작업 중 오류만 남음 — C 무관)
- `npx eslint`·`npx prettier`: C 변경 파일 통과
- `npx vitest run`: 68 파일 504 테스트 통과 (C: requests·photos·schedule 전부)
- pgTAP 161/161, 역할별 시나리오 52/52 (파트 2 통합 실측)
- E2E(이전 빌드 3123, desktop, 시드·로그인·선택자 확인용): E2E_SUMMARY

## 9. 인수인계 (세부문서 8장 산출물)

**화면·라우트**: PM-06 `/app/{c}/projects/{p}/requests` · PM-16 `…/requests/{id}` · PM-07 `…/photos` (업로드 `?mode=upload`) · PM-17 `…/photos/{id}` · PM-08 `…/schedule` (`?view=month|timeline&month=&day=`, 등록 `?mode=new`) · PM-18 `…/schedule/{id}` (수정 `?mode=edit`) · PM-30 `/app/{c}/calendar?month=&projects=` · CL-06/16·07/17·08/18 `/portal/projects/{p}/…` (작성 `?mode=new`) · FW-01 `/field/photos?project=` (업로드 `&upload=1` = FW-03) · FW-02 `/field/photos/{id}?project=`. 모든 링크는 `routes.ts`.

**데이터 정의**: `requests`(제목·원문 불변) · `request_corrections`(작성자만) · `request_replies`(편집자, 추가 전용) · `photos`(file_id·thumb_file_id, phase, captured_on, uploader_role) · `schedule_events`(start/end date·time 달력 값, related_type/id) — 베이스라인 그대로, 새 테이블·컬럼 없음. 상태 변경 이력·알림은 DB 트리거.

**시공팀 규칙**: 유효 배정 = 미회수 + KST 오늘이 valid_from~valid_until(양 끝 포함). 0곳 안내 / 1곳 자동 선택 / 여러 곳 선택 필수. 배정 밖 현장 id 는 목록·상세 모두 404. 업로드는 서버·DB 가 비공개 강제, 본인 사진만 공정·촬영일·설명 수정.

**사진 파일 규격·부분 실패**: png/jpg/jpeg/webp 20MB, 한 번에 20장, HEIC 안내 후 거절. 파일별 단계(intent → 서명 업로드 → finalize → 사진 행). 사진 행 id 는 큐에 넣을 때 고정 → 재시도해도 1행. 업로드 실패는 같은 files 행 재사용, finalize 거절은 새 files 행. 성공분은 즉시 목록 반영.

**캘린더 원본 연결**: PM-08·PM-30·CL-08·홈 다음 일정이 모두 `schedule_events` 한 테이블을 조회(`server/queries.ts`·`server/summary.ts`). 저장 시 프로젝트 일정·전체 캘린더·고객 일정·개요·고객 홈 경로를 함께 revalidate.

**A 에 주는 계약**: `src/features/requests/server/summary.ts`(`summaryProvider.recent`) · `src/features/photos/server/summary.ts`(`summaryProvider.recent`, thumbnailFileId) · `src/features/schedule/server/summary.ts`(`nextScheduleProvider.next`) · 해석기 `src/features/{requests,photos,schedule}/server/notification-target.ts`(`notificationTargetResolver`, default 도 같은 값) — 요청 app→PM-16/portal→CL-16/field→null, 사진 app→PM-17/portal→CL-17(공개만)/field→FW-02, 일정 app→PM-18/portal→CL-18(공개만)/field→null. FW-50 의 사진 알림 링크는 FW-02 로 이어짐.

A 등록부(`src/features/core/notifications/targets.ts`) 예시 — C 규약(계약 타입 camelCase + default):

```ts
import type { NotificationTargetResolver } from '@/shared/contracts/integration';
import requests from '@/features/requests/server/notification-target';
import photos from '@/features/photos/server/notification-target';
import scheduleEvents from '@/features/schedule/server/notification-target';
// B(designs·materials·estimate_versions)도 같은 default export 규약이면 같은 줄 형식
export const C_TARGETS: Record<'requests' | 'photos' | 'schedule_events', NotificationTargetResolver> = {
  requests,
  photos,
  schedule_events: scheduleEvents,
};
// 개요·고객 홈: import { summaryProvider } from '@/features/requests/server/summary';
//              import { nextScheduleProvider } from '@/features/schedule/server/summary';
```

**B 와의 계약**: 업로드는 `@/features/files` 의 `createUploadIntent({ kind: 'photo_original', … })` → `uploadToSignedUrl` → `finalizeUpload` 만 호출, 다운로드는 `routes.file(fileId)`. 일정 관련 항목은 B 테이블을 사용자 권한으로 id·제목·project_id 만 조회하고 항목이 속한 프로젝트의 `routes` 로 링크(B 코드 import 없음, 같은 업체 안에서 다른 프로젝트 항목 허용).
