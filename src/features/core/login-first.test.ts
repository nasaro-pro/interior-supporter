// D-15·D-16 로그인 직후 첫 로그인 상태 판정 — 임시 비밀번호면 비밀번호 변경 화면, 만료면 로그인 거절
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/shared/lib/rate-limit';
import { createFakeSupabase } from './testing/fake-supabase';

const h = vi.hoisted(() => ({ server: null as unknown }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: async () => h.server }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
  cookies: async () => ({ set: vi.fn(), get: vi.fn() }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import { login } from './server/session-actions';

function setup(profile: Record<string, unknown> | null) {
  const signOut = vi.fn(async () => ({ error: null }));
  const fake = createFakeSupabase((q) => (q.table === 'profiles' ? { data: profile } : undefined), {
    signInWithPassword: vi.fn(async () => ({ data: { user: { id: 'u1' } }, error: null })),
    signOut,
  });
  h.server = fake.client;
  return { signOut };
}

const form = () => {
  const f = new FormData();
  f.set('email', 'cust@test.local');
  f.set('password', 'TempPass2345');
  return f;
};

async function run<T>(p: Promise<T>) {
  try {
    return await p;
  } catch (e) {
    return { redirect: (e as Error).message };
  }
}

beforeEach(() => {
  resetRateLimits();
  vi.clearAllMocks();
});

describe('로그인 후 첫 로그인 상태', () => {
  it('D-15 임시 비밀번호 계정 → 비밀번호 변경 화면', async () => {
    setup({
      locale: 'ko',
      must_change_password: true,
      temp_password_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(await run(login(null, form()))).toEqual({ redirect: 'REDIRECT:/change-password' });
  });

  it('D-16 임시 비밀번호 만료 → 로그아웃시키고 비밀번호 칸에 만료 안내', async () => {
    const { signOut } = setup({
      locale: 'ko',
      must_change_password: true,
      temp_password_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await run(login(null, form()))).toMatchObject({
      ok: false,
      error: { fieldErrors: { password: ['field.tempPasswordExpired'] } },
    });
    expect(signOut).toHaveBeenCalled();
  });

  it('일반 계정은 기존대로 영역 선택', async () => {
    setup({ locale: 'ko', must_change_password: false, temp_password_expires_at: null });
    expect(await run(login(null, form()))).toEqual({ redirect: 'REDIRECT:/select-area' });
  });
});
