// A-09: 정규 주소명 — `/app/X-Co/...` 처럼 대소문자가 달라도 같은 업체, 경로·숨은 필드는 DB 의 slug 로.
//       createProject 23505(같은 id 재시도)는 그 행이 내 업체 것일 때만 성공으로 본다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { called, createFakeSupabase, type Responder } from './testing/fake-supabase';
import { X, Y, accessResponder, authOf, chain, type Who } from './testing/access-fixture';

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

import { findMembershipBySlug, normalizeSlug, requireCompanyStaff } from './server/access';
import { createProject } from './server/project-actions';
import { createClient } from './server/client-actions';

const NEW_ID = '00000000-0000-4000-8000-0000000000e1';
const OWNER_X: Who = { members: [{ company_id: X, slug: 'x-co', role: 'owner' }] };
const PM_X: Who = { members: [{ company_id: X, slug: 'x-co', role: 'pm' }] };
const OWNER_Y: Who = { members: [{ company_id: Y, slug: 'y-co', role: 'owner' }] };

function setup(who: Who | null, extra: Responder = () => undefined) {
  const fake = createFakeSupabase(
    chain(extra, who ? accessResponder(who) : () => undefined),
    authOf(who),
  );
  h.client = fake.client;
  return fake;
}

async function run<T>(p: Promise<T>) {
  try {
    return await p;
  } catch (e) {
    return { thrown: (e as Error).message };
  }
}

const projectForm = (slug: string) => {
  const f = new FormData();
  f.set('companySlug', slug);
  f.set('id', NEW_ID);
  f.set('name', '새 프로젝트');
  f.set('siteAddress', '');
  f.set('startDate', '');
  f.set('endDate', '');
  f.set('status', 'planned');
  return f;
};

const inserts = (fake: ReturnType<typeof createFakeSupabase>, table: string) =>
  fake.of(table).filter((q) => q.calls.some(([m]) => m === 'insert'));

beforeEach(() => vi.clearAllMocks());

describe('A-09 normalizeSlug / findMembershipBySlug', () => {
  const ms = [{ slug: 'x-co', companyId: X }];
  it('정상: 대소문자·퍼센트 인코딩이 달라도 같은 소속을 찾고, DB slug 를 돌려준다', () => {
    expect(findMembershipBySlug(ms, 'X-Co')?.slug).toBe('x-co');
    expect(findMembershipBySlug(ms, '%58-co')?.slug).toBe('x-co');
  });
  it('예외: 비어 있거나 잘못된 인코딩·다른 업체 → 없음', () => {
    expect(normalizeSlug('%E0%A4%A')).toBeNull();
    expect(findMembershipBySlug(ms, undefined)).toBeUndefined();
    expect(findMembershipBySlug(ms, '%E0%A4%A')).toBeUndefined();
    expect(findMembershipBySlug(ms, 'y-co')).toBeUndefined();
  });
});

describe('A-09 requireCompanyStaff', () => {
  it('정상: 대문자 경로 → 정규 slug 반환', async () => {
    setup(OWNER_X);
    expect(await requireCompanyStaff('X-CO')).toEqual({
      companyId: X,
      role: 'owner',
      slug: 'x-co',
    });
  });
  it('권한 거부: 다른 업체 경로 → notFound', async () => {
    setup(OWNER_Y);
    expect(await run(requireCompanyStaff('x-co'))).toEqual({ thrown: 'NOT_FOUND' });
  });
});

