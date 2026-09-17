import type { Instrumentation } from "next";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT,
  });
}

/**
 * ARCHITECTURE.md 17.2 — 서버에서 처리하지 못한 예외를 관측 도구로 올린다.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "request.error",
      ts: new Date().toISOString(),
      path: request.path,
      routeType: context.routeType,
      name: error instanceof Error ? error.name : "unknown",
    }),
  );
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context);
};
