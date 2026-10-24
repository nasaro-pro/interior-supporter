// SEC-02: 재설정 링크(/auth/confirm) 세션만 새 비밀번호를 정할 수 있다 — 일반 로그인 세션은 FORBIDDEN, 1회 성공 후 재사용 불가
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/shared/lib/rate-limit';

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: async () => h.client }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: vi.fn(), get: vi.fn() }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import { hasRecoveryAmr, RECOVERY_PROOF_WINDOW_SEC } from './server/recovery-proof';
import { resetPassword } from './server/session-actions';

const NOW = 1_791_851_394;
const USER = '00000000-0000-4000-8000-0000000000a1';

/** 상태를 가진 auth 대역: signInWithPassword 가 성공하면 세션 amr 이 password 로 바뀐다 */
function authStub(
  initialAmr: unknown,
  opts: { updateError?: boolean; reloginError?: boolean } = {},
) {
  let amr = initialAmr;
  const auth = {
    getClaims: vi.fn(async () =>
      amr === null
        ? { data: null, error: { name: 'AuthSessionMissingError' } }
        : { data: { claims: { sub: USER, email: 'pm1@test.local', amr } }, error: null },
    ),
    updateUser: vi.fn(async () => ({
      data: {},
      error: opts.updateError ? { code: 'weak_password' } : null,
    })),
    signInWithPassword: vi.fn(async () => {
      if (opts.reloginError) return { data: {}, error: { code: 'invalid_credentials' } };
      amr = [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }];
      return { data: {}, error: null };
    }),
    signOut: vi.fn(async () => ({ error: null })),
  };
  h.client = { auth };
  return auth;
}

const form = (password = 'N3w-passw0rd!x') => {
  const f = new FormData();
  f.set('password', password);
  f.set('passwordConfirm', password);
  return f;
};

async function run(f = form()) {
  try {
    return await resetPassword(null, f);
  } catch (e) {
    return { redirect: (e as Error).message };
  }
}

const nowSec = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  resetRateLimits();
  vi.clearAllMocks();
});

describe('SEC-02 hasRecoveryAmr (순수 판정)', () => {
  it('정상: 10분 안의 otp/recovery 인증이면 true', () => {
    expect(hasRecoveryAmr({ amr: [{ method: 'otp', timestamp: NOW - 30 }] }, NOW)).toBe(true);
    expect(hasRecoveryAmr({ amr: [{ method: 'recovery', timestamp: NOW }] }, NOW)).toBe(true);
  });

  it('거부: 비밀번호 로그인·창 밖·형식 오류는 false', () => {
    expect(hasRecoveryAmr({ amr: [{ method: 'password', timestamp: NOW }] }, NOW)).toBe(false);
    expect(
      hasRecoveryAmr(
        { amr: [{ method: 'otp', timestamp: NOW - RECOVERY_PROOF_WINDOW_SEC - 1 }] },
        NOW,
      ),
    ).toBe(false);
    expect(hasRecoveryAmr({ amr: ['otp'] }, NOW)).toBe(false); // 시각 없는 RFC 8176 형식
    expect(hasRecoveryAmr({ amr: [{ method: 'otp', timestamp: NOW + 3600 }] }, NOW)).toBe(false);
    expect(hasRecoveryAmr({}, NOW)).toBe(false);
    expect(hasRecoveryAmr(null, NOW)).toBe(false);
  });
});

describe('SEC-02 resetPassword', () => {
  it('권한 거부: 일반 로그인 세션(amr=password)은 FORBIDDEN, 비밀번호를 바꾸지 않는다', async () => {
    const auth = authStub([{ method: 'password', timestamp: nowSec() - 5 }]);
    const res = await run();
    expect(res).toEqual({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(auth.updateUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('권한 거부: 10분이 지난 재설정 세션도 FORBIDDEN', async () => {
    const auth = authStub([{ method: 'otp', timestamp: nowSec() - RECOVERY_PROOF_WINDOW_SEC - 5 }]);
    expect(await run()).toEqual({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('예외: 세션이 없으면 UNAUTHENTICATED', async () => {
    authStub(null);
    expect(await run()).toEqual({ ok: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('정상: 재설정 세션은 1회 성공 — 새 비밀번호로 재로그인 후 다른 세션 종료, 두 번째는 FORBIDDEN', async () => {
    const auth = authStub([{ method: 'otp', timestamp: nowSec() - 10 }]);
    expect(await run()).toEqual({ redirect: 'REDIRECT:/select-area?reset=1' });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'N3w-passw0rd!x' });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'pm1@test.local',
      password: 'N3w-passw0rd!x',
    });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    // 같은 브라우저에서 다시 시도 → 세션이 password 로 바뀌어 증명이 소모됨
    expect(await run(form('An0ther-passw0rd!'))).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
  });

  it('예외: 재로그인이 실패하면 모든 세션을 끝내고 로그인 화면으로', async () => {
    const auth = authStub([{ method: 'otp', timestamp: nowSec() }], { reloginError: true });
    expect(await run()).toEqual({ redirect: 'REDIRECT:/login?reset=1' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('요청 제한: 같은 사용자 pwreset 5회 초과 시 RATE_LIMITED', async () => {
    authStub([{ method: 'otp', timestamp: nowSec() }], { updateError: true });
    for (let i = 0; i < 5; i++)
      expect(await run()).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    expect(await run()).toEqual({ ok: false, error: { code: 'RATE_LIMITED' } });
  });

  it('검증: 비밀번호 불일치는 세션 확인 전에 VALIDATION_FAILED', async () => {
    const auth = authStub([{ method: 'otp', timestamp: nowSec() }]);
    const f = form();
    f.set('passwordConfirm', 'different-passw0rd');
    expect(await run(f)).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    expect(auth.getClaims).not.toHaveBeenCalled();
  });
});
