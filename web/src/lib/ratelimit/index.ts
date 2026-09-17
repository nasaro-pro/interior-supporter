import { lt, sql } from "drizzle-orm";
import { RateLimitError } from "@/lib/errors";
import { db } from "../db/client";
import { rateLimitCounters } from "@/lib/ratelimit/schema";
import { getPlatformSetting } from "@/modules/company/repo";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

type LimitRule = { window_ms: number; limit: number };
type RateLimitSettings = Record<string, LimitRule>;

export async function consumeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const windowStart = new Date(
    Math.floor(Date.now() / input.windowMs) * input.windowMs,
  );
  const [row] = await db
    .insert(rateLimitCounters)
    .values({ key: input.key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitCounters.key, rateLimitCounters.windowStart],
      set: { count: sql`${rateLimitCounters.count} + 1` },
    })
    .returning();
  const count = row?.count ?? 1;
  return {
    allowed: count <= input.limit,
    remaining: Math.max(0, input.limit - count),
    resetAt: new Date(windowStart.getTime() + input.windowMs),
  };
}

async function readRateLimits(): Promise<RateLimitSettings> {
  const value = await getPlatformSetting("rate_limits");
  if (!value || typeof value !== "object") {
    throw new Error(
      "platform_settings.rate_limits 가 없습니다. pnpm db:seed 를 실행하세요.",
    );
  }
  return value as RateLimitSettings;
}

export async function enforceRateLimit(rule: string, key: string): Promise<void> {
  const limits = await readRateLimits();
  const spec = limits[rule];
  if (!spec) throw new Error(`rate_limits.${rule} 설정이 없습니다.`);
  const result = await consumeRateLimit({
    key: `${rule}:${key}`,
    limit: spec.limit,
    windowMs: spec.window_ms,
  });
  if (!result.allowed) throw new RateLimitError();
}

/**
 * ARCHITECTURE.md 14.3 — 카운터 테이블은 retention 배치가 정리한다.
 * 정리하지 않으면 로그인·파일 중계 카운터가 무한히 쌓여 인증 경로가 느려진다.
 */
export async function purgeExpiredRateLimits(olderThan: Date): Promise<number> {
  const rows = await db
    .delete(rateLimitCounters)
    .where(lt(rateLimitCounters.windowStart, olderThan))
    .returning({ key: rateLimitCounters.key });
  return rows.length;
}
