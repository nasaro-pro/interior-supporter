// A-07 알림 영역 구분·수신자 명시 / A-14 프로젝트 이름 일괄 조회·해석기 동시성 제한
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { called, callOf, createFakeSupabase, type Responder } from './testing/fake-supabase';
import {
  P1,
  P2,
  U,
  X,
  Y,
  accessResponder,
  authOf,
  chain,
  type Who,
} from './testing/access-fixture';

const h = vi.hoisted(() => ({
  client: null as unknown,
  inflight: 0,
  maxInflight: 0,
  resolve: null as
    null | ((id: string) => Promise<{ title: string; href: string; screenId: string } | null>),
}));
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
vi.mock('./notifications/targets', () => ({
  resolverFor: () => async (objectId: string) => {
    h.inflight += 1;
    h.maxInflight = Math.max(h.maxInflight, h.inflight);
    await new Promise((r) => setTimeout(r, 1));
    h.inflight -= 1;
    return h.resolve ? h.resolve(objectId) : { title: `T-${objectId}`, href: '/x', screenId: 'X' };
  },
}));

import {
  RESOLVE_CONCURRENCY,
  isTypeInArea,
  listNotifications,
  typesForArea,
  unreadCount,
} from './server/notification-queries';
import { markAllNotificationsRead, openNotification } from './server/notification-actions';

const STAFF: Who = {
  members: [
    { company_id: X, slug: 'x-co', role: 'owner' },
    { company_id: Y, slug: 'y-co', role: 'pm' },
  ],
  parts: [{ project_id: P1, company_id: X, role: 'customer' }],
};

const notif = (i: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  type: 'item_confirmed',
  object_type: 'designs',
  object_id: `obj-${i}`,
  project_id: i % 2 ? P1 : P2,
  company_id: X,
  created_at: '2026-10-10T00:00:00Z',
  read_at: null,
  ...over,
});

function setup(who: Who, extra: Responder = () => undefined) {
  const fake = createFakeSupabase(chain(extra, accessResponder(who)), authOf(who));
  h.client = fake.client;
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.inflight = 0;
  h.maxInflight = 0;
  h.resolve = null;
});

describe('A-07 영역별 알림 종류', () => {
  it('PM 영역은 고객용 알림을, 고객 영역은 PM 용 알림을 포함하지 않는다', () => {
    expect(isTypeInArea('item_confirmed', 'app')).toBe(true);
    expect(isTypeInArea('item_published', 'app')).toBe(false);
    expect(isTypeInArea('item_published', 'portal')).toBe(true);
    expect(isTypeInArea('request_created', 'portal')).toBe(false);
    // CR-11(F11): 시공팀은 일정 탭이 켜진 현장의 일정 변경도 받는다
    expect(typesForArea('field')).toEqual(['assignment_changed', 'schedule_changed']);
    expect(isTypeInArea('item_published', 'field')).toBe(false);
    for (const a of ['app', 'portal', 'field'] as const)
      expect(isTypeInArea('assignment_changed', a)).toBe(true);
    expect(isTypeInArea('item_confirmed', 'bogus' as 'app')).toBe(false);
  });
});

describe('A-07 unreadCount(area)', () => {
  it('정상: 수신자·영역 종류·업체(PM)로 센다', async () => {
    const fake = setup(STAFF, (q) => (q.table === 'notifications' ? { count: 3 } : undefined));
    expect(await unreadCount('app', X)).toBe(3);
    const q = fake.of('notifications')[0]!;
    expect(called(q, 'eq', 'recipient_id', U)).toBe(true);
    expect(called(q, 'in', 'type', typesForArea('app'))).toBe(true);
    expect(called(q, 'eq', 'company_id', X)).toBe(true);
    expect(called(q, 'is', 'read_at', null)).toBe(true);
  });

  it('고객 영역은 업체 조건 없이 고객 종류만', async () => {
    const fake = setup(STAFF, (q) => (q.table === 'notifications' ? { count: 1 } : undefined));
    expect(await unreadCount('portal')).toBe(1);
    const q = fake.of('notifications')[0]!;
    expect(called(q, 'in', 'type', typesForArea('portal'))).toBe(true);
    expect(q.calls.some(([m, c]) => m === 'eq' && c === 'company_id')).toBe(false);
  });

  it('예외: 미로그인 0, 쿼리 오류 0', async () => {
    h.client = createFakeSupabase(() => undefined, authOf(null)).client;
    expect(await unreadCount('field')).toBe(0);
    setup(STAFF, (q) => (q.table === 'notifications' ? { error: { code: '500' } } : undefined));
    expect(await unreadCount('field')).toBe(0);
  });
});

