// src/shared/lib/dates.test.ts (A · 스타터 고정)
import { describe, expect, it } from 'vitest';
import {
  formatCalendarDate,
  formatCalendarTime,
  formatDateTime,
  isWithin,
  toKstDate,
  weekdayOf,
} from './dates';
import { formatWon } from './money';

describe('dates (KST)', () => {
  it('UTC 15:30 은 KST 다음 날', () => {
    expect(toKstDate('2026-10-06T15:30:00Z')).toBe('2026-10-07');
  });
  it('표시 형식', () => {
    expect(formatDateTime('2026-10-07T05:20:00Z', 'ko')).toBe('2026. 10. 7.(수) 14:20');
    expect(formatDateTime('2026-10-07T05:20:00Z', 'en')).toBe('Oct 7, 2026, 2:20 PM');
  });
  it('달력 값은 시간대 변환 없음', () => {
    expect(formatCalendarDate('2026-10-07', 'ko')).toBe('2026. 10. 7.(수)');
    expect(formatCalendarTime('09:05', 'en')).toBe('9:05 AM');
    expect(weekdayOf('2026-10-04')).toBe(0);
  });
  it('기간은 양 끝 포함', () => {
    expect(isWithin('2026-10-07', '2026-10-07', '2026-10-07')).toBe(true);
    expect(isWithin('2026-10-08', null, '2026-10-07')).toBe(false);
  });
  it('금액', () => {
    expect(formatWon(45000, 'ko')).toBe('45,000원');
    expect(formatWon(45000, 'en')).toBe('₩45,000');
  });
});
