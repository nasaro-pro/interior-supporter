# AGENTS.md — AI·사람 공통 작업 지침 (인테리어 서포터)

> 상태: 확정 · 버전: 2.0 · 최종 수정: 2026-10-07 · 관리: 통합 책임자 소용우 · 적용: 사람·AI 모두
> 이 파일은 요약이다. **모든 규칙의 원문은 `docs/00_헌법_공통규칙.md`** 이며 충돌 시 헌법이 이긴다.

## 0. 가장 먼저 확인할 것 — 나는 누구인가

| 담당 | 이름 | 범위 | 내 경로 (원본 `ownership.json`) |
|---|---|---|---|
| **A** | 박예원 | 인증·접근 검사·셸·프로젝트·고객·변경이력·알림·설정·화면 레지스트리 | `src/features/core/**`, `src/app/(auth)/**`·`(public)/**`, 영역·프로젝트 layout, A 화면, `messages/*/{common,auth,errors,projects,clients,history,notifications,settings}.json`, `progress/A.md` |
| **B** | 류영걸 | 도안·자재·견적·확정·**공통 파일 어댑터** | `src/features/{files,designs,materials,estimates}/**`, `src/app/api/files/**`, B 화면, `messages/*/{files,designs,materials,estimates}.json`, `progress/B.md` |
| **C** | 이재서 | 요청·사진·일정·전체 캘린더·시공팀 화면 | `src/features/{requests,photos,schedule}/**`, C 화면, `/field/photos/**`, `messages/*/{requests,photos,schedule}.json`, `progress/C.md` |

- 작업 방식: **각자 로컬 폴더**에서 개발(GitHub·원격 저장소 없음) → `npm run submit` 제출본 ZIP → 통합 책임자가 병합.
- 내 경로 밖 파일은 만들거나 고치지 않는다. 남의 기능은 STUB(헌법 5.7), 공통 파일·패키지·계약·DB 변경은 CR(헌법 5.9).
- 스타터 고정 파일(`package.json`·설정·`docs/`·`ai/`·`scripts/`·계약·`src/shared/lib/`·베이스라인 마이그레이션 등)은 **누구도** 수정하지 않는다.
- 남과의 연결(누가 무엇을 주고받는지): 헌법 4장, 04 문서 각 장의 "다른 두 명이 하는 일과 연결".

## 1. 문서

| 문서 | 내용 |
|---|---|
| `docs/00_헌법_공통규칙.md` | **최상위 규칙**: 원칙·역할·소유권·연결 지도·작업 방식·기술·코드·DB·보안·화면·테스트·제출·병합·평가 |
| `docs/01_제품정의_요구사항.md` | 제품·용어·정책(POL)·권한표·요구사항(REQ)·NFR·결정 대장 |
| `docs/02_화면구조_뎁스_디자인.md` | 뎁스·IA·화면 레지스트리·전환·화면 공통 규칙·디자인 시스템·문구 |
| `docs/03_아키텍처_데이터_보안.md` | ADR·흐름·테이블·RPC·계약·상태·알림·보안·배포·기준서 대응표 |
| `docs/04_담당별_작업지시서.md` | A·B·C 의 TASK·검증표·상호 연결 |
| `ai/AI_작업문서_<담당>_<이름>.md` | AI 에 통째로 넣는 내 전용 묶음(헌법 전문 포함, 생성물) |

## 2. 반드시 (요약 — 헌법 7·8·9·10장)

1. 데이터 접근은 서버에서만 `createServerSupabase()`. 브라우저 Supabase 는 `uploadToSignedUrl` 전용. `createAdminSupabase()` 는 허용 파일만(eslint 가 막음).
2. 모든 page·action 첫 줄 접근 검사(`requireProjectAccess` 등) + RLS 이중 검증.
3. 입력은 서버 zod 검증, 반환은 `ActionResult<T>`, DB 오류는 `mapDbError()`.
4. 수정은 `version` 낙관적 잠금, 생성은 클라이언트 UUID(POL-038), DELETE 없음(보관).
5. URL 은 `routes.ts`, 문구는 메시지 키(ko·en 동시), 날짜·금액은 `dates.ts`·`money.ts`, 색은 토큰.
6. 화면 최상위 `<main data-screen-id>`, 상태 6종, 360/768/1280px, 키보드.
7. 새 동작마다 정상·예외·권한 거부 테스트. 실행해 보지 않았으면 '구현 완료(미검증)'.

## 3. 금지

비밀값을 코드·문서·로그·AI 대화·제출본에 쓰기 · RLS 끄기·`using (true)` · 인증·검증·보안 헤더 우회 · `eval`·사용자 입력 `dangerouslySetInnerHTML`·SQL 조립 · 테스트를 고쳐서 통과 · 새 패키지 설치 · `npx shadcn init` · 제외 범위 기능 · 테이블·컬럼·RPC 를 새로 지어내기 · 남의 경로·고정 파일 수정.

## 4. 판단

문서에 답이 없으면 추측하지 않고 '결정 필요'로 진행 기록 5번에 해석 2가지와 영향을 적는다. 문서와 코드가 다르면 고치지 말고 `충돌: <ID> / 문서 … / 코드 … / 제안 …` 로 보고한다.

## 5. 명령

```
npm run dev | npm run check | npm run format | npm run test | npm run test:e2e
npm run db:push | npm run db:test | npm run db:types | npm run env:init
npm run check:ownership -- --owner <A|B|C>
npm run submit -- --owner <A|B|C>
```

## 6. 작업 종료 확인

- [ ] `npm run check` 통과 (실제 실행), DB 를 바꿨다면 `npm run db:test`
- [ ] `npm run check:ownership -- --owner <나>` 위반 0
- [ ] `progress/<나>.md` 갱신 — 구현 완료/검증 완료 구분, 검증 못 한 것, STUB, CR
- [ ] 보고: 바꾼 파일 경로, 실행한 검증과 결과, 결정 필요 사항
