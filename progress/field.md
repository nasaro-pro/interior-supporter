# 시공팀 진행 기록 (feature/field)

기준: 통합본 '수정·구현 총정리'(10/25) 7장 F1~F13 · 내 파트 문서 '사이트 관리·시공팀 작업 계획'

## 1. 구현 상태

| ID | 내용 | 상태 |
|---|---|---|
| F1 | `/field` 내 현장 카드(FW-00): 업체·주소·배정 기간·오늘 일정(일정 탭이 켜진 현장만). 시공팀 홈을 사진 → 내 현장으로 | 구현·DB 검증 완료 |
| F2 | 담당자가 프로젝트 설정(PM-10)에서 일정·확정 도안·확정 자재 탭을 켠다(기본 모두 꺼짐). 시공팀은 켠 탭만 보기 — `/field/sites/[project]/{schedule,designs,materials}` (FW-04~06). 단가·견적·고객 연락처 없음 | 구현·DB 검증 완료 |
| F3 | GIF·BMP 를 브라우저에서 JPEG 로 바꿔 올림 (TIFF 는 보류 — 서버 허용 형식 CR 필요, HEIC 는 디자이너 파트) | 구현 완료(브라우저 미검증) |
| F4 | 긴 변 4000px 초과 사진은 브라우저에서 축소. 원본 상한 60MB, 줄인 뒤 20MB 재검사. EXIF 촬영일은 줄이기 전에 원본에서 읽음 | 구현 완료(브라우저 미검증) |
| F5 | 서명 URL 업로드를 XHR 로 보내 바이트 진행률 표시 (요청 모양은 uploadToSignedUrl 과 같음) | 구현 완료(실 Storage 미검증) |
| F6 | 네트워크 실패 자동 재시도 2회(1초·3초), 업로드 도중 누른 재시도가 '대기'로 남던 문제 수정 | 구현·단위 검증 완료 |
| F7 | 사진마다 공정 선택 (기본은 공통 공정) | 구현 완료 |
| F8 | 시공팀은 고객 공개 전 본인 사진만 보관(숨김) 가능, 공개된 사진은 거부 | DB 구현·검증 완료 (화면 버튼은 기존 사진 화면 그대로) |
| F9 | '시공팀 사진 바로 공개' 켜면 시공팀 사진이 공개로 저장. 사진 화면 안내 문구도 설정에 맞게 바뀜 | 구현·DB 검증 완료 |
| F10 | 시공팀 메모 | 미구현 — 디자이너 파트 메모(D-32·33) 구조가 들어온 뒤 같은 구조로 |
| F11 | 일정 탭이 켜진 현장의 일정이 바뀌면 시공팀에게도 알림, 알림을 누르면 FW-04 로 | 구현·DB 검증 완료 |
| F13 | 시공팀 현장 화면에 프로젝트 페이지 분위기(page_tone) 적용 | 구현 완료 |
| POL-006 | 배정 기간이 끝난 현장은 바로 차단 (기존 is_field_on 그대로) | 유지·검증 완료 |

## 2. 검증

- PGlite(임베디드 Postgres 17)에 전체 마이그레이션 적용 후 시공팀 검사 13개 통과, pgTAP 파일 `supabase/tests/c_field_access.test.sql` 26개를 pgTAP 대역으로 실행해 통과 (`_integration` 밖 임시 스크립트)
- 실 dev DB 에서 `npm run db:test` 는 아직 안 돌림 (마이그레이션 미적용)
- `npm run typecheck`·`lint`·`check:messages`·`format:check`·`vitest`(569개)·`build` 통과
- 브라우저에서 직접 눌러 보지는 않음: 이미지 변환·축소, XHR 업로드(CORS·apikey 헤더), 진행 막대
- `src/shared/contracts/database.types.ts` 는 PGlite 로 다시 생성한 임시 타입. dev DB 적용 후 `npm run db:types` 로 교체

## 3. 변경 요청(CR) — 고정 파일·남의 경로 수정 (통합 책임자 승인 필요)

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20261026000200_c_field_access.sql` | 새 표 `project_field_settings`, RPC 5개(`field_sites`·`field_site`·`field_schedule`·`field_designs`·`field_materials`), `can_view_file`·`row_visible_photos`·`photo_before_insert`·`photo_before_update`·`notify_schedule` 교체 |
| `src/shared/contracts/routes.ts` | `routes.field.home`·`siteHome`·`site` |
| `src/shared/contracts/screens.ts` | 화면 FW-00·04·05·06, `FIELD_TABS`, 제외 목록에서 '시공팀 내 현장 목록' 제거 ('시공팀 오늘 작업' 화면은 여전히 제외 — 카드 안 오늘 일정만) |
| `src/i18n/request.ts` | 네임스페이스 `field` |
| `src/app/field/layout.tsx`·`page.tsx` (A) | 시공팀 홈을 내 현장으로, 메뉴에 '내 현장' |
| `src/app/app/[company]/projects/[project]/settings/page.tsx` (A) | '시공팀 공개 범위' 구역 |
| `src/features/core/server/notification-queries.ts` (A) | 시공팀 영역 알림 종류에 `schedule_changed`, 시공팀 영역 알림은 시공팀 링크로 |
| `src/features/photos/components/PhotoUploadSheet.tsx` | 브라우저 Supabase 클라이언트 대신 XHR 로 서명 URL 업로드 (ADR-002 '브라우저는 서명 URL 업로드만' 범위 안, 방식만 다름) |

## 4. 결정 필요

- XHR 업로드에 `apikey`(공개 anon 키) 헤더를 붙였다. 서명 URL 업로드가 이 헤더 없이도 되는지 dev 에서 확인 후 뺄지 결정
- TIFF 업로드(F3 보류분): 서버 `FILE_RULES.photo_original` 에 형식 추가 CR 이 필요
- `check:ownership` 은 아직 A/B/C 기준이라 이 브랜치 변경 대부분이 C 경로 밖으로 잡힌다 — ownership.json 을 새 파트 기준으로 바꾸는 CR 필요
