import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/requests/testing';
import type { AccessContext } from '@/shared/contracts/integration';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { listEditableProjects, listEventsInRange } from './queries';

const ctx = (role: 'owner' | 'manager' | 'pm'): AccessContext => ({
  userId: 'u',
  displayName: 'u',
  locale: 'ko',
  memberships: [{ companyId: 'c1', slug: 'studio', name: '스튜디오', role }],
  participations: [
    { projectId: 'p1', companyId: 'c1', role: 'pm', canConfirm: false },
    { projectId: 'q1', companyId: 'c2', role: 'pm', canConfirm: false },
  ],
  areas: ['app'],
});

beforeEach(() => vi.clearAllMocks());

describe('listEditableProjects (REQ-233)', () => {
  it('manager 는 업체의 보관 안 된 프로젝트 전체', async () => {
    const fake = createSupabaseFake({
      projects: [
        {
          data: [
            { id: 'p1', name: 'A' },
            { id: 'p2', name: 'B' },
          ],
        },
      ],
    });
    vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
    expect(await listEditableProjects(ctx('manager'), 'c1')).toHaveLength(2);
    expect(fake.opsOf('projects').some((o) => o.op === 'in')).toBe(false);
  });
  it('pm 은 이 업체의 유효 pm 참여 프로젝트만', async () => {
    const fake = createSupabaseFake({ projects: [{ data: [{ id: 'p1', name: 'A' }] }] });
    vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
    await listEditableProjects(ctx('pm'), 'c1');
    expect(fake.argOf('projects', 'in')).toEqual(['id', ['p1']]);
  });
  it('구성원이 아닌 업체는 빈 목록', async () => {
    expect(await listEditableProjects(ctx('owner'), 'c9')).toEqual([]);
  });
});

describe('listEventsInRange', () => {
  it('기간과 겹치는 일정 (종료일 포함) 조건과 고객 공개 조건', async () => {
    const fake = createSupabaseFake({ schedule_events: [{ data: [] }] });
    vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
    await listEventsInRange(['p1'], '2026-09-27', '2026-10-31', {
      archived: false,
      publicOnly: true,
    });
    const ops = fake.opsOf('schedule_events');
    expect(ops).toContainEqual({ op: 'lte', args: ['start_date', '2026-10-31'] });
    expect(ops).toContainEqual({
      op: 'or',
      args: ['end_date.gte.2026-09-27,and(end_date.is.null,start_date.gte.2026-09-27)'],
    });
    expect(ops).toContainEqual({ op: 'eq', args: ['is_public', true] });
    expect(ops).toContainEqual({ op: 'is', args: ['archived_at', null] });
  });
  it('프로젝트가 없으면 조회하지 않는다', async () => {
    expect(
      await listEventsInRange([], '2026-10-01', '2026-10-31', {
        archived: false,
        publicOnly: false,
      }),
    ).toEqual([]);
  });
});
