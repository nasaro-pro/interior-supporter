// D-30 일정 진행 상태 — 저장 · 검증 · 표시
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createSupabaseFake, NotFoundSignal } from '@/features/requests/testing';

vi.mock('next-intl', () => ({
  useTranslations: () => Object.assign((key: string) => key, { rich: (key: string) => key }),
  useLocale: () => 'ko',
}));
vi.mock('@/features/core', () => ({ requireProjectAccess: vi.fn(), getAccessContext: vi.fn() }));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('./server/related', () => ({ checkRelatedTarget: vi.fn(async () => 'ok') }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { getAccessContext, requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { createScheduleEvent, updateScheduleEvent } from './server/actions';
import { ScheduleEventChip } from './components/ScheduleEventChip';
import type { ScheduleEvent } from './types';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const eventId = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const fields = {
  title: '타일 시공',
  description: '',
  startDate: '2026-10-07',
  startTime: null,
  endDate: null,
  endTime: null,
  isPublic: true,
  relatedType: null,
  relatedId: null,
};
function useFake(script: Parameters<typeof createSupabaseFake>[0]) {
  const fake = createSupabaseFake(script);
  vi.mocked(createServerSupabase).mockResolvedValue(fake.client as never);
  return fake;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireProjectAccess).mockResolvedValue({
    projectId,
    companyId: 'c1',
    companySlug: 'studio',
    as: 'editor',
    canConfirm: false,
  });
  vi.mocked(getAccessContext).mockResolvedValue({
    userId: 'pm1',
    displayName: 'PM1',
    locale: 'ko',
    memberships: [],
    participations: [],
    areas: ['app'],
  });
});

describe('D-30 진행 상태 저장', () => {
  it('만들 때 고른 상태를 저장한다', async () => {
    const fake = useFake({ schedule_events: [{ error: null }] });
    await createScheduleEvent({ id: eventId, projectId, ...fields, progress: 'in_progress' });
    expect(fake.argOf('schedule_events', 'insert')?.[0]).toMatchObject({ progress: 'in_progress' });
  });

  it('상태를 보내지 않으면 저장 값에 넣지 않는다 (DB 기본값 · 기존 값 유지)', async () => {
    const fake = useFake({ schedule_events: [{ error: null }] });
    await createScheduleEvent({ id: eventId, projectId, ...fields });
    expect(fake.argOf('schedule_events', 'insert')?.[0]).not.toHaveProperty('progress');
  });

  it('수정에서 완료로 바꾼다', async () => {
    const fake = useFake({ schedule_events: [{ data: { id: eventId } }] });
    await updateScheduleEvent({ eventId, projectId, baseVersion: 2, ...fields, progress: 'done' });
    expect(fake.argOf('schedule_events', 'update')?.[0]).toMatchObject({ progress: 'done' });
  });

  it('없는 상태 값은 입력 오류 (DB 에 가지 않음)', async () => {
    const fake = useFake({});
    const res = await createScheduleEvent({ id: eventId, projectId, ...fields, progress: 'late' });
    expect(res).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    expect(fake.opsOf('schedule_events')).toHaveLength(0);
  });

  it('권한 거부: 고객은 상태를 바꿀 수 없다 (notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(
      updateScheduleEvent({ eventId, projectId, baseVersion: 2, ...fields, progress: 'done' }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('D-30 일정 칩 표시', () => {
  const event = (progress: ScheduleEvent['progress']): ScheduleEvent => ({
    id: eventId,
    projectId,
    ...fields,
    progress,
    archived: false,
    version: 1,
    createdAt: '2026-10-01T00:00:00Z',
  });

  it('상태마다 아이콘 이름(문구)과 표시 값을 단다 — 색만으로 구분하지 않음', () => {
    for (const p of ['planned', 'in_progress', 'done'] as const) {
      const { container } = render(<ScheduleEventChip event={event(p)} href="#" />);
      expect(screen.getByRole('img', { name: `progress.${p}` })).toBeTruthy();
      expect(container.querySelector('a')?.getAttribute('data-progress')).toBe(p);
      cleanup();
    }
  });
});
