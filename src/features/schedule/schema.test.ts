import { describe, expect, it } from 'vitest';
import { scheduleCreateSchema, scheduleUpdateSchema } from './schema';

const base = {
  id: '3f1c2a4e-8b7d-4c1a-9e2f-0a1b2c3d4e5f',
  projectId: '7a9b8c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  title: '타일 시공',
  description: '',
  startDate: '2026-10-07',
  startTime: null,
  endDate: null,
  endTime: null,
  isPublic: false,
  relatedType: null,
  relatedId: null,
};
const issue = (r: ReturnType<typeof scheduleCreateSchema.safeParse>, path: string) =>
  r.error?.issues.find((i) => i.path.join('.') === path)?.message;

describe('scheduleCreateSchema (REQ-231, POL-023)', () => {
  it('시각 없는 하루 일정은 종일로 통과', () => {
    expect(scheduleCreateSchema.safeParse(base).success).toBe(true);
  });
  it('종료일 < 시작일 은 field.dateOrder', () => {
    const r = scheduleCreateSchema.safeParse({ ...base, endDate: '2026-10-06' });
    expect(issue(r, 'endDate')).toBe('field.dateOrder');
  });
  it('시작 시각 없이 종료 시각만 있으면 field.endTimeNeedsStart', () => {
    const r = scheduleCreateSchema.safeParse({ ...base, endTime: '10:00' });
    expect(issue(r, 'endTime')).toBe('field.endTimeNeedsStart');
  });
  it('같은 날 종료 시각 < 시작 시각은 field.timeOrder, 다른 날이면 허용', () => {
    const same = scheduleCreateSchema.safeParse({ ...base, startTime: '15:00', endTime: '09:00' });
    expect(issue(same, 'endTime')).toBe('field.timeOrder');
    const next = scheduleCreateSchema.safeParse({
      ...base,
      startTime: '15:00',
      endDate: '2026-10-08',
      endTime: '09:00',
    });
    expect(next.success).toBe(true);
  });
  it('관련 항목은 종류·id 를 함께', () => {
    const r = scheduleCreateSchema.safeParse({ ...base, relatedType: 'designs' });
    expect(issue(r, 'relatedId')).toBe('field.invalid');
  });
  it('없는 날짜·잘못된 시각은 거절', () => {
    expect(scheduleCreateSchema.safeParse({ ...base, startDate: '2026-02-30' }).success).toBe(
      false,
    );
    expect(scheduleCreateSchema.safeParse({ ...base, startTime: '24:00' }).success).toBe(false);
  });
  it('수정 스키마도 같은 규칙', () => {
    const r = scheduleUpdateSchema.safeParse({
      ...base,
      eventId: base.id,
      baseVersion: 1,
      endDate: '2026-10-01',
    });
    expect(r.success).toBe(false);
  });
});
