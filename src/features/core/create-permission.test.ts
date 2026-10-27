// D-36 · CA-07 프로젝트 생성 권한 — 요청(담당자) · 승인/거절 · 켜기/끄기(업체관리자)
// 앱은 역할로 먼저 거르고, 최종 판정은 RPC(pgTAP a_p4_project_create_permission)가 한다
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callOf, createFakeSupabase, type Responder } from './testing/fake-supabase';
import { X, Y, accessResponder, authOf, chain, type Who } from './testing/access-fixture';

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: async () => h.client }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  decideProjectCreatePermission,
  requestProjectCreatePermission,
  setProjectCreatePermission,
} from './server/create-permission-actions';

const REQ = '00000000-0000-4000-8000-0000000000d1';
const MEMBER = '00000000-0000-4000-8000-0000000000d2';
const OWNER_X: Who = { members: [{ company_id: X, slug: 'x-co', role: 'owner' }] };
const MANAGER_X: Who = { members: [{ company_id: X, slug: 'x-co', role: 'manager' }] };
const PM_X: Who = { members: [{ company_id: X, slug: 'x-co', role: 'pm' }] };

function setup(who: Who, extra: Responder = () => undefined) {
  const fake = createFakeSupabase(chain(extra, accessResponder(who)), authOf(who));
  h.client = fake.client;
  return fake;
}
const rpc = (fake: ReturnType<typeof createFakeSupabase>, name: string) =>
  fake.of(`rpc:${name}`)[0];

beforeEach(() => vi.clearAllMocks());

describe('requestProjectCreatePermission (담당자)', () => {
  it('정상: 담당자가 요청하면 RPC 에 업체 · 메모를 보낸다', async () => {
    const fake = setup(PM_X, (q) =>
      q.table === 'rpc:request_project_create' ? { data: REQ } : undefined,
    );
    expect(await requestProjectCreatePermission({ companyId: X, note: '현장 맡음' })).toEqual({
      ok: true,
      data: { requestId: REQ },
    });
    expect(callOf(rpc(fake, 'request_project_create')!, 'args')?.[1]).toEqual({
      p_company: X,
      p_note: '현장 맡음',
    });
  });

  it('예외: 이미 권한이 있으면 CONFLICT', async () => {
    setup(PM_X, (q) =>
      q.table === 'rpc:request_project_create'
        ? { error: { code: 'P0001', message: 'already_allowed' } }
        : undefined,
    );
    expect(await requestProjectCreatePermission({ companyId: X })).toMatchObject({
      ok: false,
      error: { code: 'CONFLICT' },
    });
  });

  it('권한 거부: 업체관리자는 요청할 필요가 없다 → FORBIDDEN, 다른 업체 → NOT_FOUND', async () => {
    let fake = setup(OWNER_X);
    expect(await requestProjectCreatePermission({ companyId: X })).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
    expect(fake.of('rpc:request_project_create')).toHaveLength(0);
    fake = setup(PM_X);
    expect(await requestProjectCreatePermission({ companyId: Y })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(fake.of('rpc:request_project_create')).toHaveLength(0);
  });

  it('예외: 메모가 500자를 넘으면 입력 오류', async () => {
    setup(PM_X);
    expect(
      await requestProjectCreatePermission({ companyId: X, note: 'a'.repeat(501) }),
    ).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });
});

describe('decideProjectCreatePermission (업체관리자)', () => {
  it('정상: 관리자가 승인', async () => {
    const fake = setup(MANAGER_X, (q) =>
      q.table === 'rpc:decide_project_create_request' ? { data: null } : undefined,
    );
    expect(
      await decideProjectCreatePermission({ companyId: X, requestId: REQ, approve: true }),
    ).toEqual({ ok: true, data: null });
    expect(callOf(rpc(fake, 'decide_project_create_request')!, 'args')?.[1]).toEqual({
      p_request: REQ,
      p_approve: true,
    });
  });

  it('권한 거부: 담당자는 승인 못 함 (RPC 호출 없음), DB 가 forbidden 이면 FORBIDDEN', async () => {
    const fake = setup(PM_X);
    expect(
      await decideProjectCreatePermission({ companyId: X, requestId: REQ, approve: true }),
    ).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(fake.of('rpc:decide_project_create_request')).toHaveLength(0);
    setup(OWNER_X, (q) =>
      q.table === 'rpc:decide_project_create_request'
        ? { error: { code: 'P0001', message: 'forbidden' } }
        : undefined,
    );
    expect(
      await decideProjectCreatePermission({ companyId: X, requestId: REQ, approve: false }),
    ).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });
});

describe('setProjectCreatePermission (업체관리자)', () => {
  it('정상: 소유자가 담당자 권한을 끈다', async () => {
    const fake = setup(OWNER_X, (q) =>
      q.table === 'rpc:set_project_create_permission' ? { data: null } : undefined,
    );
    expect(
      await setProjectCreatePermission({ companyId: X, memberId: MEMBER, allowed: false }),
    ).toEqual({ ok: true, data: null });
    expect(callOf(rpc(fake, 'set_project_create_permission')!, 'args')?.[1]).toEqual({
      p_member: MEMBER,
      p_allowed: false,
    });
  });

  it('예외: 소유자 · 관리자 행이면 입력 오류, 담당자는 거부', async () => {
    setup(OWNER_X, (q) =>
      q.table === 'rpc:set_project_create_permission'
        ? { error: { code: 'P0001', message: 'invalid_target' } }
        : undefined,
    );
    expect(
      await setProjectCreatePermission({ companyId: X, memberId: MEMBER, allowed: true }),
    ).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    setup(PM_X);
    expect(
      await setProjectCreatePermission({ companyId: X, memberId: MEMBER, allowed: true }),
    ).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });
});
