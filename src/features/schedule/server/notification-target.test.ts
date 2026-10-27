import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake } from '@/features/requests/testing';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));

import { createServerSupabase } from '@/shared/lib/supabase/server';
import { notificationTargetResolver as resolve } from './notification-target';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const eventId = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';

function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('schedule_changed 대상 (F11)', () => {
  it('시공팀: 일정 탭이 켜져 일정이 보이면 FW-04 로', async () => {
    useFake({ 'rpc:field_schedule': [{ data: [{ id: eventId, title: '목공' }] }] });
    expect(await resolve(eventId, projectId, 'field', '')).toEqual({
      title: '목공',
      href: `/field/sites/${projectId}/schedule`,
      screenId: 'FW-04',
    });
  });

  it('시공팀: 탭이 꺼져 있으면(RPC 0행) null', async () => {
    const fake = useFake({ 'rpc:field_schedule': [{ data: [] }] });
    expect(await resolve(eventId, projectId, 'field', '')).toBeNull();
    expect(fake.opsOf('schedule_events')).toEqual([]);
  });

  it('고객: 비공개 일정은 null', async () => {
    useFake({ schedule_events: [{ data: { id: eventId, title: '목공', is_public: false } }] });
    expect(await resolve(eventId, projectId, 'portal', '')).toBeNull();
  });
});
