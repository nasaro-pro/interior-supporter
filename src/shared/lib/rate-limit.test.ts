// TC-911 로그인·가입 요청 제한 (SEC-017) · A-02 XFF 오른쪽 기준·차단 버킷 축출 보호
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_KEYS,
  hitRateLimit,
  pickForwardedIp,
  rateLimitKeyCount,
  resetRateLimits,
  trustedProxyHops,
} from './rate-limit';

describe('TC-911 hitRateLimit', () => {
  beforeEach(() => resetRateLimits());

  it('TC-911 한도 안에서는 허용한다', () => {
    for (let i = 0; i < 5; i++)
      expect(hitRateLimit('signup:1.1.1.1', 5, 60_000, 1000 + i).ok).toBe(true);
  });

  it('TC-911 한도를 넘으면 거절하고 다시 시도할 시간을 알려 준다', () => {
    for (let i = 0; i < 5; i++) hitRateLimit('signup:1.1.1.1', 5, 60_000, 1000);
    const r = hitRateLimit('signup:1.1.1.1', 5, 60_000, 2000);
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it('TC-911 창이 지나면 다시 허용한다', () => {
    for (let i = 0; i < 5; i++) hitRateLimit('k', 5, 60_000, 0);
    expect(hitRateLimit('k', 5, 60_000, 60_001).ok).toBe(true);
  });

  it('TC-911 키(IP·이메일)가 다르면 서로 영향이 없다', () => {
    for (let i = 0; i < 5; i++) hitRateLimit('a', 5, 60_000, 0);
    expect(hitRateLimit('b', 5, 60_000, 0).ok).toBe(true);
  });
});

describe('A-02 차단 버킷 축출 보호', () => {
  beforeEach(() => resetRateLimits());

  it('A-02 키가 가득 차도 차단 중인 버킷은 남고, 차단되지 않은 가장 오래된 버킷이 나간다', () => {
    for (let i = 0; i < 5; i++) hitRateLimit('login:email:victim', 5, 60_000, 0);
    expect(hitRateLimit('login:email:victim', 5, 60_000, 1).ok).toBe(false);
    for (let i = 1; i < MAX_KEYS + 1; i++) hitRateLimit(`junk:${i}`, 5, 60_000, 2);
    expect(rateLimitKeyCount()).toBeLessThanOrEqual(MAX_KEYS);
    // 차단 유지
    expect(hitRateLimit('login:email:victim', 5, 60_000, 3).ok).toBe(false);
  });

  it('A-02 모든 버킷이 차단 중이면 새 키를 저장하지 않는다(키 수 상한 유지)', () => {
    for (let i = 0; i < MAX_KEYS; i++) hitRateLimit(`b:${i}`, 1, 60_000, 0);
    expect(rateLimitKeyCount()).toBe(MAX_KEYS);
    expect(hitRateLimit('new', 1, 60_000, 1).ok).toBe(true);
    expect(rateLimitKeyCount()).toBe(MAX_KEYS);
    expect(hitRateLimit('b:0', 1, 60_000, 2).ok).toBe(false);
  });

  it('A-02 창이 지난 버킷은 차단이 아니므로 축출 대상이다', () => {
    for (let i = 0; i < MAX_KEYS; i++) hitRateLimit(`b:${i}`, 1, 1_000, 0);
    hitRateLimit('new', 1, 1_000, 5_000);
    expect(rateLimitKeyCount()).toBe(MAX_KEYS);
    expect(hitRateLimit('b:0', 1, 1_000, 5_001).ok).toBe(true);
  });
});

describe('A-02 X-Forwarded-For 클라이언트 IP', () => {
  it('A-02 기본(hops=1)은 맨 오른쪽 값 — 클라이언트가 넣은 왼쪽 값은 무시', () => {
    expect(pickForwardedIp('1.1.1.1, 9.9.9.9', trustedProxyHops(undefined))).toBe('9.9.9.9');
    expect(pickForwardedIp('9.9.9.9', 1)).toBe('9.9.9.9');
  });

  it('A-02 TRUSTED_PROXY_HOPS=2 이면 오른쪽에서 두 번째', () => {
    expect(pickForwardedIp('6.6.6.6, 1.1.1.1, 10.0.0.1', trustedProxyHops('2'))).toBe('1.1.1.1');
  });

  it('A-02 항목이 hops 보다 적으면 맨 왼쪽, 비었으면 null', () => {
    expect(pickForwardedIp('1.1.1.1', 3)).toBe('1.1.1.1');
    expect(pickForwardedIp(' , ', 1)).toBeNull();
    expect(pickForwardedIp(null, 1)).toBeNull();
  });

  it('A-02 잘못된 TRUSTED_PROXY_HOPS 는 기본 1', () => {
    expect(trustedProxyHops('abc')).toBe(1);
    expect(trustedProxyHops('0')).toBe(1);
    expect(trustedProxyHops('-2')).toBe(1);
  });
});
