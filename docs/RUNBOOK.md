---
title: "운영 런북"
source: "docs/ARCHITECTURE.md 17.4 · 18.2"
---

# 운영 런북

## 증상별 첫 조치

| 증상 | 첫 확인 | 조치 |
| --- | --- | --- |
| 로그인 불가 | Resend(또는 `NOTIFY_EMAIL_PROVIDER=console`), `rate_limits` 카운터, 이메일 인증 여부 | 공급자 장애면 공지. 한도는 `platform_settings.rate_limits`에서 임시 완화 후 seed와 섞지 말 것 |
| 사진만 안 보임 | `/api/files` 4xx/5xx, R2(또는 로컬 스토리지) 상태, 콘텐츠 `visibility_status` | 고객은 `published`만 본다. 권한·중계 캐시(`Cache-Control`) 확인 |
| 특정 업체만 오류 | 해당 `companyId` 로그, `companies.status` | `suspended`면 스태프 `/app` 차단이 정상. 데이터 이상이면 롤백 판단 |
| 마이그레이션 실패 | 배포 로그 | 빌드 중 마이그레이션을 돌리지 않는다(18.2). 코드는 Vercel 이전 배포, DB는 PITR |
| 플랫폼 콘솔 진입 불가 | `/platform/mfa`, `platform_settings.mfa_ttl_hours` | 파일럿 전 MFA 필수. seed 누락이면 `pnpm db:seed` |
| 예약 공개가 안 됨 | `/api/cron/publish-scheduled` 최근 실행, `CRON_SECRET` | Vercel Cron `web/vercel.json`. 로컬은 헤더로 수동 호출 |
| 알림이 안 감 | `notifications.status`, 이메일 provider | `notification-retry` 크론. 알림톡은 슬롯만(실발송 없음) |

## 배포

1. CI 통과 후 병합
2. `pnpm db:migrate`를 **별도** 실행 (생성 SQL → `drizzle/manual/*.sql`)
3. `/api/health`와 로그인·고객 홈 스모크

## 크론 (KST)

| 경로 | 주기 |
| --- | --- |
| `/api/cron/publish-scheduled` | 1분 |
| `/api/cron/notification-retry` | 5분 |
| `/api/cron/retention` | 매일 03:00 |
| `/api/cron/storage-recalc` | 매일 04:00 |

호출은 `cron-secret` 헤더 또는 `Authorization: Bearer $CRON_SECRET`.
