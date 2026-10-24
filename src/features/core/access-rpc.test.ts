// DB-05 후속: 접근 판정·배정 알림 해석이 projects 직접 조회 대신 project_brief RPC 를 쓴다 (시공팀 회귀 방지)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { called, createFakeSupabase, type Responder } from './testing/fake-supabase';
import { P1, U, X, accessResponder, authOf, chain, type Who } from './testing/access-fixture';

const h = vi.hoisted(() => ({ fake: null as unknown as { client: unknown } }));
vi.mock('@/shared/lib/supabase/server', () => ({
  createServerSupabase: async () => h.fake.client,
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  redirect: (u: string) => {
    throw new Error(`REDIRECT:${u}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

import { findProjectAccess, loadProjectBrief } from './server/access';
import { participantTarget } from './notifications/participant-target';

const brief = (over: Partial<Record<string, unknown>> = {}) => ({
  id: P1,
  company_id: X,
  name: '한남동 리모델링',
  site_address: '서울',
  is_public: false,
  archived_at: null,
  ...over,
});

const FIELD: Who = { parts: [{ project_id: P1, company_id: X, role: 'field' }] };

function setup(who: Who | null, extra: Responder) {
  const fake = createFakeSupabase(
    chain(extra, who ? accessResponder(who) : () => undefined),
    authOf(who),
  );
  h.fake = fake;
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('DB-05 loadProjectBrief / findProjectAccess', () => {
  it('정상: 시공팀은 project_brief 로 판정되어 field 접근을 얻는다 (projects 직접 조회 없음)', async () => {
    const fake = setup(FIELD, (q) =>
      q.table === 'rpc:project_brief' ? { data: [brief()] } : undefined,
    );
    const access = await findProjectAccess(P1, ['field']);
    expect(access).toMatchObject({ projectId: P1, companyId: X, as: 'field' });
    const rpc = fake.of('rpc:project_brief')[0];
    expect(rpc && called(rpc, 'args', { p_project: P1 })).toBe(true);
    expect(fake.of('projects')).toHaveLength(0);
  });

  it('권한 거부: RPC 가 0행(볼 수 없음·없는 프로젝트)이면 null', async () => {
    setup(FIELD, (q) => (q.table === 'rpc:project_brief' ? { data: [] } : undefined));
    expect(await findProjectAccess(P1, ['field'])).toBeNull();
  });

  it('권한 거부: 시공팀이 편집자 접근을 요청하면 null', async () => {
    setup(FIELD, (q) => (q.table === 'rpc:project_brief' ? { data: [brief()] } : undefined));
    expect(await findProjectAccess(P1, ['editor'])).toBeNull();
  });

  it('예외: RPC 오류는 null (접근 거부로 처리), uuid 가 아니면 RPC 를 부르지 않는다', async () => {
    const fake = setup(FIELD, (q) =>
      q.table === 'rpc:project_brief' ? { error: { code: '42501' } } : undefined,
    );
    expect(await loadProjectBrief(P1)).toBeNull();
    expect(await loadProjectBrief('not-a-uuid')).toBeNull();
    expect(fake.of('rpc:project_brief')).toHaveLength(1);
  });
});

describe('DB-05 participantTarget (assignment_changed)', () => {
  const PART = '00000000-0000-4000-8000-0000000000e1';
  const partRow: Responder = (q) =>
    q.table === 'project_participants' && called(q, 'eq', 'id', PART)
      ? { data: { role: 'field', project_id: P1 } }
      : undefined;

  it('정상: 시공팀 배정 알림 → 이름은 project_brief 에서, FW-01 링크', async () => {
    const fake = setup(
      FIELD,
      chain(partRow, (q) => (q.table === 'rpc:project_brief' ? { data: [brief()] } : undefined)),
    );
    const target = await participantTarget(PART, P1, 'field', '');
    expect(target).toMatchObject({ title: '한남동 리모델링', screenId: 'FW-01' });
    expect(fake.of('projects')).toHaveLength(0);
  });

  it('권한 거부: 배정이 회수돼 project_brief 가 0행이면 null', async () => {
    setup(
      FIELD,
      chain(partRow, (q) => (q.table === 'rpc:project_brief' ? { data: [] } : undefined)),
    );
    expect(await participantTarget(PART, P1, 'field', '')).toBeNull();
  });

  it('예외: 참여 행의 프로젝트가 알림의 프로젝트와 다르면 null', async () => {
    setup(FIELD, partRow);
    expect(
      await participantTarget(PART, '00000000-0000-4000-8000-0000000000f2', 'field', ''),
    ).toBeNull();
  });

  it('미로그인이면 null', async () => {
    setup(
      null,
      chain(partRow, (q) => (q.table === 'rpc:project_brief' ? { data: [brief()] } : undefined)),
    );
    expect(await findProjectAccess(P1, ['field'])).toBeNull();
    void U;
  });
});
