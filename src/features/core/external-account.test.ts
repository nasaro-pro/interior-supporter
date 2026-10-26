// D-12·D-14·D-15·D-16·D-17 디자이너가 만든 고객·시공팀 계정 — 생성·배정·메일·재발송·첫 로그인·업체 단위 회수
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/shared/lib/rate-limit';
import { createFakeSupabase, type Responder } from './testing/fake-supabase';

const h = vi.hoisted(() => ({
  admin: null as unknown,
  server: null as unknown,
  access: null as unknown,
  ctx: null as unknown,
}));
vi.mock('@/shared/lib/supabase/admin', () => ({ createAdminSupabase: () => h.admin }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: async () => h.server }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));
vi.mock('./server/access', () => ({
  findProjectAccess: async () => h.access,
  loadAccessContext: async () => h.ctx,
}));

import {
  completeFirstPassword,
  createExternalAccount,
  resendTempPassword,
} from './server/auth-actions';
import { revokeCompanyAccess } from './server/participant-actions';

const P = '00000000-0000-4000-8000-0000000000a1';
const C = '00000000-0000-4000-8000-0000000000c1';
const U = '00000000-0000-4000-8000-0000000000d1';
const ME = '00000000-0000-4000-8000-0000000000e1';
const editorAccess = {
  projectId: P,
  companyId: C,
  companySlug: 'studio',
  as: 'editor',
  canConfirm: false,
};
const ctx = {
  userId: ME,
  displayName: '디자이너',
  locale: 'ko',
  memberships: [{ companyId: C, slug: 'studio', name: '스튜디오', role: 'pm' }],
  participations: [],
  areas: ['app'],
};

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const v = {
    projectId: P,
    role: 'customer',
    displayName: '김고객',
    email: 'cust@test.local',
    canConfirm: 'on',
    validFrom: '',
    validUntil: '',
    ...over,
  };
  for (const [k, x] of Object.entries(v)) f.set(k, x);
  return f;
};

function setup(opts: {
  createUser?: { data: { user: { id: string } | null }; error: unknown };
  admin?: Responder;
  server?: Responder;
  serverAuth?: Record<string, unknown>;
}) {
  const adminFake = createFakeSupabase(opts.admin ?? (() => ({ data: null })));
  const admin = {
    ...adminFake.client,
    auth: {
      admin: {
        createUser: vi.fn(
          async () => opts.createUser ?? { data: { user: { id: U } }, error: null },
        ),
        deleteUser: vi.fn(async () => ({ error: null })),
        getUserById: vi.fn(async () => ({ data: { user: { email: 'cust@test.local' } } })),
        updateUserById: vi.fn(async () => ({ error: null })),
      },
    },
  };
  const serverFake = createFakeSupabase(
    opts.server ??
      ((q) => (q.table === 'projects' ? { data: { name: '강남 A현장' } } : { data: null })),
    opts.serverAuth ?? {},
  );
  h.admin = admin;
  h.server = serverFake.client;
  return { admin, adminFake, serverFake };
}

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
  h.access = editorAccess;
  h.ctx = ctx;
  delete process.env.MAIL_API_KEY;
  delete process.env.MAIL_FROM;
});
afterEach(() => vi.unstubAllGlobals());

