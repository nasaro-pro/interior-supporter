# PROGRESS — B 류영걸

- 스타터 버전: 2.0 (digest ad6d30540ec9ff9c)
- 최종 갱신: 2026-10-19 (통합 파트 3)
  - B 에이전트가 E2E 작성 중 중단돼, 통합 책임자가 점검·기록을 마무리했다.
  - 변경 기록: `_integration/80_patches/P2_B_changes.md`, `P3_B_changes.md`
- 통합 상태: 스타터 + A·B·C 병합본(`_integration/20_merged`)에서 아래가 모두 통과
  - `npm run check`
  - 통합 dev Supabase pgTAP 161/161 (B 신규 `b_p2_reconfirm` 포함)
  - 역할별 시나리오
  - 통합 인수 테스트
  - E2E `tests/e2e/b/b-core.spec.ts`
- 상태 표기
  - **검증 완료(통합)**: 실제 서버·DB 에서 자동 검증 증거가 있음
  - **검증 완료(단위)**: 단위 테스트만 있음
- 제출 당시(10/07)의 "build 실패 · db:test 미실행"은 해소됐다.
  - build: 통합 환경 Node 24 에서 성공
  - db:test: 통합 dev 에서 실행

## 1. 요구사항·화면 상태

| REQ | 화면 ID | 상태 | 검증 ID | 증거 |
|---|---|---|---|---|
| REQ-060·061 파일 어댑터 | (공통) | 검증 완료(통합) | B-T01, B-T02, TC-903 | `P3_e2e.md`(TC-903), `P3_acceptance.md`(TC-903 60초·no-store), `P2_scenarios.md`(비로그인·비공개 404), `files/server/*.test.ts` |
| REQ-100 도안 목록 | PM-04, CL-04 | 검증 완료(통합) | B-T01 | `P2_scenarios.md`, E2E 고객 도안 목록 |
| REQ-101 도안 업로드 | PM-04 | 검증 완료(단위·DB) | B-T01 | `create_design` RPC (pgTAP), `designs/server/actions.test.ts` |
| REQ-102 새 버전 | PM-14 | 검증 완료(단위·DB) | B-T02 | pgTAP(DB-01 새 버전 → 재확인), B-09 `reconfirmedBy` 테스트 |
| REQ-103 상세·원본 | PM-14, CL-14 | 검증 완료(통합) | B-T02 | E2E: 고객에게 과거 버전 숨김, 원본 다운로드 가능 / 시나리오: 과거 버전 파일 404·현재 버전 302 |
| REQ-104 비교 이미지 | PM-14 | 검증 완료(단위) | B-T02 | `PreviewAddButton`, pdf 렌더 단위 테스트 |
| REQ-105 A/B 슬라이더 | PM-14, CL-14 | 검증 완료(통합) | B-T03~05 | E2E: 16:10·←→/Shift/Home/End·aria-valuetext·같은 이미지 선택 불가 / `CompareSlider.test.tsx`(복구·재시도) |
| REQ-106 수정·공개 | PM-14 | 검증 완료(단위) | B-T10 | `actions.test.ts`(보관 거부·NOT_FOUND/VERSION_CONFLICT 구분) |
| REQ-110 자재 목록·필터 | PM-05, CL-05 | 검증 완료(통합) | B-T06 | E2E TR-02~04, B-11 검색 테스트 |
| REQ-111 자재 등록·수정 | PM-05, PM-15 | 검증 완료(통합) | B-T06 | E2E: Sheet 수정 후 같은 D4, 360px |
| REQ-112 자재 상세 | PM-15, CL-15 | 검증 완료(통합) | B-T06 | 시나리오: 공개 CL-15 / 비공개 404 |
| REQ-113 자재 공개 | PM-15 | 검증 완료(통합) | B-T10 | 시나리오(A-T08), 인수 INT-02 |
| REQ-120 고객 확정 | CL-14, CL-15 | 검증 완료(통합) | B-T07, B-T08 | E2E 확정 흐름, 인수 INT-04 (stale_revision, 유효 확정 1건) |
| REQ-121 재확인 | PM-14, PM-15 | 검증 완료(통합) | B-T08 | E2E: 단가 수정 → 재확인 필요 → 재확정 / pgTAP DB-01·DB-02 |
| REQ-130 견적 목록 | PM-09, CL-09 | 검증 완료(통합) | B-T09 | 인수 INT-08 (고객 목록에 v2 없음) |
| REQ-131 견적 생성·새 버전 | PM-09, PM-19 | 검증 완료(단위) | B-T09 | `estimates/server/actions.test.ts` (23505 소속 검사, 보관 CONFLICT) |
| REQ-132 견적 상세 | PM-19, CL-19 | 검증 완료(통합) | B-T09 | E2E·INT-08: `?v=N` 과 파일 일치, 비공개 v2 직접 링크 404 |
| REQ-133 견적 버전 공개 | PM-19 | 검증 완료(단위·DB) | B-T10 | 트리거(최초 공개 시각) + 단위 테스트 |
| REQ-140 B 연동 | (계약) | 검증 완료(통합) | A-T07, A-T08 | 인수 INT-01 (개요·홈·알림), CR-INT-01 이름 규약 |

