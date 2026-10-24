// A-05 프로젝트 목록·스위처 편집 범위를 쿼리에 넣기 / A-11·DB-08 고객 카드 업체 경계·연결·해제
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { called, createFakeSupabase, type Query, type Responder } from './testing/fake-supabase';
import { P1, P2, X, Y, accessResponder, authOf, chain, type Who } from './testing/access-fixture';

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

import { listProjects, listSwitcherProjects } from './server/project-queries';
import { getClient, listClientProjects, listLinkableProjects } from './server/client-queries';
import { linkClientProject, unlinkClientProject } from './server/client-actions';

const OWNER_X: Who = { members: [{ company_id: X, slug: 'x-co', role: 'owner' }] };
const PM1: Who = {
  members: [{ company_id: X, slug: 'x-co', role: 'pm' }],
  parts: [{ project_id: P1, company_id: X, role: 'pm' }],
};
const PM_NONE: Who = { members: [{ company_id: X, slug: 'x-co', role: 'pm' }], parts: [] };
const CLIENT = '00000000-0000-4000-8000-0000000000b1';

function setup(who: Who, extra: Responder = () => undefined) {
  const fake = createFakeSupabase(chain(extra, accessResponder(who)), authOf(who));
  h.client = fake.client;
  return fake;
}

const projectRow = (id: string) => ({
  id,
  name: id,
  site_address: '',
  start_date: null,
  end_date: null,
  status: 'active',
  current_phase: '',
  is_public: true,
  archived_at: null,
  created_at: '2026-10-01T00:00:00Z',
});

const projectsList = (q: Query) =>
  q.table === 'projects' && called(q, 'limit') ? { data: [projectRow(P1)] } : undefined;

beforeEach(() => vi.clearAllMocks());

describe('A-05 listProjects', () => {
  it('정상(pm): 편집 범위를 .in(id) 로 쿼리에 넣는다 — limit 뒤에 거르지 않는다', async () => {
    const fake = setup(PM1, projectsList);
    const res = await listProjects(X, {});
    const q = fake.of('projects')[0]!;
    expect(called(q, 'in', 'id', [P1])).toBe(true);
    expect(called(q, 'limit', PAGE_SIZE + 1)).toBe(true);
    expect(res.items.map((i) => i.id)).toEqual([P1]);
    expect(res.nextCursor).toBeNull();
  });

  it('정상(owner): 업체 전체 — id 조건 없음, 추가 projects 조회 없음', async () => {
    const fake = setup(OWNER_X, projectsList);
    await listProjects(X, {});
    expect(fake.of('projects')).toHaveLength(1);
    expect(fake.of('projects')[0]!.calls.some(([m]) => m === 'in')).toBe(false);
  });

  it('권한 거부: 유효 배정이 없는 pm·비구성원은 조회 없이 빈 결과', async () => {
    let fake = setup(PM_NONE, projectsList);
    expect(await listProjects(X, {})).toEqual({ items: [], nextCursor: null, error: false });
    expect(fake.of('projects')).toHaveLength(0);
    fake = setup(OWNER_X, projectsList);
    expect((await listProjects(Y, {})).items).toEqual([]);
    expect(fake.of('projects')).toHaveLength(0);
  });

  it('예외: 쿼리 오류는 error=true', async () => {
    setup(OWNER_X, (q) => (q.table === 'projects' ? { error: { code: '500' } } : undefined));
    expect(await listProjects(X, {})).toMatchObject({ items: [], error: true });
  });

  it('A-05 스위처도 같은 범위 (pm → .in, 없음 → 빈 배열)', async () => {
    let fake = setup(PM1, (q) =>
      q.table === 'projects' ? { data: [{ id: P1, name: 'P1' }] } : undefined,
    );
    expect(await listSwitcherProjects(X)).toEqual([{ id: P1, name: 'P1' }]);
    expect(called(fake.of('projects')[0]!, 'in', 'id', [P1])).toBe(true);
    fake = setup(PM_NONE);
    expect(await listSwitcherProjects(X)).toEqual([]);
    expect(fake.of('projects')).toHaveLength(0);
  });
});