describe('D-12 createExternalAccount', () => {
  it('새 계정: 임시 비밀번호로 생성 → 변경 필요 표시 → 디자이너 세션으로 배정 RPC, 메일 미설정이면 비밀번호를 한 번 돌려줌', async () => {
    const { admin, adminFake, serverFake } = setup({});
    const res = await createExternalAccount(null, form());
    expect(res).toMatchObject({ ok: true, data: { created: true, mail: 'not_configured' } });
    const temp = (res as { data: { tempPassword: string } }).data.tempPassword;
    expect(temp).toMatch(/^[A-Za-z2-9]{12}$/);
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'cust@test.local', password: temp, email_confirm: true }),
    );
    const flag = adminFake.of('profiles')[0];
    expect(JSON.stringify(flag?.calls)).toContain('"must_change_password":true');
    const rpc = serverFake.of('rpc:assign_external_participant')[0];
    expect(rpc?.calls[0]?.[1]).toMatchObject({
      p_project: P,
      p_email: 'cust@test.local',
      p_role: 'customer',
      p_can_confirm: true,
    });
    // admin 클라이언트로 배정하지 않는다 (RLS·권한 검사를 디자이너 세션이 받는다)
    expect(adminFake.of('rpc:assign_external_participant')).toHaveLength(0);
  });

  it('메일이 설정돼 있으면 보내고 비밀번호는 돌려주지 않음', async () => {
    process.env.MAIL_API_KEY = 'k';
    process.env.MAIL_FROM = 'no-reply@test.local';
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setup({});
    const res = await createExternalAccount(null, form());
    expect(res).toMatchObject({
      ok: true,
      data: { created: true, mail: 'sent', tempPassword: null },
    });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as { body: string };
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['cust@test.local']);
    expect(body.text).toContain('임시 비밀번호');
  });

  it('이미 있는 이메일: 계정은 그대로, 변경 필요 표시 없음, 배정만', async () => {
    const { admin, adminFake, serverFake } = setup({
      createUser: { data: { user: null }, error: { status: 422, code: 'email_exists' } },
    });
    const res = await createExternalAccount(null, form());
    expect(res).toMatchObject({ ok: true, data: { created: false, tempPassword: null } });
    expect(adminFake.of('profiles')).toHaveLength(0);
    expect(admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(serverFake.of('rpc:assign_external_participant')).toHaveLength(1);
  });

  it('배정 실패면 새로 만든 계정을 지운다 (보상), 같은 업체 디자이너 이메일은 필드 오류', async () => {
    const { admin } = setup({
      server: (q) =>
        q.table === 'rpc:assign_external_participant'
          ? { error: { code: 'P0001', message: 'scope_mismatch' } }
          : { data: null },
    });
    const res = await createExternalAccount(null, form());
    expect(res).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED', fieldErrors: { email: ['field.staffEmail'] } },
    });
    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(U);
  });

  it('권한 거부: 편집자가 아니면 NOT_FOUND, 계정을 만들지 않음', async () => {
    h.access = null;
    const { admin } = setup({});
    expect(await createExternalAccount(null, form())).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('입력 오류: 시공팀에 확정권·이메일 형식', async () => {
    setup({});
    expect(await createExternalAccount(null, form({ role: 'field' }))).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(await createExternalAccount(null, form({ email: 'nope' }))).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });
});

