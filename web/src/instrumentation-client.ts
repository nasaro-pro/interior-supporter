import * as Sentry from "@sentry/nextjs";

// 클라이언트에서는 NEXT_PUBLIC_ 접두 변수만 읽을 수 있다 (부록 A).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  });
}
