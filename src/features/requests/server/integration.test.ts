// TASK-209 연동 계약 테스트 — SummaryProvider · NextScheduleProvider · NotificationTargetResolver (integration.ts 3·4장)
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/requests/testing';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/features/core', () => ({ getAccessContext: vi.fn() }));
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'ko'),
  getTranslations: vi.fn(async () => (key: string) => (key === 'field.allDay' ? '종일' : key)),
}));

import { getAccessContext } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
// A 의 등록부와 같은 방식으로 가져온다: 이름은 계약 타입의 camelCase, default 도 같은 값
import requestsTarget, {
  notificationTargetResolver as resolveRequestsTarget,
} from './notification-target';
import { summaryProvider as requestsSummary } from './summary';
import photosTarget, {
  notificationTargetResolver as resolvePhotosTarget,
} from '@/features/photos/server/notification-target';
import { summaryProvider as photosSummary } from '@/features/photos/server/summary';
import scheduleTarget, {
  notificationTargetResolver as resolveScheduleEventsTarget,
} from '@/features/schedule/server/notification-target';
import { nextScheduleProvider as scheduleNext } from '@/features/schedule/server/summary';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const viewer = (as: 'editor' | 'customer' | 'field') => ({
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as,
  canConfirm: false,
});

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAccessContext).mockResolvedValue({
    userId: 'u1',
    displayName: '고객1',
    locale: 'ko',
    memberships: [],
    participations: [],
    areas: ['portal'],
  });
});

describe('requestsSummary.recent', () => {
  it('고객 호출은 본인 요청만, CL-16 링크', async () => {
    const fake = useFake({
      requests: [
        {
          data: [
            { id: 'r1', title: '타일 색', status: 'open', updated_at: '2026-10-07T01:00:00Z' },
          ],
        },
      ],
    });
    const items = await requestsSummary.recent(projectId, viewer('customer'));
    expect(items).toEqual([
      {
        kind: 'requests',
        id: 'r1',
        title: '타일 색',
        at: '2026-10-07T01:00:00Z',
        subtitleKey: 'requests.summary.status',
        subtitleValues: { status: 'open' },
        screenId: 'CL-16',
        href: `/portal/projects/${projectId}/requests/r1`,
      },
    ]);
    expect(fake.opsOf('requests')).toContainEqual({ op: 'eq', args: ['author_id', 'u1'] });
    expect(fake.opsOf('requests')).toContainEqual({ op: 'limit', args: [5] });
  });
  it('편집자는 PM-16, 시공팀은 빈 배열', async () => {
    useFake({
      requests: [{ data: [{ id: 'r1', title: 't', status: 'resolved', updated_at: 'x' }] }],
    });
    const [item] = await requestsSummary.recent(projectId, viewer('editor'), 3);
    expect(item?.screenId).toBe('PM-16');
    expect(item?.href).toBe(`/app/studio/projects/${projectId}/requests/r1`);
    expect(await requestsSummary.recent(projectId, viewer('field'))).toEqual([]);
  });
});

describe('photosSummary.recent', () => {
  it('고객은 공개 사진만, 썸네일 id 를 넘긴다', async () => {
    const fake = useFake({
      photos: [
        {
          data: [
            {
              id: 'ph1',
              description: '',
              captured_on: '2026-10-05',
              phase: 'tile',
              file_id: 'f1',
              thumb_file_id: 't1',
              created_at: '2026-10-07T02:00:00Z',
            },
          ],
        },
      ],
    });
    const [item] = await photosSummary.recent(projectId, viewer('customer'));
    expect(item).toMatchObject({
      kind: 'photos',
      title: '2026-10-05',
      subtitleKey: 'photos.summary.phase',
      subtitleValues: { phase: 'tile' },
      screenId: 'CL-17',
      thumbnailFileId: 't1',
    });
    expect(fake.opsOf('photos')).toContainEqual({ op: 'eq', args: ['is_public', true] });
  });
});

describe('scheduleNext.next', () => {
  it('오늘(KST) 이후 일정, at 은 KST 오프셋 ISO, 고객은 공개분', async () => {
    const fake = useFake({
      schedule_events: [
        {
          data: [
            {
              id: 'e1',
              title: '타일 시공',
              start_date: '2026-10-09',
              start_time: '09:00:00',
              end_date: null,
              end_time: null,
            },
          ],
        },
      ],
    });
    const [item] = await scheduleNext.next(projectId, viewer('customer'));
    expect(item).toMatchObject({
      kind: 'schedule_events',
      id: 'e1',
      at: '2026-10-09T09:00:00+09:00',
      subtitleKey: 'schedule.summary.when',
      subtitleValues: { date: '2026. 10. 9.(금) 09:00' },
      screenId: 'CL-18',
      href: `/portal/projects/${projectId}/schedule/e1`,
    });
    expect(fake.opsOf('schedule_events')).toContainEqual({ op: 'eq', args: ['is_public', true] });
    expect(fake.opsOf('schedule_events')).toContainEqual({ op: 'limit', args: [3] });
  });
});

