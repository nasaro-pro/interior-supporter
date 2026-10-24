import { describe, expect, it } from 'vitest';
import { formatEventWhen } from './format';

const labels = { allDay: '종일' };

describe('formatEventWhen (KST 달력 값 그대로)', () => {
  it('하루 종일', () => {
    expect(
      formatEventWhen(
        { startDate: '2026-10-07', startTime: null, endDate: null, endTime: null },
        'ko',
        labels,
      ),
    ).toBe('2026. 10. 7.(수) · 종일');
  });
  it('같은 날 시각 범위', () => {
    expect(
      formatEventWhen(
        { startDate: '2026-10-07', startTime: '09:00', endDate: null, endTime: '18:30' },
        'ko',
        labels,
      ),
    ).toBe('2026. 10. 7.(수) 09:00 ~ 18:30');
  });
  it('여러 날 (종료일 포함)', () => {
    expect(
      formatEventWhen(
        { startDate: '2026-10-07', startTime: null, endDate: '2026-10-09', endTime: null },
        'en',
        { allDay: 'All day' },
      ),
    ).toBe('Oct 7, 2026 ~ Oct 9, 2026 · All day');
    expect(
      formatEventWhen(
        { startDate: '2026-10-07', startTime: '09:00', endDate: '2026-10-08', endTime: '12:00' },
        'ko',
        labels,
      ),
    ).toBe('2026. 10. 7.(수) 09:00 ~ 2026. 10. 8.(목) 12:00');
  });
});
