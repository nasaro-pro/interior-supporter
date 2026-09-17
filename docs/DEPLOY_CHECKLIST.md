# 배포 체크리스트

ARCHITECTURE.md 18장 기준.

## 환경

- [ ] `NODE_ENV=production` 운영에서만 운영 `DATABASE_URL` 사용
- [ ] `PRODUCTION_DB_HOST` 설정 — 비운영 환경이 운영 DB 를 가리키면 부팅이 거부된다 (18.1)
- [ ] Vercel / Neon / R2 / Resend 키가 환경별로 분리됨
- [ ] `BETTER_AUTH_SECRET` 을 운영용으로 새로 생성함
- [ ] `CRON_SECRET` 설정, Vercel Cron 경로와 `vercel.json` 일치
- [ ] `NOTIFY_EMAIL_PROVIDER=resend` + `RESEND_API_KEY` (로컬·CI 는 `console`)
- [ ] **R2 버킷 CORS** 에 운영 도메인의 `PUT` 허용 (`content-type`, `content-length` 헤더) — 없으면 업로드가 브라우저에서 차단된다 (10.1)
- [ ] `SENTRY_DSN` 과 `NEXT_PUBLIC_SENTRY_DSN` 을 각각 설정 (서버 DSN 은 브라우저에서 읽히지 않는다)

## 배포 순서

1. CI 통과 (`typecheck`, `lint`, `selfcheck`, `db:migrate`, `db:seed`, unit, integration, `db:check`, e2e `@critical`, `build`)
2. 마이그레이션은 빌드와 분리: `pnpm db:migrate` (생성 마이그레이션 → `drizzle/manual/*.sql`)
3. Vercel 배포
4. `/api/health` 확인 (DB·스토리지)
5. 스모크: 로그인 → `/app/{slug}` 진입 → 고객 초대 → 공개 전환 → 홈 편집기 저장 → 파일 업로드

## 보안 헤더 확인 (14.2)

```bash
curl -I https://<운영도메인>/ | grep -iE "content-security-policy|x-content-type-options|referrer-policy|strict-transport-security|x-frame-options"
```

- [ ] 위 5종이 모두 응답에 있다
- [ ] 포털·편집기·업로드 경로에서 CSP 위반 콘솔 로그가 0건

## 알람 (17.3)

- [ ] `tenant_violation` 태그 → 즉시 통지 규칙 등록
- [ ] 5분간 5xx 2% 초과 알람
- [ ] 확정 코드 검증 실패 급증 알람
- [ ] 예약 공개 배치 1시간 미실행 알람

## 롤백

- 코드: Vercel 이전 배포로 전환
- DB: 파괴적 마이그레이션을 하지 않는 것이 1차. 사고 시 Neon PITR

## 정기 작업

| 작업 | 주기 | 경로 |
|---|---|---|
| 예약 공개 | 1분 | `/api/cron/publish-scheduled` |
| 알림 재시도 | 5분 | `/api/cron/notification-retry` |
| 보관 정리 (감사·세션·토큰·초대·레이트리밋 카운터) | 매일 03:00 KST | `/api/cron/retention` |
| 용량 재계산 | 매일 04:00 KST | `/api/cron/storage-recalc` |

모든 크론은 `CRON_SECRET` 헤더 또는 `Authorization: Bearer` 를 상수 시간 비교로 검증.

## 출시 전 확인 — 법무 (15장)

- [ ] `/privacy` 국외 이전 표 (이전받는 자·국가·일시/방법·항목·목적·보유기간)
- [ ] `/privacy` 수집 항목과 목적별 보유 기간
- [ ] `/privacy` 제3자 제공 여부
- [ ] `/privacy` 처리 위탁 현황 (수탁자·업무 내용)
- [ ] `/privacy` 정보주체 권리·행사 방법 (`RUNBOOK_PRIVACY.md` 와 연결)
- [ ] `/privacy` 파기 절차·방법
- [ ] `/privacy` 개인정보 보호책임자 성명·연락처
- [ ] `/privacy` 쿠키 등 자동 수집 장치 운영
- [ ] `/privacy` 방침 변경 이력·시행일
- [ ] `/terms` 처리 위탁 문구
- [ ] 가입 시 국외 이전 별도 체크박스
- [ ] **법률 검토 완료** (현재 두 문서 상단에 초안 배너가 붙어 있다)
- [ ] DB 백업(스냅샷 + PITR) 활성화

## 의도적으로 없는 것

결제 연동, 요금제 제한 집행(`plan_enforcement_enabled=false`), 저장공간 차단·경고 메일,
알림톡/SMS 실발송, 소셜 로그인, 화이트라벨 커스텀 도메인(7.7).
