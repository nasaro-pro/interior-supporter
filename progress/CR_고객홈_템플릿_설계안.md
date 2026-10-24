# CR 제안 · 고객 홈 템플릿 확장 (PM-63) — 설계안

> 상태: **구현 완료(로컬 검증)** — 2026-10-24. 아래 '구현 반영' 참고. 원래 상태: 설계안 · 근거: 헌법 5.9 (새 마이그레이션·새 메시지 키·새 오류 코드는 CR)
> 범위 결정: **고객 홈 템플릿** (안내문 + 배경 이미지 + 4영역 순서·표시 + 포인트 색상)

## 0. 구현 반영 (설계안과 다른 점)

- 배경 파일 종류: 새 `home_background` 대신 **기존 `company_logo` kind 재사용** — 계약(`FileKind`·`FILE_RULES`, 고정 파일)과 B 파일 어댑터를 바꾸지 않기 위해. 규격은 로고와 같은 png/jpg/webp 1MB, 열람 범위는 `can_view_file` 의 company_logo 규칙(업체 구성원 + 참여 고객).
- 테마 키: `brand·info·positive·caution·attention·neutral` (디자인 토큰 `tone-*` 그대로).
- 프로젝트별 편집(PM-03): 테마 변경, 템플릿에서 복사된 배경 표시/제거. 프로젝트별 배경 업로드는 없음(업로드 권한이 owner/manager 라서).
- 마이그레이션 `supabase/migrations/20261024000100_a_home_template.sql`, pgTAP `supabase/tests/a_home_template.test.sql`.

- 2026-10-24 변경: 이미지를 홈 맨 위 배너 → **고객 홈 전체 배경**으로 바꿈 (요청). 글은 불투명 카드·테마 상자 위에 표시, 권장 비율 16:9. 컬럼·함수 이름도 cover → background 로 통일(아직 어느 DB 에도 적용 전이라 같은 마이그레이션 파일에서 변경).

## 1. 배경

- 현재 PM-63 은 `company_settings.default_home_message`(안내문 2,000자) 하나만 저장하고, 신규 프로젝트 생성 시 트리거 `private.project_defaults()` 가 `projects.home_message` 로 복사한다 (POL-026, REQ-052).
- 요청: 안내문뿐 아니라 이미지 등으로 고객 홈 전체 모양을 업체 기본값으로 지정.
- 기존 프로젝트에는 적용하지 않는다(현행 정책 유지). 프로젝트별 수정은 PM-03 `?mode=edit` 에서 그대로.

## 2. 템플릿 구성요소

| 요소 | 업체 기본값(`company_settings`) | 프로젝트 값(`projects`) | 비고 |
|---|---|---|---|
| 안내문 | `default_home_message` (기존) | `home_message` (기존) | 변경 없음 |
| 4영역 순서·표시 | `default_home_sections jsonb` (신규) | `home_sections` (기존) | 기존 `valid_home_sections()` 재사용 |
| 배경 이미지 | `default_home_background_file_id uuid` (신규) | `home_background_file_id uuid` (신규) | 파일은 업체 소유 1개를 참조(복제 금지, POL-026 취지) |
| 포인트 색상 | `default_home_accent text` (신규) | `home_accent text` (신규) | 토큰 키 enum 5종(예: `teal/blue/amber/rose/slate`). 임의 hex 금지(색은 토큰 원칙) |

## 3. DB 변경 (신규 마이그레이션 `2026MMDD_a_home_template.sql`, A 소유)

1. `alter type public.file_kind add value 'home_background';`  (별도 트랜잭션 — 헌법 DB 장 규칙)
2. `company_settings` 에 `default_home_sections`(기본값=기존 4영역, `valid_home_sections` check), `default_home_background_file_id`(files FK, nullable), `default_home_accent`(check in 토큰 목록, nullable) 추가.
3. `projects` 에 `home_background_file_id`, `home_accent` 추가(nullable, 동일 check).
4. 배경 파일 검증 트리거: `company_logo_check()` 와 같은 방식으로 `kind='home_background' and company_id 일치 and status='ready'` 확인.
5. `private.project_defaults()` 확장: `home_message` 복사와 동일하게 sections·cover·accent 도 값이 비어 있을 때만 업체 기본값 복사.
6. `can_view_file` / files RLS: `home_background` 는 `company_logo` 와 같이 `project_id is null` + 업체 관리자만 업로드, 열람은 업체 구성원 + 해당 업체 프로젝트 참여 고객(고객 홈에서 표시해야 하므로 `can_see_company` 만으로는 부족 → 프로젝트 참여자 조회 경로 추가 필요, pgTAP 로 검증).
7. 업로드는 공통 파일 어댑터(B 소유 `src/features/files`)의 서명 URL 흐름을 `company_logo` 와 동일하게 사용. 이미지 MIME(png/jpeg/webp)·5MB 이하 제한 — 값은 결정 필요(아래).

