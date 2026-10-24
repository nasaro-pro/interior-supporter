import { describe, expect, it } from 'vitest';
import {
  addDaysYmd,
  buildMonthGrid,
  daysBetween,
  eventsOnDay,
  parseMonthParam,
  shiftMonth,
  spanPercent,
  timelineRange,
  weekDays,
} from './calendar';

describe('달력 산술 (시간대 변환 없음, POL-023)', () => {
  it('addDaysYmd 는 월·연·윤년 경계를 넘는다', () => {
    expect(addDaysYmd('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysYmd('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysYmd('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysYmd('2026-02-28', 1)).toBe('2026-03-01');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-10-01', '2026-10-31')).toBe(30);
    expect(daysBetween('2026-10-05', '2026-10-05')).toBe(0);
  });
  it('shiftMonth', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('parseMonthParam', () => {
  it('올바른 값은 그대로', () => {
    expect(parseMonthParam('2026-02', '2026-10-07')).toEqual({ month: '2026-02', invalid: false });
  });
  it('없으면 이번 달(KST 오늘 기준)', () => {
    expect(parseMonthParam(undefined, '2026-10-07')).toEqual({ month: '2026-10', invalid: false });
  });
  it('잘못된 값은 이번 달 + invalid 안내', () => {
    expect(parseMonthParam('2026-13', '2026-10-07')).toEqual({ month: '2026-10', invalid: true });
    expect(parseMonthParam('abcd', '2026-10-07')).toEqual({ month: '2026-10', invalid: true });
  });
});

describe('buildMonthGrid (REQ-230 일요일 시작)', () => {
  it('2026-10: 9/27(일) 부터 10/31(토) 까지 5주', () => {
    const grid = buildMonthGrid('2026-10');
    expect(grid).toHaveLength(5);
    expect(grid[0]?.[0]).toBe('2026-09-27');
    expect(grid[4]?.[6]).toBe('2026-10-31');
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
  it('2026-02: 1일이 일요일, 28일이 토요일 → 정확히 4주', () => {
    const grid = buildMonthGrid('2026-02');
    expect(grid).toHaveLength(4);
    expect(grid[0]?.[0]).toBe('2026-02-01');
    expect(grid[3]?.[6]).toBe('2026-02-28');
  });
  it('2026-08: 6주가 필요한 달', () => {
    const grid = buildMonthGrid('2026-08');
    expect(grid).toHaveLength(6);
    expect(grid[0]?.[0]).toBe('2026-07-26');
  });
});

describe('weekDays', () => {
  it('기준일이 속한 일~토', () => {
    expect(weekDays('2026-10-07')).toEqual([
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
    ]);
  });
});

describe('eventsOnDay (같은 날은 시각순)', () => {
  const ev = (
    id: string,
    startDate: string,
    endDate: string | null,
    startTime: string | null,
    title = id,
  ) => ({
    id,
    title,
    startDate,
    endDate,
    startTime,
  });
  it('여러 날 일정은 종료일 포함, 종일 먼저 → 시각순', () => {
    const events = [
      ev('late', '2026-10-07', null, '15:00'),
      ev('multi', '2026-10-05', '2026-10-08', null),
      ev('early', '2026-10-07', null, '09:00'),
      ev('ended', '2026-10-01', '2026-10-06', null),
    ];
    expect(eventsOnDay(events, '2026-10-07').map((e) => e.id)).toEqual(['multi', 'early', 'late']);
    expect(eventsOnDay(events, '2026-10-08').map((e) => e.id)).toEqual(['multi']);
  });
});

describe('timeline', () => {
  it('프로젝트 기간과 일정 범위를 합친다', () => {
    expect(
      timelineRange({ startDate: '2026-10-01', endDate: '2026-10-31' }, [
        { startDate: '2026-09-28', endDate: null },
        { startDate: '2026-10-10', endDate: '2026-10-12' },
      ]),
    ).toEqual({ from: '2026-09-28', to: '2026-10-31' });
    expect(timelineRange({ startDate: null, endDate: null }, [])).toBeNull();
  });
  it('spanPercent 는 종료일 포함 폭', () => {
    const range = { from: '2026-10-01', to: '2026-10-10' };
    expect(spanPercent(range, '2026-10-01', '2026-10-10')).toEqual({ left: 0, width: 100 });
    expect(spanPercent(range, '2026-10-06', '2026-10-06')).toEqual({ left: 50, width: 10 });
  });
});