describe('D-16 resendTempPassword', () => {
  it('첫 로그인 전 계정: 새 임시 비밀번호 + 만료 갱신', async () => {
    const { admin } = setup({
      server: (q) =>
        q.table === 'project_participants'
          ? { data: { id: 'pp1' } }
          : q.table === 'projects'
            ? { data: { name: 'P' } }
            : { data: null },
      admin: (q) =>
        q.table === 'profiles'
          ? {
              data: {
                display_name: '김고객',
                must_change_password: true,
                temp_password_expires_at: '2000-01-01T00:00:00Z',
              },
            }
          : { data: null },
    });
    const res = await resendTempPassword({ projectId: P, userId: U });
    expect(res).toMatchObject({
      ok: true,
      data: { mail: 'not_configured', email: 'cust@test.local' },
    });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      U,
      expect.objectContaining({ password: expect.stringMatching(/^[A-Za-z2-9]{12}$/) }),
    );
  });

  it('이미 자기 비밀번호를 정한 계정은 CONFLICT (비밀번호를 바꾸지 않음)', async () => {
    const { admin } = setup({
      server: (q) =>
        q.table === 'project_participants' ? { data: { id: 'pp1' } } : { data: null },
      admin: (q) =>
        q.table === 'profiles'
          ? {
              data: {
                display_name: 'x',
                must_change_password: false,
                temp_password_expires_at: null,
              },
            }
          : { data: null },
    });
    expect(await resendTempPassword({ projectId: P, userId: U })).toMatchObject({
      ok: false,
      error: { code: 'CONFLICT' },
    });
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('이 프로젝트의 고객·시공팀이 아니면 NOT_FOUND, 편집자가 아니면 NOT_FOUND', async () => {
    const { admin } = setup({ server: () => ({ data: null }) });
    expect(await resendTempPassword({ projectId: P, userId: U })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    h.access = null;
    expect(await resendTempPassword({ projectId: P, userId: U })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });
});

describe('D-15 completeFirstPassword', () => {
  const pwForm = (current: string, next: string) => {
    const f = new FormData();
    f.set('currentPassword', current);
    f.set('password', next);
    f.set('passwordConfirm', next);
    return f;
  };
  const flagged = (q: { table: string }) =>
    q.table === 'profiles'
      ? {
          data: {
            must_change_password: true,
            temp_password_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          },
        }
      : { data: null };

  function auth(signInError: unknown = null) {
    return {
      getUser: vi.fn(async () => ({ data: { user: { id: U, email: 'cust@test.local' } } })),
      signInWithPassword: vi.fn(async () => ({ error: signInError })),
      updateUser: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    };
  }

  it('정상: 임시 비밀번호 확인 → 새 비밀번호 → 표시 해제 → 영역 선택', async () => {
    const a = auth();
    const { adminFake } = setup({ admin: flagged, serverAuth: a });
    const res = await run(completeFirstPassword(null, pwForm('TempPass2345', 'My-new-pass-2026')));
    expect(res).toEqual({ redirect: 'REDIRECT:/select-area' });
    expect(a.updateUser).toHaveBeenCalledWith({ password: 'My-new-pass-2026' });
    expect(JSON.stringify(adminFake.of('profiles')[1]?.calls)).toContain(
      '"must_change_password":false',
    );
    expect(a.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('임시 비밀번호가 틀리면 필드 오류, 바꾸지 않음', async () => {
    const a = auth({ message: 'bad' });
    setup({ admin: flagged, serverAuth: a });
    expect(
      await run(completeFirstPassword(null, pwForm('wrong', 'My-new-pass-2026'))),
    ).toMatchObject({
      ok: false,
      error: { fieldErrors: { currentPassword: ['field.invalid'] } },
    });
    expect(a.updateUser).not.toHaveBeenCalled();
  });

  it('임시 비밀번호와 같은 새 비밀번호는 거절', async () => {
    const a = auth();
    setup({ admin: flagged, serverAuth: a });
    expect(
      await run(completeFirstPassword(null, pwForm('Same-pass-2026', 'Same-pass-2026'))),
    ).toMatchObject({ ok: false, error: { fieldErrors: { password: ['field.sameAsTemp'] } } });
  });

  it('표시가 없는 계정은 바로 영역 선택으로 (이 화면을 쓸 이유 없음)', async () => {
    const a = auth();
    setup({
      admin: () => ({ data: { must_change_password: false, temp_password_expires_at: null } }),
      serverAuth: a,
    });
    expect(await run(completeFirstPassword(null, pwForm('x', 'My-new-pass-2026')))).toEqual({
      redirect: 'REDIRECT:/select-area',
    });
    expect(a.updateUser).not.toHaveBeenCalled();
  });
});

describe('D-17 revokeCompanyAccess', () => {
  it('정상: 이 업체의 고객·시공팀 배정만 회수 (RLS 범위 + 조건)', async () => {
    const { serverFake } = setup({
      server: (q) =>
        q.table === 'project_participants' ? { data: [{ project_id: P }] } : { data: null },
    });
    expect(await revokeCompanyAccess({ companyId: C, userId: U })).toEqual({
      ok: true,
      data: { revoked: 1 },
    });
    const q = serverFake.of('project_participants')[0]!;
    const s = JSON.stringify(q.calls);
    expect(s).toContain('["eq","company_id","' + C + '"]');
    expect(s).toContain('["in","role",["customer","field"]]');
    expect(s).toContain('["is","revoked_at",null]');
  });

  it('권한 거부: 이 업체 구성원이 아니면 NOT_FOUND, 자기 자신은 FORBIDDEN', async () => {
    setup({});
    h.ctx = { ...ctx, memberships: [] };
    expect(await revokeCompanyAccess({ companyId: C, userId: U })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    h.ctx = ctx;
    expect(await revokeCompanyAccess({ companyId: C, userId: ME })).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
  });

  it('회수할 배정이 없으면 NOT_FOUND', async () => {
    setup({ server: () => ({ data: [] }) });
    expect(await revokeCompanyAccess({ companyId: C, userId: U })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
});
