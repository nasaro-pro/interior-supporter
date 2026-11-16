// A-04: 초대 폐기 전에 앱에서 권한 확인 (프로젝트 초대 = 편집자, 업체 초대 = owner/manager) — P-02 이중 검증
// A-10: assignPm 재활성화 시 기간 초기화·영향 행 확인
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { called, createFakeSupabase, type Responder } from './testing/fake-supabase';
import { P1, X, Y, accessResponder, authOf, chain, type Who } from './testing/access-fixture';

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: async () => h.client }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import { assignPm, revokeInvite, updateParticipant } from './server/participant-actions';

const INV = '00000000-0000-4000-8000-0000000000d1';
const brief = {
  id: P1,
  company_id: X,
  name: 'P1',
  site_address: '',
  is_public: true,
  archived_at: null,
};

function setup(who: Who, invite: Record<string, unknown> | null, briefRows: unknown[] = [brief]) {
  const responder: Responder = (q) => {
    if (q.table === 'invitations' && called(q, 'select', 'id, company_id, project_id'))
      return { data: invite };
    if (q.table === 'invitations' && q.calls.some(([m]) => m === 'update'))
      return { data: { id: INV } };
    if (q.table === 'rpc:project_brief') return { data: briefRows };
    return undefined;
  };
  const fake = createFakeSupabase(chain(responder, accessResponder(who)), authOf(who));
  h.client = fake.client;
  return fake;
}

const updates = (fake: ReturnType<typeof createFakeSupabase>) =>
  fake.of('invitations').filter((q) => q.calls.some(([m]) => m === 'update'));

const OWNER_X: Who = { members: [{ company_id: X, slug: 'x-co', role: 'owner' }] };
const PM1: Who = {
  members: [{ company_id: X, slug: 'x-co', role: 'pm' }],
  parts: [{ project_id: P1, company_id: X, role: 'pm' }],
};

beforeEach(() => vi.clearAllMocks());

