import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/config/env";
import { logger } from "@/lib/logger";

/** 길이가 다르면 비교 자체가 불가능하므로 먼저 거른다. */
function safeEquals(a: string | null, b: string): boolean {
  if (!a) return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function cronAuthorized(request: Request) {
  const header = request.headers.get("cron-secret");
  const auth = request.headers.get("authorization");
  return (
    safeEquals(header, env.CRON_SECRET) ||
    safeEquals(auth, `Bearer ${env.CRON_SECRET}`)
  );
}

/** ARCHITECTURE.md 14.4 — 모든 /api/cron/* 은 예외 없이 이 래퍼를 통과한다. */
export function withCronAuth(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (!cronAuthorized(request)) {
      logger.warn("cron.unauthorized", { path: new URL(request.url).pathname });
      return Response.json({ message: "unauthorized" }, { status: 401 });
    }
    return handler(request);
  };
}