describe('A-07/A-14 listNotifications', () => {
  it('정상: 수신자·종류·업체 조건 + 프로젝트 이름을 한 번에 조회해 채운다', async () => {
    const rows = Array.from({ length: 6 }, (_, i) => notif(i + 1));
    const fake = setup(STAFF, (q) =>
      q.table === 'notifications'
        ? { data: rows }
        : q.table === 'projects'
          ? {
              data: [
                { id: P1, name: '프로젝트1' },
                { id: P2, name: '프로젝트2' },
              ],
            }
          : undefined,
    );
    const res = await listNotifications('app', undefined, 'x-co');
    const q = fake.of('notifications')[0]!;
    expect(called(q, 'eq', 'recipient_id', U)).toBe(true);
    expect(called(q, 'in', 'type', typesForArea('app'))).toBe(true);
    expect(called(q, 'eq', 'company_id', X)).toBe(true);
    expect(fake.of('projects')).toHaveLength(1); // 일괄 1회
    expect((callOf(fake.of('projects')[0]!, 'in')?.[2] as string[]).sort()).toEqual(
      [P1, P2].sort(),
    );
    expect(res.items[0]).toMatchObject({ projectName: '프로젝트1', targetTitle: 'T-obj-1' });
    expect(h.maxInflight).toBeLessThanOrEqual(RESOLVE_CONCURRENCY);
  });

  it('권한 거부: 볼 수 없게 된 대상은 제목·프로젝트 이름 모두 null', async () => {
    h.resolve = async () => null;
    setup(STAFF, (q) =>
      q.table === 'notifications'
        ? { data: [notif(1)] }
        : q.table === 'projects'
          ? { data: [{ id: P1, name: '프로젝트1' }] }
          : undefined,
    );
    const res = await listNotifications('app', undefined, 'x-co');
    expect(res.items[0]).toMatchObject({ projectName: null, targetTitle: null });
  });

  it('권한 거부: 구성원이 아닌 업체 경로는 조회 없이 빈 목록', async () => {
    const fake = setup(STAFF);
    expect(await listNotifications('app', undefined, 'z-co')).toEqual({
      items: [],
      nextCursor: null,
      error: false,
    });
    expect(fake.of('notifications')).toHaveLength(0);
  });

  it('시공팀 영역: 프로젝트 이름은 field_projects() 로 (projects 직접 조회 없음)', async () => {
    const field: Who = { parts: [{ project_id: P1, company_id: X, role: 'field' }] };
    const fake = setup(field, (q) =>
      q.table === 'notifications'
        ? { data: [notif(1, { type: 'assignment_changed', object_type: 'project_participants' })] }
        : q.table === 'rpc:field_projects'
          ? { data: [{ id: P1, company_id: X, name: '현장1', site_address: '' }] }
          : undefined,
    );
    const res = await listNotifications('field');
    expect(
      called(fake.of('notifications')[0]!, 'in', 'type', [
        'assignment_changed',
        'schedule_changed',
      ]),
    ).toBe(true);
    expect(fake.of('projects')).toHaveLength(0);
    expect(res.items[0]?.projectName).toBe('현장1');
  });

  it('예외: 조회 오류는 error=true', async () => {
    setup(STAFF, (q) => (q.table === 'notifications' ? { error: { code: '500' } } : undefined));
    expect(await listNotifications('portal')).toMatchObject({ items: [], error: true });
  });
});

describe('A-07 알림 액션', () => {
  it('openNotification: 다른 영역 종류의 알림은 대상으로 이동하지 않고 목록으로', async () => {
    const fake = setup(STAFF, (q) =>
      q.table === 'notifications' && called(q, 'maybeSingle')
        ? { data: notif(1, { type: 'item_published', read_at: '2026-10-10T00:00:00Z' }) }
        : undefined,
    );
    await expect(openNotification('app', 'x-co', notif(1).id)).rejects.toThrow(
      'REDIRECT:/app/x-co/notifications',
    );
    expect(called(fake.of('notifications')[0]!, 'eq', 'recipient_id', U)).toBe(true);
  });

  it('markAllNotificationsRead: 그 영역(+업체)만, 모르는 영역·업체는 거부', async () => {
    const fake = setup(STAFF, (q) => (q.table === 'notifications' ? { data: null } : undefined));
    expect(await markAllNotificationsRead('app', 'x-co')).toEqual({ ok: true, data: null });
    const q = fake.of('notifications')[0]!;
    expect(called(q, 'in', 'type', typesForArea('app'))).toBe(true);
    expect(called(q, 'eq', 'company_id', X)).toBe(true);
    expect(await markAllNotificationsRead('app', 'z-co')).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
    expect(await markAllNotificationsRead('bogus' as 'app')).toMatchObject({
      error: { code: 'VALIDATION_FAILED' },
    });
  });
});