describe('A-04 revokeInvite', () => {
  it('정상: 프로젝트 편집자(PM1)는 자기 프로젝트 초대를 폐기한다', async () => {
    const fake = setup(PM1, { id: INV, company_id: X, project_id: P1 });
    expect(await revokeInvite({ inviteId: INV, projectId: P1 })).toEqual({ ok: true, data: null });
    expect(updates(fake)).toHaveLength(1);
  });

  it('정상: owner 는 업체 구성원 초대를 폐기한다', async () => {
    const fake = setup(OWNER_X, { id: INV, company_id: X, project_id: null });
    expect(await revokeInvite({ inviteId: INV, projectId: null })).toEqual({
      ok: true,
      data: null,
    });
    expect(updates(fake)).toHaveLength(1);
  });

  it('권한 거부: PM1 이 업체 구성원 초대를 폐기하면 NOT_FOUND, update 없음', async () => {
    const fake = setup(PM1, { id: INV, company_id: X, project_id: null });
    expect(await revokeInvite({ inviteId: INV, projectId: null })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(updates(fake)).toHaveLength(0);
  });

  it('권한 거부: 편집자가 아닌 프로젝트의 초대 → NOT_FOUND, update 없음', async () => {
    const pm2: Who = { members: [{ company_id: X, slug: 'x-co', role: 'pm' }], parts: [] };
    const fake = setup(pm2, { id: INV, company_id: X, project_id: P1 });
    expect(await revokeInvite({ inviteId: INV, projectId: P1 })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(updates(fake)).toHaveLength(0);
  });

  it('권한 거부: 다른 업체(Y) 구성원 초대 → NOT_FOUND', async () => {
    const fake = setup(OWNER_X, { id: INV, company_id: Y, project_id: null });
    expect(await revokeInvite({ inviteId: INV, projectId: null })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(updates(fake)).toHaveLength(0);
  });

  it('예외: 없는(이미 수락·폐기된) 초대, 화면 projectId 불일치 → NOT_FOUND', async () => {
    setup(OWNER_X, null);
    expect(await revokeInvite({ inviteId: INV, projectId: null })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    const fake = setup(OWNER_X, { id: INV, company_id: X, project_id: P1 });
    expect(await revokeInvite({ inviteId: INV, projectId: null })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(updates(fake)).toHaveLength(0);
  });

  it('검증: inviteId 가 uuid 가 아니면 VALIDATION_FAILED', async () => {
    setup(OWNER_X, null);
    expect(await revokeInvite({ inviteId: 'x', projectId: null })).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
  });
});

describe('A-10 assignPm 재활성화', () => {
  const PMU = '00000000-0000-4000-8000-0000000000a7';
  function setupAssign(who: Who, insertError: { code: string } | null, updated: unknown) {
    const responder: Responder = (q) => {
      if (q.table === 'rpc:project_brief') return { data: [brief] };
      if (q.table === 'project_participants' && q.calls.some(([m]) => m === 'insert'))
        return { error: insertError };
      if (q.table === 'project_participants' && q.calls.some(([m]) => m === 'update'))
        return { data: updated };
      return undefined;
    };
    const fake = createFakeSupabase(chain(responder, accessResponder(who)), authOf(who));
    h.client = fake.client;
    return fake;
  }
  const ppUpdates = (fake: ReturnType<typeof createFakeSupabase>) =>
    fake.of('project_participants').filter((q) => q.calls.some(([m]) => m === 'update'));

  it('정상: 새 배정(insert 성공) → ok, update 없음', async () => {
    const fake = setupAssign(OWNER_X, null, null);
    expect(await assignPm({ projectId: P1, userId: PMU })).toEqual({ ok: true, data: null });
    expect(ppUpdates(fake)).toHaveLength(0);
  });

  it('정상: 이미(회수·만료) 배정 23505 → 회수·기간을 모두 비우고 영향 행을 확인한다', async () => {
    const fake = setupAssign(OWNER_X, { code: '23505' }, { id: 'pp1' });
    expect(await assignPm({ projectId: P1, userId: PMU })).toEqual({ ok: true, data: null });
    const [u] = ppUpdates(fake);
    expect(called(u!, 'update', { revoked_at: null, valid_from: null, valid_until: null })).toBe(
      true,
    );
    expect(called(u!, 'eq', 'role', 'pm')).toBe(true);
    expect(called(u!, 'select', 'id')).toBe(true);
    expect(called(u!, 'maybeSingle')).toBe(true);
  });

  it('예외: 23505 인데 갱신된 행 0 (RLS 거부·행 없음) → NOT_FOUND (성공 토스트 금지)', async () => {
    setupAssign(OWNER_X, { code: '23505' }, null);
    expect(await assignPm({ projectId: P1, userId: PMU })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('권한 거부: 편집자가 아닌 PM → NOT_FOUND, 쓰기 없음', async () => {
    const pm2: Who = { members: [{ company_id: X, slug: 'x-co', role: 'pm' }], parts: [] };
    const fake = setupAssign(pm2, null, null);
    expect(await assignPm({ projectId: P1, userId: PMU })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(
      fake.of('project_participants').filter((q) => q.calls.some(([m]) => m === 'insert')),
    ).toHaveLength(0);
  });
});

describe('참여자 수정 — 이름(고객·시공팀)·기간·확정권', () => {
  const PART = '00000000-0000-4000-8000-0000000000e1';
  function setupEdit(who: Who, role: string, opts: { nameError?: unknown } = {}) {
    const responder: Responder = (q) => {
      if (q.table === 'rpc:project_brief') return { data: [brief] };
      if (q.table === 'project_participants' && called(q, 'select', 'role'))
        return { data: { role } };
      if (q.table === 'project_participants' && q.calls.some(([m]) => m === 'update'))
        return { data: { version: 3 } };
      if (q.table === 'rpc:update_participant_name') return { error: opts.nameError ?? null };
      return undefined;
    };
    const fake = createFakeSupabase(chain(responder, accessResponder(who)), authOf(who));
    h.client = fake.client;
    return fake;
  }
  const form = (extra: Record<string, string> = {}) => {
    const f = new FormData();
    f.set('projectId', P1);
    f.set('participantId', PART);
    f.set('baseVersion', '2');
    f.set('validFrom', '');
    f.set('validUntil', '');
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };

  it('정상: 고객 이름을 RPC 로 바꾸고 기간·확정권도 저장한다', async () => {
    const fake = setupEdit(PM1, 'customer');
    expect(
      await updateParticipant(null, form({ displayName: ' 김고객 ', canConfirm: 'on' })),
    ).toEqual({
      ok: true,
      data: { version: 3 },
    });
    const rpc = fake.of('rpc:update_participant_name');
    expect(rpc).toHaveLength(1);
    expect(rpc[0]!.calls[0]).toEqual([
      'args',
      { p_project: P1, p_participant: PART, p_display_name: '김고객' },
    ]);
  });

  it('PM 참여는 이름을 보내도 RPC 를 부르지 않는다 (업체 구성원 이름은 본인만)', async () => {
    const fake = setupEdit(PM1, 'pm');
    expect((await updateParticipant(null, form({ displayName: '바꿈' }))).ok).toBe(true);
    expect(fake.of('rpc:update_participant_name')).toHaveLength(0);
  });

  it('검증: 빈 이름 → VALIDATION_FAILED, 쓰기 없음', async () => {
    const fake = setupEdit(PM1, 'customer');
    const res = await updateParticipant(null, form({ displayName: '   ' }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('VALIDATION_FAILED');
    expect(fake.of('rpc:update_participant_name')).toHaveLength(0);
  });

  it('권한 거부: DB 가 forbidden 이면 FORBIDDEN, 기간 update 없음', async () => {
    const fake = setupEdit(PM1, 'customer', {
      nameError: { code: 'P0001', message: 'forbidden' },
    });
    const res = await updateParticipant(null, form({ displayName: '김고객' }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('FORBIDDEN');
    expect(
      fake.of('project_participants').filter((q) => q.calls.some(([m]) => m === 'update')),
    ).toHaveLength(0);
  });

  it('권한 거부: 편집자가 아닌 프로젝트 → NOT_FOUND, RPC 없음', async () => {
    const fake = setupEdit(
      { members: [{ company_id: Y, slug: 'y-co', role: 'owner' }] },
      'customer',
    );
    const res = await updateParticipant(null, form({ displayName: '김고객' }));
    expect(res.ok).toBe(false);
    expect(fake.of('rpc:update_participant_name')).toHaveLength(0);
  });
});
