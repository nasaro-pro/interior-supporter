# 사이트 관리 진행 기록 (feature/site-admin)

기준: 통합본 '수정·구현 총정리'(10/25) 3장 A1~A11 · 내 파트 문서 '사이트 관리·시공팀 작업 계획'

## 1. 구현 상태

| ID | 내용 | 상태 |
|---|---|---|
| A1 | `/admin/login`(일반 로그인 폼 재사용, 로그인 시도 제한은 기존 액션), `platform_admins` 표로 판별, 비관리자는 404 | 구현·DB 검증 완료 |
| A2 | `/admin` 셸(메뉴 6개). 업체 승인·반려 화면은 업체관리자 파트가 이 메뉴에 붙인다 | 구현 완료 |
| A3 | 대시보드 숫자 5종 + 정지 계정 수. 승인 대기 목록은 업체관리자 파트 상태 열이 들어온 뒤 연결 | 일부 |
| A4 | 업체 목록·검색·상세, 소유자 변경(구성원만, 이전 소유자는 manager) | 구현·DB 검증 완료 |
| A4 | 업체 정지(접근 차단)·업체 화면 읽기 전용 보기 | 미구현 — 업체 상태 열(업체관리자 파트 CR-10)과 RLS 예외 필요 |
| A5 | 계정 목록·검색, 정지·해제(DB 표시 + Auth 로그인 차단), 재설정 링크, 익명화(삭제 대신) | 구현·DB 검증 완료, Auth 쪽은 미검증 |
| A6 | 업로드 한도·기본 저장공간 한도, 업체별 한도 | 구현·DB 검증 완료. 업로드 화면이 이 값을 읽는 것은 각 파트 작업 |
| A7 | 정리 후보(거부·24시간 미연결) 목록·정리, 읽은 알림 90일 정리(pg_cron 있으면 매일 03:00) | 구현·DB 검증 완료, 저장소 삭제는 미검증 |
| A8 | 관리 기록(작업한 관리자 포함) | 구현·DB 검증 완료 |
| A9 | `/terms`·`/privacy` 초안 문안 | 구현 완료(문안 검토 필요) |
| A10 | `/account/withdraw` 본인 탈퇴(유일한 소유자는 불가) | 구현·DB 검증 완료, Auth 쪽은 미검증 |
| A11 | 키 재발급·저장소 비공개·Auth 설정 | 코드 밖 작업 |
| X1 | 도안 비교 'B 비침' | 시공팀 브랜치와 별개로 이 브랜치에서는 안 함 |

## 2. 검증

- PGlite(임베디드 Postgres 17)에 전체 마이그레이션 적용 후 사이트 관리 검사 25개 통과 (`_integration` 밖 임시 스크립트)
- pgTAP 파일 `supabase/tests/a_site_admin.test.sql` — 실 dev DB 에서 `npm run db:test` 는 아직 안 돌림 (마이그레이션 미적용)
- `npm run typecheck`·`lint`·`check:messages`·`format:check`·`vitest`(545개)·`build` 통과
- `src/shared/contracts/database.types.ts` 는 PGlite 로 다시 생성한 임시 타입. dev DB 적용 후 `npm run db:types` 로 교체

## 3. 변경 요청(CR) — 고정 파일 수정 (통합 책임자 승인 필요)

| 파일 | 내용 |
|---|---|
| `src/shared/contracts/routes.ts` | `routes.admin.*`, `routes.legal.*`, `routes.withdraw` |
| `src/shared/contracts/screens.ts` | 영역 `admin`, 화면 ADM-00~07·PUB-02·03·ACC-01, 제외 목록에서 '시스템 관리자/OP 영역' 제거 |
| `src/i18n/request.ts` | 네임스페이스 `admin` |
| `eslint.config.mjs` | service_role 허용 목록에 `src/features/admin/server/auth-admin.ts` |
| `src/features/core/registry.test.ts` | A-T09 금지 경로에서 `/admin` 제거 (CR-3 로 범위에 들어옴) |
| `src/features/core/components/app-shell.tsx`·`nav-links.tsx` | 알림 종 선택 사항, 관리자 메뉴 아이콘 3개 |
| `supabase/migrations/20261026000100_a_site_admin.sql` | 새 표 4개·RPC 16개·profiles 열 2개 |

## 4. 결정 필요

- 사이트 관리자 계정 등록: `insert into public.platform_admins(user_id) values ('<uuid>');` 를 dev·운영 DB 에서 직접 실행 (화면 없음, A1)
- `check:ownership` 은 아직 A/B/C 기준이라 이 브랜치 변경은 A 경로 밖으로 잡힌다 — ownership.json 을 새 파트 기준으로 바꾸는 CR 필요
