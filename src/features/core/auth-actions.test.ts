// A-03: 가입·초대 신규 계정 실패는 이메일 존재 여부와 관계없이 같은 중립 응답 (CONFLICT + ref)
//       + 실패 응답 시간 평준화(levelFailureTiming) 호출 — 대기 자체는 timing.test.ts 에서 검사
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/shared/lib/rate-limit';
import { createFakeSupabase, type Responder } from './testing/fake-supabase';

const h = vi.hoisted(() => ({
  admin: null as unknown,
  server: null as unknown,
  level: vi.fn<(startedAt: number) => Promise<void>>(async () => undefined),
}));
vi.mock('./server/timing', () => ({ levelFailureTiming: (t: number) => h.level(t) }));
vi.mock('@/shared/lib/supabase/admin', () => ({ createAdminSupabase: () => h.admin }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: async () => h.server }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
}));
vi.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import { acceptInvitationWithNewAccount, signupCompany } from './server/auth-actions';

type CreateUser = { data: { user: { id: string } | null }; error: unknown };

function setup(createUser: CreateUser, companies: Responder = () => ({ data: null })) {
  const fake = createFakeSupabase(companies);
  const admin = {
    ...fake.client,
    auth: {
      admin: {
        createUser: vi.fn(async () => createUser),
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
  };
  h.admin = admin;
  h.server = {
    auth: { signInWithPassword: vi.fn(async () => ({ data: {}, error: null })) },
  };
  return { admin, fake };
}

const signupForm = () => {
  const f = new FormData();
  f.set('companyName', '테스트 인테리어');
  f.set('slug', 'test-co');
  f.set('displayName', '박예원');
  f.set('email', 'owner@test.local');
  f.set('password', 'Sup3r-secret-pw');
  f.set('passwordConfirm', 'Sup3r-secret-pw');
  f.set('agree', 'on');
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

describe('A-03 signupCompany 중립 응답', () => {
  it('예외: 이미 있는 이메일(422)과 서버 오류(500)는 같은 code 로 응답한다', async () => {
    setup({ data: { user: null }, error: { status: 422, code: 'email_exists' } });
    const exists = await run(signupCompany(null, signupForm()));
    setup({ data: { user: null }, error: { status: 500, code: 'unexpected_failure' } });
    const other = await run(signupCompany(null, signupForm()));
    expect(exists).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(other).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    // ref 는 둘 다 있다(값은 매번 다름) — 응답 모양이 같다
    expect(Object.keys((exists as { error: object }).error).sort()).toEqual(
      Object.keys((other as { error: object }).error).sort(),
    );
    // A-03 응답 시간 평준화: 두 실패 모두 요청 시작 시각 기준으로 대기한다
    expect(h.level).toHaveBeenCalledTimes(2);
    expect(typeof h.level.mock.calls[0]?.[0]).toBe('number');
  });

  it('A-03 주소명 중복은 계정을 만들기 전에 판정한다 (SLUG_TAKEN 이 이메일 존재를 드러내지 않음)', async () => {
    const { admin } = setup({ data: { user: { id: 'u1' } }, error: null }, (q) =>
      q.table === 'companies' ? { data: { id: 'c1' } } : undefined,
    );
    const res = await run(signupCompany(null, signupForm()));
    expect(res).toMatchObject({ ok: false, error: { code: 'SLUG_TAKEN' } });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('A-03 업체 생성 RPC 실패(주소명 외)도 같은 중립 응답 + 계정 삭제(보상)', async () => {
    const { admin } = setup({ data: { user: { id: 'u1' } }, error: null }, (q) =>
      q.table === 'rpc:create_company_with_owner' ? { error: { code: 'XX000' } } : undefined,
    );
    const res = await run(signupCompany(null, signupForm()));
    expect(res).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u1');
    expect(h.level).toHaveBeenCalledTimes(1);
  });

  it('정상: 가입 성공 → 업체 화면으로 이동', async () => {
    setup({ data: { user: { id: 'u1' } }, error: null });
    expect(await run(signupCompany(null, signupForm()))).toEqual({
      redirect: 'REDIRECT:/app/test-co/projects',
    });
    expect(h.level).not.toHaveBeenCalled(); // 성공 경로는 대기 없음
  });
});

describe('A-03 acceptInvitationWithNewAccount 중립 응답', () => {
  const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
  const inviteRow: Responder = (q) =>
    q.table === 'invitations'
      ? {
          data: {
            company_id: 'c1',
            project_id: null,
            email: 'invitee@test.local',
            member_role: 'pm',
            participant_role: null,
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            accepted_at: null,
            revoked_at: null,
          },
        }
      : q.table === 'companies'
        ? { data: { name: '업체' } }
        : undefined;
  const form = () => {
    const f = new FormData();
    f.set('token', TOKEN);
    f.set('displayName', '초대받은 사람');
    f.set('password', 'Sup3r-secret-pw');
    f.set('passwordConfirm', 'Sup3r-secret-pw');
    return f;
  };

  it('예외: 기존 계정(422)과 기타 오류가 같은 code', async () => {
    setup({ data: { user: null }, error: { status: 422 } }, inviteRow);
    const a = await run(acceptInvitationWithNewAccount(null, form()));
    setup({ data: { user: null }, error: { status: 500 } }, inviteRow);
    const b = await run(acceptInvitationWithNewAccount(null, form()));
    expect(a).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(b).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
    expect(h.level).toHaveBeenCalledTimes(2);
  });

  it('예외: 수락 RPC 실패 → 계정 삭제(보상) 후 같은 평준화 대기', async () => {
    const { admin } = setup({ data: { user: { id: 'u9' } }, error: null }, (q) =>
      q.table === 'rpc:accept_invitation'
        ? { error: { code: 'P0001', message: 'x' } }
        : inviteRow(q),
    );
    const res = await run(acceptInvitationWithNewAccount(null, form()));
    expect(res).toMatchObject({ ok: false });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith('u9');
    expect(h.level).toHaveBeenCalledTimes(1);
  });

  it('예외: 폐기·없는 초대 → INVITE_INVALID, 계정을 만들지 않는다', async () => {
    const { admin } = setup({ data: { user: { id: 'u1' } }, error: null });
    expect(await run(acceptInvitationWithNewAccount(null, form()))).toMatchObject({
      ok: false,
      error: { code: 'INVITE_INVALID' },
    });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });
});
