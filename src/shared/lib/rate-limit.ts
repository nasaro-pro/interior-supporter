// src/shared/lib/rate-limit.ts (A · TASK-001) — 메모리 기반 요청 제한 (SEC-017, TC-911)
// Render 무료 단일 인스턴스 전제(01 문서 1.5). 재시작하면 초기화된다 — Supabase Auth 자체 제한이 2차 방어선.
import 'server-only';
import { headers } from 'next/headers';

type Bucket = { hits: number[]; limit: number; windowMs: number };

const store = new Map<string, Bucket>();
export const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  /** 다시 시도할 수 있을 때까지 남은 초 (ok=false 일 때) */
  retryAfterSec: number;
}

/**
 * 고정 창(sliding log) 방식. key 별로 windowMs 동안 limit 회까지 허용한다.
 * now 는 테스트용 주입값.
 */
export function hitRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const since = now - windowMs;
  const bucket = store.get(key) ?? { hits: [], limit, windowMs };
  bucket.limit = limit;
  bucket.windowMs = windowMs;
  bucket.hits = bucket.hits.filter((t) => t > since);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    store.set(key, bucket);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  bucket.hits.push(now);
  if (!store.has(key) && store.size >= MAX_KEYS && !evictOne(now)) {
    return { ok: true, retryAfterSec: 0 }; // 자리가 없으면 기록하지 않는다 (차단 버킷 보호 우선)
  }
  store.set(key, bucket);
  return { ok: true, retryAfterSec: 0 };
}

/**
 * A-02: 키가 MAX_KEYS 에 이르면 하나를 내보낸다. 지금 차단 중인 버킷(hits >= limit, 창 안)은 내보내지 않는다
 * — 내보내면 무작위 키를 대량으로 만들어 차단을 풀 수 있다. 차단되지 않은 버킷은 삽입 순(FIFO)으로 내보낸다.
 * 모든 버킷이 차단 중이면 새 키를 저장하지 않는다(새 키는 이번 요청만 허용되고 다음 요청에서 다시 센다).
 */
function evictOne(now: number): boolean {
  for (const [k, b] of store) {
    if (!isBlocked(b, now)) {
      store.delete(k);
      return true;
    }
  }
  return false;
}

function isBlocked(b: Bucket, now: number): boolean {
  const live = b.hits.filter((t) => t > now - b.windowMs).length;
  return live >= b.limit;
}

/** 테스트 전용 초기화 */
export function resetRateLimits() {
  store.clear();
}

/** 테스트 전용 — 저장된 키 수 */
export function rateLimitKeyCount() {
  return store.size;
}

/**
 * 신뢰하는 프록시 단계 수 (X-Forwarded-For 오른쪽에서 몇 번째가 클라이언트인가).
 * 기본 1 = 맨 오른쪽 값(플랫폼 프록시가 직접 본 주소). 왼쪽 값은 클라이언트가 마음대로 넣을 수 있다.
 */
export function trustedProxyHops(raw: string | undefined = process.env.TRUSTED_PROXY_HOPS): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1;
}

/** XFF 값에서 클라이언트 IP 고르기 (순수 함수 — 테스트 대상) */
export function pickForwardedIp(forwarded: string | null | undefined, hops: number): string | null {
  if (!forwarded) return null;
  const parts = forwarded
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  // 항목이 hops 보다 적으면 가장 왼쪽(프록시를 덜 거친 요청) — 위조 여지가 있지만 다른 값이 없다
  return parts[Math.max(0, parts.length - hops)] ?? null;
}

/** 요청 IP (X-Forwarded-For 오른쪽 기준, TRUSTED_PROXY_HOPS). 로그에 쓰지 않는다 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const picked = pickForwardedIp(h.get('x-forwarded-for'), trustedProxyHops());
  return picked || h.get('x-real-ip') || 'unknown';
}