롤백: 컬럼은 모두 nullable/기본값 있음 → 앱 코드 되돌려도 기존 동작 유지.

## 4. 화면·코드 변경 (A 소유 경로)

- `src/app/app/[company]/settings/templates/page.tsx`: 설정 값 4종 조회·전달.
- `src/features/core/components/settings-forms.tsx` `TemplateForm`: 안내문 Textarea + 배경 업로드(미리보기·제거) + 4영역 리스트(위/아래 버튼·표시 Switch, PM-03 편집 컴포넌트 재사용) + 색상 선택(라디오, 키보드 가능) + **고객 홈 미리보기**(CL-03 과 같은 컴포넌트, 읽기 전용).
- `company-actions.ts` `updateTemplate`: zod 스키마 확장(sections 순열·accent enum·cover 소유 확인), `version` 낙관적 잠금 유지, 변경이력 기록.
- `company-queries.ts` `getCompanySettings`: 신규 컬럼 매핑.
- 고객 홈(CL-03)·PM-03 편집: 배경 이미지·포인트 색상 렌더(프로젝트 값 우선).
- `messages/{ko,en}/settings.json`: 신규 키(배경·영역·색상·미리보기 문구) ko·en 동시. 새 오류 코드가 필요하면 별도 CR(`COVER_INVALID` 등) — 가능하면 기존 `VALIDATION_FAILED` 재사용.
- 테스트(헌법 11장): 정상(저장→신규 프로젝트에 복사)·예외(잘못된 sections/accent, 타 업체 파일 id, 버전 충돌)·권한 거부(pm 역할 저장 시도, 고객의 타 업체 배경 열람) + pgTAP(트리거·RLS).

## 5. 연결(타 담당 영향)

- **B**: 파일 어댑터에 `home_background` kind 허용 + 이미지 검증 규칙 추가가 필요하면 B 에 CR 통보. (A 가 `company_logo` 에 쓰는 방식과 동일하게 사용 가능한지 확인)
- **C**: 영향 없음.
- 고정 파일(`screens.ts`·`routes.ts`) 변경 없음 — PM-63 기존 화면 사용.

## 6. 결정 필요 (해석 2가지씩)

1. **적용 범위**: (a) 신규 프로젝트에만 복사(현행 정책, 권장) / (b) "기존 프로젝트에 일괄 적용" 버튼 추가 → POL-026 "이미 만든 프로젝트에는 적용 안 됨" 문구와 충돌하므로 정책 개정 필요.
2. **배경 이미지 규격**: (a) png/jpeg/webp, 5MB, 권장 비율 16:5 / (b) 용량 더 작게(2MB) — 저장공간(PM-64) 한도 영향.
3. **"웹 페이지 전체" 해석**: 이번 설계는 고객 홈 한정. 포털 전 화면 헤더·로고·색상 테마까지 확장은 별도 CR(범위가 커서 권장하지 않음).

## 7. CR 등록 항목 (진행 기록 4번 표에 옮길 행)

| CR ID | 요청자 | 사유 | 변경 전 → 후 | 적용 위치 |
|---|---|---|---|---|
| CR-A-10 | A | 업체 기본 템플릿이 안내문뿐이라 고객 홈 모양(배경·영역·색상)을 일괄 지정 불가 | `company_settings` 3컬럼·`projects` 2컬럼·`file_kind 'home_background'` 추가, `project_defaults()` 확장 | 신규 마이그레이션 `*_a_home_template.sql`, PM-63, CL-03 |