describe('export 규약 (A 등록부 features/core/notifications/targets.ts 용)', () => {
  it('default export 와 named export 가 같은 해석기', () => {
    expect(requestsTarget).toBe(resolveRequestsTarget);
    expect(photosTarget).toBe(resolvePhotosTarget);
    expect(scheduleTarget).toBe(resolveScheduleEventsTarget);
  });
});

describe('notification target resolvers (A-T07)', () => {
  it('요청: 볼 수 없으면 null, 영역별 정규 상세', async () => {
    useFake({ requests: [{ data: null }] });
    expect(await resolveRequestsTarget('r1', projectId, 'portal', 'studio')).toBeNull();
    const fake = useFake({
      requests: [
        { data: { id: 'r1', title: '타일', author_id: 'other' } },
        { data: { id: 'r1', title: '타일', author_id: 'u1' } },
      ],
    });
    expect(await resolveRequestsTarget('r1', projectId, 'app', 'studio')).toEqual({
      title: '타일',
      href: `/app/studio/projects/${projectId}/requests/r1`,
      screenId: 'PM-16',
    });
    expect(await resolveRequestsTarget('r1', projectId, 'portal', 'studio')).toEqual({
      title: '타일',
      href: `/portal/projects/${projectId}/requests/r1`,
      screenId: 'CL-16',
    });
    // 편집자(app)는 작성자 조건 없음, 고객(portal)은 본인 작성분만 (C-01 이중 검증)
    expect(fake.opsOf('requests', 0).some((o) => o.args[0] === 'author_id')).toBe(false);
    expect(fake.opsOf('requests', 1)).toContainEqual({ op: 'eq', args: ['author_id', 'u1'] });
  });
  it('요청: 고객 영역에서 남이 쓴 요청이면 null (RLS 가 놓쳐도 앱이 거른다, C-01)', async () => {
    useFake({ requests: [{ data: { id: 'r1', title: '타일', author_id: 'u2' } }] });
    expect(await resolveRequestsTarget('r1', projectId, 'portal', 'studio')).toBeNull();
  });
  it('요청: 시공팀 영역은 null (조회하지 않음)', async () => {
    useFake({});
    expect(await resolveRequestsTarget('r1', projectId, 'field', 'studio')).toBeNull();
  });
  it('사진: 시공팀은 FW-02', async () => {
    useFake({
      photos: [{ data: { id: 'ph1', description: '벽', captured_on: null, is_public: false } }],
    });
    expect(await resolvePhotosTarget('ph1', projectId, 'field', 'studio')).toEqual({
      title: '벽',
      href: `/field/photos/ph1?project=${projectId}`,
      screenId: 'FW-02',
    });
  });
  it('사진: 보관된 사진은 고객·시공팀에게 null, 편집자는 PM-17 (C-03)', async () => {
    const archived = {
      id: 'ph1',
      description: '벽',
      captured_on: null,
      is_public: true,
      archived_at: '2026-10-07T00:00:00Z',
    };
    const fake = useFake({ photos: [{ data: archived }, { data: archived }, { data: archived }] });
    expect(await resolvePhotosTarget('ph1', projectId, 'portal', 'studio')).toBeNull();
    expect(await resolvePhotosTarget('ph1', projectId, 'field', 'studio')).toBeNull();
    expect(await resolvePhotosTarget('ph1', projectId, 'app', 'studio')).toMatchObject({
      screenId: 'PM-17',
    });
    expect(fake.opsOf('photos', 0)).toContainEqual({ op: 'is', args: ['archived_at', null] });
    expect(fake.opsOf('photos', 0)).toContainEqual({ op: 'eq', args: ['is_public', true] });
    expect(fake.opsOf('photos', 1)).toContainEqual({ op: 'is', args: ['archived_at', null] });
    expect(fake.opsOf('photos', 2).some((o) => o.op === 'is')).toBe(false);
  });
  it('사진: 고객은 비공개 사진이면 null', async () => {
    useFake({
      photos: [{ data: { id: 'ph1', description: '', captured_on: null, is_public: false } }],
    });
    expect(await resolvePhotosTarget('ph1', projectId, 'portal', 'studio')).toBeNull();
  });
  it('일정: app → PM-18, field → null', async () => {
    useFake({ schedule_events: [{ data: { id: 'e1', title: '철거', is_public: false } }] });
    expect(await resolveScheduleEventsTarget('e1', projectId, 'app', 'studio')).toEqual({
      title: '철거',
      href: `/app/studio/projects/${projectId}/schedule/e1`,
      screenId: 'PM-18',
    });
    expect(await resolveScheduleEventsTarget('e1', projectId, 'field', 'studio')).toBeNull();
  });
});
