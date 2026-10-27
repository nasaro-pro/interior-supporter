import { describe, expect, it } from 'vitest';
import { timeRange } from './time';

describe('timeRange', () => {
  it('종일 일정은 빈 문자열', () => {
    expect(timeRange(null, '18:00')).toBe('');
  });
  it('시작만 / 시작–끝', () => {
    expect(timeRange('09:00', null)).toBe('09:00');
    expect(timeRange('09:00', '18:00')).toBe('09:00–18:00');
  });
});
