import * as Sentry from "@sentry/nextjs";
import { logger } from "@/lib/logger";

/**
 * ARCHITECTURE.md 17.3 — 즉시 알람이 필요한 사건.
 * Sentry 의존은 이 파일 안에만 둔다(벤더 격리, AGENTS.md 5 정신).
 */
export function reportCritical(
  error: unknown,
  tags: Record<string, string> = {},
): void {
  logger.error("critical", { name: tags.kind ?? "unknown" });
  try {
    Sentry.captureException(error, { level: "fatal", tags });
  } catch {
    // 관측 실패가 본 작업을 막지 않는다.
  }
}

export function reportError(
  error: unknown,
  tags: Record<string, string> = {},
): void {
  try {
    Sentry.captureException(error, { tags });
  } catch {
    // noop
  }
}