describe('A-11 고객 카드 업체 경계', () => {
  it('getClient 는 경로 업체로 거른다 (다른 업체 카드 → null → 404)', async () => {
    const fake = setup(OWNER_X, (q) => (q.table === 'clients' ? { data: null } : undefined));
    expect(await getClient(CLIENT, X)).toBeNull();
    expect(called(fake.of('clients')[0]!, 'eq', 'company_id', X)).toBe(true);
  });

  it('listClientProjects: 유효 연결만, pm 은 편집 가능한 프로젝트만', async () => {
    const fake = setup(PM1, (q) =>
      q.table === 'client_projects'
        ? { data: [{ project_id: P1 }, { project_id: P2 }] }
        : q.table === 'projects'
          ? { data: [projectRow(P1)] }
          : undefined,
    );
    const items = await listClientProjects(CLIENT, X);
    expect(items.map((p) => p.id)).toEqual([P1]);
    const links = fake.of('client_projects')[0]!;
    expect(called(links, 'is', 'archived_at', null)).toBe(true);
    expect(called(fake.of('projects')[0]!, 'in', 'id', [P1])).toBe(true);
  });

  it('listClientProjects: 편집 범위가 없으면 조회 없이 빈 배열', async () => {
    const fake = setup(PM_NONE);
    expect(await listClientProjects(CLIENT, X)).toEqual([]);
    expect(fake.of('client_projects')).toHaveLength(0);
  });

  it('listLinkableProjects: 해제된 연결은 다시 연결 가능 (유효 연결만 제외)', async () => {
    const fake = setup(OWNER_X, (q) =>
      q.table === 'projects' && called(q, 'order')
        ? {
            data: [
              { id: P1, name: 'P1' },
              { id: P2, name: 'P2' },
            ],
          }
        : q.table === 'projects'
          ? { data: [{ id: P1 }, { id: P2 }] }
          : q.table === 'client_projects'
            ? { data: [{ project_id: P2 }] }
            : undefined,
    );
    expect(await listLinkableProjects(X)).toEqual([{ id: P1, name: 'P1' }]);
    expect(called(fake.of('client_projects')[0]!, 'is', 'archived_at', null)).toBe(true);
  });
});

describe('A-11 linkClientProject / DB-08 unlinkClientProject', () => {
  const brief = {
    id: P1,
    company_id: X,
    name: 'P1',
    site_address: '',
    is_public: true,
    archived_at: null,
  };
  const base: Responder = (q) => (q.table === 'rpc:project_brief' ? { data: [brief] } : undefined);
  const inserts = (f: ReturnType<typeof createFakeSupabase>) =>
    f.of('client_projects').filter((q) => q.calls.some(([m]) => m === 'insert'));

  it('정상: 같은 업체 카드면 연결', async () => {
    const fake = setup(
      PM1,
      chain(base, (q) =>
        q.table === 'clients' ? { data: { id: CLIENT, archived_at: null } } : undefined,
      ),
    );
    expect(await linkClientProject({ clientId: CLIENT, projectId: P1 })).toEqual({
      ok: true,
      data: null,
    });
    expect(called(fake.of('clients')[0]!, 'eq', 'company_id', X)).toBe(true);
    expect(inserts(fake)).toHaveLength(1);
  });

  it('권한 거부: 다른 업체 카드(조회 0행) → NOT_FOUND, insert 없음', async () => {
    const fake = setup(
      PM1,
      chain(base, (q) => (q.table === 'clients' ? { data: null } : undefined)),
    );
    expect(await linkClientProject({ clientId: CLIENT, projectId: P1 })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(inserts(fake)).toHaveLength(0);
  });

  it('예외: 보관된 카드 → CONFLICT, 편집자가 아닌 프로젝트 → NOT_FOUND', async () => {
    let fake = setup(
      PM1,
      chain(base, (q) =>
        q.table === 'clients'
          ? { data: { id: CLIENT, archived_at: '2026-10-01T00:00:00Z' } }
          : undefined,
      ),
    );
    expect(await linkClientProject({ clientId: CLIENT, projectId: P1 })).toMatchObject({
      error: { code: 'CONFLICT' },
    });
    expect(inserts(fake)).toHaveLength(0);
    fake = setup(PM_NONE, base);
    expect(await linkClientProject({ clientId: CLIENT, projectId: P1 })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(fake.of('clients')).toHaveLength(0);
  });

  it('DB-08 정상: 연결 해제 = 유효 연결의 archived_at 설정 (삭제 없음)', async () => {
    const fake = setup(
      PM1,
      chain(base, (q) => (q.table === 'client_projects' ? { data: { id: 'link1' } } : undefined)),
    );
    expect(await unlinkClientProject({ clientId: CLIENT, projectId: P1 })).toEqual({
      ok: true,
      data: null,
    });
    const q = fake.of('client_projects')[0]!;
    const update = q.calls.find(([m]) => m === 'update')?.[1] as { archived_at?: string };
    expect(typeof update.archived_at).toBe('string');
    expect(called(q, 'is', 'archived_at', null)).toBe(true);
    expect(called(q, 'eq', 'company_id', X)).toBe(true);
    expect(q.calls.some(([m]) => m === 'delete')).toBe(false);
  });

  it('DB-08 권한 거부: 편집자가 아니면 NOT_FOUND, 연결이 없거나 이미 해제면 NOT_FOUND', async () => {
    let fake = setup(PM_NONE, base);
    expect(await unlinkClientProject({ clientId: CLIENT, projectId: P1 })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(fake.of('client_projects')).toHaveLength(0);
    fake = setup(
      PM1,
      chain(base, (q) => (q.table === 'client_projects' ? { data: null } : undefined)),
    );
    expect(await unlinkClientProject({ clientId: CLIENT, projectId: P1 })).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
});
