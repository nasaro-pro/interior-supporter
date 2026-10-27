// A-08: 초대 미리보기는 server-only 조회 모듈(공개 Server Action 아님), 로그인 수락은 사용자별 요청 제한
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/shared/lib/rate-limit';
import { createFakeSupabase, type Responder } from './testing/fake-supabase';

const h = vi.hoisted(() => ({
  admin: null as unknown,
  ctx: null as null | { userId: string },
}));
vi.mock('@/shared/lib/supabase/admin', () => ({ createAdminSupabase: () => h.admin }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: async () => ({}) }));
vi.mock('./server/access', () => ({ loadAccessContext: async () => h.ctx }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
}));

import * as authActions from './server/auth-actions';
import { getInvitationPreview, sha256 } from './server/invitation-queries';

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345';
const future = () => new Date(Date.now() + 3600_000).toISOString();
const row = (over: Record<string, unknown> = {}) => ({
  company_id: 'c1',
  project_id: null,
  email: 'invitee@test.local',
  member_role: 'pm',
  participant_role: null,
  expires_at: future(),
  accepted_at: null,
  revoked_at: null,
  ...over,
});

function setup(respond: Responder) {
  const fake = createFakeSupabase(respond);
  h.admin = fake.client;
  return fake;
}

beforeEach(() => {
  resetRateLimits();
  h.ctx = null;
});

describe('A-08 getInvitationPreview (server-only 조회)', () => {
  it('공개 Server Action 목록(auth-actions export)에 미리보기가 없다', () => {
    expect(Object.keys(authActions)).not.toContain('getInvitationPreview');
    expect(Object.keys(authActions).sort()).toEqual(
      [
        'acceptInvitationAsCurrentUser',
        'acceptInvitationWithNewAccount',
        'completeFirstPassword',
        'createExternalAccount',
        'createPasswordResetLink',
        'resendTempPassword',
        'signupCompany',
      ].sort(),
    );
  });

  it('정상: 유효한 업체 초대 → 업체 이름·이메일·역할·영역(app), 토큰은 해시로만 조회', async () => {
    const fake = setup((q) =>
      q.table === 'invitations'
        ? { data: row() }
        : q.table === 'companies'
          ? { data: { name: '스튜디오 X' } }
          : undefined,
    );
    expect(await getInvitationPreview(TOKEN)).toEqual({
      status: 'valid',
      companyName: '스튜디오 X',
      email: 'invitee@test.local',
      role: 'pm',
      area: 'app',
    });
    const inv = fake.of('invitations')[0]!;
    expect(inv.calls).toContainEqual(['eq', 'token_hash', sha256(TOKEN)]);
    expect(JSON.stringify(inv.calls)).not.toContain(TOKEN);
  });

  it('정상: 프로젝트 고객 초대 → portal, 시공팀 → field', async () => {
    setup((q) =>
      q.table === 'invitations'
        ? { data: row({ project_id: 'p1', member_role: null, participant_role: 'customer' }) }
        : undefined,
    );
    expect(await getInvitationPreview(TOKEN)).toMatchObject({ status: 'valid', area: 'portal' });
    setup((q) =>
      q.table === 'invitations'
        ? { data: row({ project_id: 'p1', member_role: null, participant_role: 'field' }) }
        : undefined,
    );
    expect(await getInvitationPreview(TOKEN)).toMatchObject({ status: 'valid', area: 'field' });
  });

  it('예외: 사용됨 → used, 폐기·만료·없음 → invalid (같은 안내)', async () => {
    setup((q) =>
      q.table === 'invitations' ? { data: row({ accepted_at: future() }) } : undefined,
    );
    expect(await getInvitationPreview(TOKEN)).toEqual({ status: 'used' });
    setup((q) => (q.table === 'invitations' ? { data: row({ revoked_at: future() }) } : undefined));
    expect(await getInvitationPreview(TOKEN)).toEqual({ status: 'invalid' });
    setup((q) =>
      q.table === 'invitations'
        ? { data: row({ expires_at: new Date(Date.now() - 1000).toISOString() }) }
        : undefined,
    );
    expect(await getInvitationPreview(TOKEN)).toEqual({ status: 'invalid' });
    setup(() => undefined);
    expect(await getInvitationPreview(TOKEN)).toEqual({ status: 'invalid' });
  });

  it('예외: 형식이 틀린 토큰은 DB 를 조회하지 않는다', async () => {
    const fake = setup(() => undefined);
    expect(await getInvitationPreview('short')).toEqual({ status: 'invalid' });
    expect(await getInvitationPreview('a'.repeat(20) + '/../x')).toEqual({ status: 'invalid' });
    expect(fake.queries).toHaveLength(0);
  });
});

describe('A-08 acceptInvitationAsCurrentUser 요청 제한 invite:user:<userId>', () => {
  const accept = (token = TOKEN) =>
    authActions.acceptInvitationAsCurrentUser(token).catch((e: Error) => ({
      redirect: e.message,
    }));

  it('권한: 미로그인 → UNAUTHENTICATED, RPC 호출 없음', async () => {
    const fake = setup(() => undefined);
    expect(await accept()).toEqual({ ok: false, error: { code: 'UNAUTHENTICATED' } });
    expect(fake.queries).toHaveLength(0);
  });

  it('정상: 로그인 사용자 수락 → 업체 화면으로 이동', async () => {
    h.ctx = { userId: 'u1' };
    setup((q) =>
      q.table === 'rpc:accept_invitation'
        ? { data: { company_id: 'c1', project_id: null, area: 'app' } }
        : q.table === 'companies'
          ? { data: { slug: 'studio-x' } }
          : undefined,
    );
    expect(await accept()).toEqual({ redirect: 'REDIRECT:/app/studio-x/projects' });
  });

  it('예외: 같은 사용자 1시간 10회 초과 → RATE_LIMITED (RPC 없음), 다른 사용자는 영향 없음', async () => {
    h.ctx = { userId: 'u1' };
    const fake = setup((q) =>
      q.table === 'rpc:accept_invitation' ? { error: { code: 'P0001', message: 'x' } } : undefined,
    );
    for (let i = 0; i < 10; i++) {
      expect(await accept()).toMatchObject({ ok: false });
    }
    const before = fake.of('rpc:accept_invitation').length;
    expect(before).toBe(10);
    expect(await accept()).toEqual({ ok: false, error: { code: 'RATE_LIMITED' } });
    expect(fake.of('rpc:accept_invitation')).toHaveLength(before);
    // 형식이 틀린 토큰 대입도 센다 (제한 검사가 형식 검사보다 먼저)
    expect(await accept('bad')).toEqual({ ok: false, error: { code: 'RATE_LIMITED' } });

    h.ctx = { userId: 'u2' };
    expect(await accept('bad')).toEqual({ ok: false, error: { code: 'INVITE_INVALID' } });
  });
});
