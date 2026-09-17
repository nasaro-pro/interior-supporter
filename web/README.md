# 인테리어 서포터 (웹)

Next.js 16 앱. 저장소 루트 `README.md` 와 `docs/` 를 함께 본다.

## 스크립트

| 명령 | 내용 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 프로덕션 빌드 (마이그레이션 없음) |
| `pnpm db:migrate` | 스키마 마이그레이션 |
| `pnpm db:seed` | `platform_settings` 기본값 |
| `pnpm typecheck` / `pnpm selfcheck` | 타입·헌법 검사 |
| `pnpm test:unit` / `test:integration` / `test:e2e` | 테스트 |

환경변수는 `src/lib/config/env.ts` 가 부팅 시 검증한다.
