# 인테리어 서포터 — 스타터

인테리어 업체가 프로젝트별 도안·자재·요청·현장 사진·일정·견적을 한곳에서 관리하고, 고객과 시공팀이 같은 데이터를 허용된 범위에서 보는 웹 서비스.
Next.js 16 + Supabase(Seoul) + Render. 3인(A 박예원 · B 류영걸 · C 이재서)이 **각자 로컬에서** 만들고 통합 책임자(소용우)가 합친다. GitHub 은 쓰지 않는다.

## 처음 읽을 것

1. [`docs/00_헌법_공통규칙.md`](docs/00_헌법_공통규칙.md) — **모두가 지킬 규칙 전부** (시작 방법 5.3, 제출 12장)
2. [`docs/04_담당별_작업지시서.md`](docs/04_담당별_작업지시서.md) — 내 할 일 + 남과의 연결
3. AI 를 쓰면 내 파일 하나를 통째로 넣는다:

| 담당 | 파일 |
|---|---|
| A 박예원 | [`ai/AI_작업문서_A_박예원.md`](ai/AI_작업문서_A_박예원.md) |
| B 류영걸 | [`ai/AI_작업문서_B_류영걸.md`](ai/AI_작업문서_B_류영걸.md) |
| C 이재서 | [`ai/AI_작업문서_C_이재서.md`](ai/AI_작업문서_C_이재서.md) |

## 문서

| 문서 | 내용 |
|---|---|
| [00 헌법·공통 규칙](docs/00_헌법_공통규칙.md) | 원칙·역할·소유권·연결 지도·작업 방식·기술·코드·DB·보안·화면·테스트·제출·병합·평가·배포 |
| [01 제품 정의·요구사항](docs/01_제품정의_요구사항.md) | 제품·용어·정책·권한표·REQ·NFR·결정 대장 |
| [02 화면 구조·뎁스·디자인](docs/02_화면구조_뎁스_디자인.md) | IA·화면 레지스트리·전환·공통 규칙·디자인 시스템 |
| [03 아키텍처·데이터·보안](docs/03_아키텍처_데이터_보안.md) | ADR·흐름·DB·RPC·계약·보안·배포·기준서 대응 |
| [04 담당별 작업 지시서](docs/04_담당별_작업지시서.md) | A·B·C TASK·검증표·상호 연결 |

## 폴더

| 경로 | 내용 |
|---|---|
| `src/shared/contracts/` | 계약(화면·경로·오류·도메인·담당 간 연결) — 고정 |
| `src/shared/lib/` | Supabase 클라이언트 3종·logger·dates·money·utils — 고정 |
| `supabase/migrations/`, `supabase/tests/` | 전체 DB(베이스라인 4개)·pgTAP 110개 — 고정 |
| `messages/{ko,en}/` | 문구 15개 네임스페이스 |
| `scripts/` | 소유권 검사·제출본·병합·스타터 기준·AI 문서 생성·타입 생성 |
| `ownership.json`, `starter-manifest.json` | 소유 경로·고정 파일 / 스타터 기준 해시 |
| `render.yaml`, `.env.example` | 배포·환경변수 |

## 빠른 시작 (상세: 헌법 5.3)

```powershell
npm install
npm run env:init            # .env.local 값 채우기
npx supabase login
npx supabase link --project-ref <내 ref>
npm run db:push; npm run db:test; npm run db:types
npm run check:ownership -- --owner <A|B|C>
npm run dev
```

AI 문서는 직접 고치지 않는다. 원본 문서를 고친 뒤 통합 책임자가 `python scripts/build-ai-docs.py` 로 다시 만든다.
