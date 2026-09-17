# 인테리어 서포터

## 볼 문서

| 문서 | 내용 |
| --- | --- |
| [SITE_STRUCTURE.md](SITE_STRUCTURE.md) | 지금 구현된 사이트·화면·기능·코드 지도 |
| [SITE_DESIGN.md](SITE_DESIGN.md) | 화면·권한·용어 |

기술·스키마는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). 앱은 `web/`.

## 로컬 실행

1. `web/.env.local` 에 `docs/ARCHITECTURE.md` 부록 A 변수를 채운다.
2. Postgres(로컬 또는 Neon 개발)와 스토리지(로컬 엔드포인트 또는 R2 개발 버킷)를 준비한다.
3. `cd web && pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev`

`NODE_ENV` 가 production 이 아닌데 `DATABASE_URL` 이 운영 호스트면 부팅이 거부된다.

## 마이그레이션

빌드 중 자동 실행하지 않는다.

```bash
cd web
pnpm db:generate
pnpm db:migrate
```

생성 마이그레이션 다음 `drizzle/manual/*.sql` 순서.

## 검증

```bash
cd web
pnpm typecheck
pnpm selfcheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
```

## 배포

`docs/DEPLOY_CHECKLIST.md` 와 `docs/ARCHITECTURE.md` 18장을 따른다.
개인정보 조회·파기는 `docs/RUNBOOK_PRIVACY.md`.
