import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFake, NotFoundSignal } from '@/features/requests/testing';

vi.mock('@/features/core', () => ({
  requireProjectAccess: vi.fn(),
  getAccessContext: vi.fn(),
}));
vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('./related', () => ({ checkRelatedTarget: vi.fn(async () => 'ok') }));
vi.mock('@/shared/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  newRef: () => 'ref1234567',
}));

import { getAccessContext, requireProjectAccess } from '@/features/core';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createScheduleEvent, setScheduleEventArchived, updateScheduleEvent } from './actions';
import { checkRelatedTarget } from './related';

const projectId = '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const eventId = '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f';
const editor = {
  projectId,
  companyId: 'c1',
  companySlug: 'studio',
  as: 'editor' as const,
  canConfirm: false,
};
const fields = {
  title: '타일 시공',
  description: '',
  startDate: '2026-10-07',
  startTime: '09:00',
  endDate: '2026-10-08',
  endTime: '18:00',
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
  vi.mocked(requireProjectAccess).mockResolvedValue(editor);
  vi.mocked(getAccessContext).mockResolvedValue({
    userId: 'pm1',
    displayName: 'PM1',
    locale: 'ko',
    memberships: [],
    participations: [],
    areas: ['app'],
  });
});

describe('createScheduleEvent (REQ-231)', () => {
  it('편집자는 달력 값 그대로 저장하고 캘린더 경로를 갱신한다', async () => {
    const fake = useFake({ schedule_events: [{ error: null }] });
    const res = await createScheduleEvent({ id: eventId, projectId, ...fields });
    expect(res).toEqual({ ok: true, data: { id: eventId } });
    expect(requireProjectAccess).toHaveBeenCalledWith(projectId, ['editor']);
    expect(fake.argOf('schedule_events', 'insert')?.[0]).toMatchObject({
      id: eventId,
      start_date: '2026-10-07',
      start_time: '09:00',
      end_date: '2026-10-08',
      end_time: '18:00',
      is_public: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/app/studio/calendar');
  });

  it('재시도(23505)는 기존 일정을 성공으로', async () => {
    useFake({ schedule_events: [{ error: { code: '23505' } }, { data: { id: eventId } }] });
    expect(await createScheduleEvent({ id: eventId, projectId, ...fields })).toEqual({
      ok: true,
      data: { id: eventId },
    });
  });

  it('종료일 < 시작일은 DB 에 가지 않고 필드 오류', async () => {
    useFake({});
    const res = await createScheduleEvent({
      id: eventId,
      projectId,
      ...fields,
      endDate: '2026-10-01',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fieldErrors?.endDate).toEqual(['field.dateOrder']);
  });

  it('고객은 일정을 만들 수 없다 (notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(createScheduleEvent({ id: eventId, projectId, ...fields })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});

describe('updateScheduleEvent (REQ-231)', () => {
  it('version 잠금으로 수정', async () => {
    const fake = useFake({ schedule_events: [{ data: { version: 3 } }] });
    const res = await updateScheduleEvent({ eventId, projectId, baseVersion: 2, ...fields });
    expect(res).toEqual({ ok: true, data: { version: 3 } });
    const eqs = fake.opsOf('schedule_events').filter((o) => o.op === 'eq');
    expect(eqs).toContainEqual({ op: 'eq', args: ['version', 2] });
  });
  it('0행이면 VERSION_CONFLICT', async () => {
    useFake({ schedule_events: [{ data: null }, { data: { archived_at: null } }] });
    const res = await updateScheduleEvent({ eventId, projectId, baseVersion: 2, ...fields });
    expect(res).toEqual({ ok: false, error: { code: 'VERSION_CONFLICT' } });
  });
  it('보관된 일정은 수정할 수 없다 — 보관 제외 조건 + 재조회로 CONFLICT (C-04)', async () => {
    const fake = useFake({
      schedule_events: [{ data: null }, { data: { archived_at: '2026-10-07T00:00:00Z' } }],
    });
    const res = await updateScheduleEvent({ eventId, projectId, baseVersion: 2, ...fields });
    expect(res).toEqual({ ok: false, error: { code: 'CONFLICT' } });
    expect(fake.opsOf('schedule_events')).toContainEqual({
      op: 'is',
      args: ['archived_at', null],
    });
  });
  it('없거나 볼 수 없는 일정은 NOT_FOUND', async () => {
    useFake({ schedule_events: [{ data: null }, { data: null }] });
    const res = await updateScheduleEvent({ eventId, projectId, baseVersion: 2, ...fields });
    expect(res).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
  });
  it('고객은 일정을 수정할 수 없다 (notFound)', async () => {
    vi.mocked(requireProjectAccess).mockRejectedValue(new NotFoundSignal());
    useFake({});
    await expect(
      updateScheduleEvent({ eventId, projectId, baseVersion: 2, ...fields }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('setScheduleEventArchived (POL-020)', () => {
  it('보관은 archived_at 만 바꾼다', async () => {
    const fake = useFake({ schedule_events: [{ data: { version: 5 } }] });
    await setScheduleEventArchived({ eventId, projectId, baseVersion: 4, archived: true });
    const update = fake.argOf('schedule_events', 'update')?.[0] as Record<string, unknown>;
    expect(Object.keys(update)).toEqual(['archived_at']);
  });
});

describe('관련 항목 (다른 프로젝트 연결 허용, 같은 업체만 — C 결정 2026-10-07)', () => {
  const related = {
    ...fields,
    relatedType: 'designs' as const,
    relatedId: '9c8b7a6d-5e4f-4321-8abc-def012345678',
  };

  it('같은 업체의 볼 수 있는 항목이면 저장한다 (프로젝트는 달라도 된다)', async () => {
    vi.mocked(checkRelatedTarget).mockResolvedValueOnce('ok');
    const fake = useFake({ schedule_events: [{ error: null }] });
    expect(await createScheduleEvent({ id: eventId, projectId, ...related })).toEqual({
      ok: true,
      data: { id: eventId },
    });
    expect(checkRelatedTarget).toHaveBeenCalledWith('designs', related.relatedId, 'c1');
    expect(fake.argOf('schedule_events', 'insert')?.[0]).toMatchObject({
      related_type: 'designs',
      related_id: related.relatedId,
    });
  });

  it('다른 업체 항목은 존재를 드러내지 않고 relatedId 필드 오류 (P-01)', async () => {
    vi.mocked(checkRelatedTarget).mockResolvedValueOnce('other_company');
    useFake({});
    const res = await createScheduleEvent({ id: eventId, projectId, ...related });
    expect(res).toEqual({
      ok: false,
      error: { code: 'VALIDATION_FAILED', fieldErrors: { relatedId: ['field.invalid'] } },
    });
  });

  it('볼 수 없는 항목도 같은 오류 — 수정에서도 검사', async () => {
    vi.mocked(checkRelatedTarget).mockResolvedValueOnce('not_found');
    useFake({});
    const res = await updateScheduleEvent({ eventId, projectId, baseVersion: 1, ...related });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.fieldErrors?.relatedId).toEqual(['field.invalid']);
  });

  it.each(['archived', 'not_editable'] as const)(
    '%s 항목도 같은 relatedId 오류로 숨긴다 (C-05)',
    async (result) => {
      vi.mocked(checkRelatedTarget).mockResolvedValueOnce(result);
      const fake = useFake({});
      const res = await createScheduleEvent({ id: eventId, projectId, ...related });
      expect(res).toEqual({
        ok: false,
        error: { code: 'VALIDATION_FAILED', fieldErrors: { relatedId: ['field.invalid'] } },
      });
      expect(fake.calls).toHaveLength(0);
    },
  );

  it('관련 항목이 없으면 검사하지 않는다', async () => {
    useFake({ schedule_events: [{ error: null }] });
    await createScheduleEvent({ id: eventId, projectId, ...fields });
    expect(checkRelatedTarget).not.toHaveBeenCalled();
  });
});