## 2. 추가·변경한 파일 (내 경로)
- `src/features/files/**`
  - 업로드 의도, finalize(선점·멱등 썸네일·실패 시 정리), 다운로드(uuid 우선, 404+no-store)
  - 컴포넌트: FileDropzone, UploadQueue, FileDownloadLink, UploadField
- `src/features/designs/**`
  - schema·queries·actions·confirm-actions·summary·notification-target
  - `lib/{compare,pdf,query,field-error-text}`
  - 컴포넌트: CompareSlider, ConfirmButton, StateBadges 등
  - kit 은 삭제하고 `@/shared/ui` 사용
- `src/features/materials/**`, `src/features/estimates/**`
  - 견적 보관 `setEstimateArchived` 추가
- 페이지: PM·portal 의 `designs`·`materials`·`estimates`
  - 목록은 `(list)/page.tsx` + `(list)/loading.tsx` (상세 404 가 정상 상태 코드로 나오도록)
  - 상세는 `[id]/page.tsx`, 각 기능에 `error.tsx`
- `messages/{ko,en}/{files,designs,materials,estimates}.json`
- `tests/e2e/b/{b-core.spec.ts,support.ts}`

## 3. STUB 목록
없음. 개발용 STUB(core·로그인·프로젝트 layout)은 병합 때 A 실구현으로 대체됐다.

## 4. CR

| CR | 내용 | 상태 |
|---|---|---|
| (CR-INT-01) | 연동 export 이름(`summaryProvider`·`documentsProvider`·`notificationTarget`), subtitleKey `ns.key`, 고객 viewer 일 때 공개·미보관만 반환 | 통합 잠정 승인, 반영 완료 |
| (CR-INT-03) | 재확정 허용(유효 확정 부분 unique) · 재확인 사유 CHECK 520 | 통합 잠정 승인, 마이그레이션 `20261013000200_b_*` |
| CR-B-01 | 견적+1번 버전 원자 생성 RPC `create_estimate` | 백로그 (23505 소속 검사로 오연결은 차단) |
| CR-B-02 | 거부·고아 Storage 객체 정리 정책 | 백로그 (POL-020 "Storage 도 지우지 않음" 과 정합성 결정 필요) |

## 5. 결정·확인 사항
1. **SKP·DWG 실물 헤더 판정은 미확인.** `rules.ts` 의 SKP 판정(UTF-16LE "SketchUp Model")은 실물 파일로 확인해야 한다(사용자 제공 필요).
2. **subtitleKey 는 `designs.summary.newVersion` 처럼 네임스페이스를 포함한다** (CR-INT-01).
3. **finalize 처리 중 표시**: 다른 호출이 처리 중이면 `FILE_NOT_READY`, 5분이 지나면 다시 가져갈 수 있다. C 업로드는 재시도 버튼으로 처리한다.
4. **확정 배지 톤**: needs_reconfirm = attention (02 문서 7.2).

## 6. 평가 기록

| 검증 ID | 결과 | 근거 |
|---|---|---|
| B-T01 | 통과 | `files/lib/rules.test.ts` 형식·위장·용량 + finalize 서버 테스트(거부 시 status 기록) |
| B-T02 | 통과 | E2E: 미리보기와 무관하게 원본 다운로드 가능 |
| B-T03 | 통과 | E2E: 16:10 영역, 0/50/100% 표시, clip-path 로만 노출 범위 변경 |
| B-T04 | 통과 | E2E: 키보드 1%/10%/Home/End, aria-valuetext / 단위 테스트: 비활성 사유 4종·복구 |
| B-T05 | 통과 | E2E: 같은 이미지 A·B 중복 선택 불가 / 단위 테스트: 고객 접근 불가 이미지는 denied |
| B-T06 | 통과 | E2E TR-02~04 (목록·상세 값 일치, Sheet 수정 후 같은 D4) |
| B-T07 | 통과 | E2E: 확정권 없는 cust2 에게 버튼 없음, cust3 404 / pgTAP: 회수된 계정 거부 |
| B-T08 | 통과 | INT-04 stale_revision·유효 확정 1건, E2E 재확인 → 재확정 |
| B-T09 | 통과 | INT-08·E2E: 선택 버전 = 다운로드 파일, 비공개 직접 링크 404 |
| B-T10 | 통과 | INT-03(공개 해제 후 상세·원본 404, 홈에서 사라짐), 시나리오 |

## 7. 실행 결과 (통합본, 최종 빌드)
- `_integration/90_reports/PART3_REPORT.md` 참조: check·pgTAP·시나리오·인수·E2E·시각 회귀 결과