describe('A-09 createProject', () => {
  it('정상: `/app/X-Co` 에서 만든 폼(대문자 slug)도 생성되고 정규 경로로 이동', async () => {
    // D-36 · CR-9: 담당자(PM)는 업체관리자가 준 생성 권한이 있을 때만 — RLS insert 정책과 같음
    const fake = setup(PM_X, (q) =>
      q.table === 'company_members' && called(q, 'select', 'can_create_projects')
        ? { data: { can_create_projects: true } }
        : undefined,
    );
    const res = await run(createProject(null, projectForm('X-Co')));
    expect(res).toEqual({ thrown: expect.stringContaining(`/app/x-co/projects/${NEW_ID}`) });
    const ins = inserts(fake, 'projects');
    expect(ins).toHaveLength(1);
    expect(JSON.stringify(ins[0]!.calls)).toContain(X);
  });

  it('권한 거부(D-36): 생성 권한 없는 담당자 → FORBIDDEN, insert 없음', async () => {
    const fake = setup(PM_X, (q) =>
      q.table === 'company_members' && called(q, 'select', 'can_create_projects')
        ? { data: { can_create_projects: false } }
        : undefined,
    );
    expect(await run(createProject(null, projectForm('x-co')))).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(inserts(fake, 'projects')).toHaveLength(0);
  });

  it('정상: 같은 id 재시도(23505)이고 행이 내 업체 것 → 성공(이동)', async () => {
    const fake = setup(OWNER_X, (q) => {
      if (q.table !== 'projects') return undefined;
      if (q.calls.some(([m]) => m === 'insert')) return { error: { code: '23505' } };
      return { data: { id: NEW_ID } };
    });
    const res = await run(createProject(null, projectForm('x-co')));
    expect(res).toEqual({ thrown: expect.stringContaining(`/app/x-co/projects/${NEW_ID}`) });
    const recheck = fake.of('projects').find((q) => called(q, 'select', 'id'))!;
    expect(called(recheck, 'eq', 'id', NEW_ID)).toBe(true);
    expect(called(recheck, 'eq', 'company_id', X)).toBe(true);
  });

  it('예외: 23505 인데 내 업체 행이 아님(다른 업체 id 충돌) → CONFLICT, 이동 없음', async () => {
    setup(OWNER_X, (q) => {
      if (q.table !== 'projects') return undefined;
      if (q.calls.some(([m]) => m === 'insert')) return { error: { code: '23505' } };
      return { data: null };
    });
    expect(await run(createProject(null, projectForm('x-co')))).toEqual({
      ok: false,
      error: { code: 'CONFLICT' },
    });
  });

  it('예외: 재확인 조회 실패 → INTERNAL(ref)', async () => {
    setup(OWNER_X, (q) => {
      if (q.table !== 'projects') return undefined;
      if (q.calls.some(([m]) => m === 'insert')) return { error: { code: '23505' } };
      return { error: { code: 'XX000', message: 'boom' } };
    });
    expect(await run(createProject(null, projectForm('x-co')))).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL' },
    });
  });

  it('권한 거부: 소속 아닌 업체 slug → NOT_FOUND, insert 없음', async () => {
    const fake = setup(OWNER_Y);
    expect(await run(createProject(null, projectForm('X-Co')))).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(inserts(fake, 'projects')).toHaveLength(0);
  });

  it('권한: 미로그인 → UNAUTHENTICATED', async () => {
    setup(null);
    expect(await run(createProject(null, projectForm('x-co')))).toEqual({
      ok: false,
      error: { code: 'UNAUTHENTICATED' },
    });
  });
});

describe('A-09 client-actions staffOf (createClient)', () => {
  const clientForm = (slug: string) => {
    const f = new FormData();
    f.set('companySlug', slug);
    f.set('id', NEW_ID);
    f.set('name', '고객');
    f.set('phone', '');
    f.set('email', '');
    f.set('memo', '');
    return f;
  };

  it('정상: 대문자 slug 로도 등록 → 정규 경로로 이동', async () => {
    const fake = setup(OWNER_X);
    expect(await run(createClient(null, clientForm('X-CO')))).toEqual({
      thrown: expect.stringContaining(`/app/x-co/clients/${NEW_ID}`),
    });
    expect(inserts(fake, 'clients')).toHaveLength(1);
  });

  it('권한 거부: 다른 업체 slug → NOT_FOUND, insert 없음', async () => {
    const fake = setup(OWNER_Y);
    expect(await run(createClient(null, clientForm('x-co')))).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND' },
    });
    expect(inserts(fake, 'clients')).toHaveLength(0);
  });

  it('정상: 같은 id 재시도(23505)이고 행이 내 업체 것 → 성공(이동)', async () => {
    const fake = setup(OWNER_X, (q) => {
      if (q.table !== 'clients') return undefined;
      if (q.calls.some(([m]) => m === 'insert')) return { error: { code: '23505' } };
      return { data: { id: NEW_ID } };
    });
    expect(await run(createClient(null, clientForm('x-co')))).toEqual({
      thrown: expect.stringContaining(`/app/x-co/clients/${NEW_ID}`),
    });
    const recheck = fake.of('clients').find((q) => called(q, 'select', 'id'))!;
    expect(called(recheck, 'eq', 'id', NEW_ID)).toBe(true);
    expect(called(recheck, 'eq', 'company_id', X)).toBe(true);
  });

  it('예외: 23505 인데 내 업체 행이 아님 → CONFLICT, 이동 없음', async () => {
    setup(OWNER_X, (q) => {
      if (q.table !== 'clients') return undefined;
      if (q.calls.some(([m]) => m === 'insert')) return { error: { code: '23505' } };
      return { data: null };
    });
    expect(await run(createClient(null, clientForm('x-co')))).toEqual({
      ok: false,
      error: { code: 'CONFLICT' },
    });
  });

  it('예외: 23505 재확인 조회 실패 → INTERNAL(ref)', async () => {
    setup(OWNER_X, (q) => {
      if (q.table !== 'clients') return undefined;
      if (q.calls.some(([m]) => m === 'insert')) return { error: { code: '23505' } };
      return { error: { code: 'XX000', message: 'boom' } };
    });
    expect(await run(createClient(null, clientForm('x-co')))).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL' },
    });
  });
});
