import { headers } from "next/headers";

/**
 * ARCHITECTURE.md 17.2 — 구조화 로깅.
 * stdout 에 JSON 한 줄을 쓴다. Vercel 이 이를 구조화 로그로 수집한다.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<
  string,
  string | number | boolean | null | undefined
>;

/** 개인정보·토큰·비밀은 키 이름으로 걸러 낸다 (17.2) */
const DENY_KEY = /password|token|secret|code|email|phone|address|body|hash/i;

function sanitize(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (DENY_KEY.test(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function emit(level: LogLevel, event: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    ...sanitize(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};

/** proxy.ts 가 심은 요청 식별자. 에러 화면·로그 상관관계에 쓴다 (17.2) */
export async function currentRequestId(): Promise<string | undefined> {
  try {
    return (await headers()).get("x-request-id") ?? undefined;
  } catch {
    // 요청 스코프 밖(배치·모듈 초기화)에서는 없다.
    return undefined;
  }
}
