import { describe, expect, it } from 'vitest';
import { parseProjectFilter, parseScheduleView, scheduleHref } from './view-params';

describe('parseScheduleView', () => {
  it('기본값은 이번 달 월간', () => {
    expect(parseScheduleView({}, '2026-10-07', 'editor')).toEqual({
      view: 'month',
      month: '2026-10',
      monthInvalid: false,
      day: null,
      archived: false,
    });
  });
  it('day 가 있고 month 가 없으면 그 날의 달을 보여 준다', () => {
    const v = parseScheduleView({ day: '2026-12-25' }, '2026-10-07', 'customer');
    expect(v.month).toBe('2026-12');
    expect(v.day).toBe('2026-12-25');
  });
  it('잘못된 view·day 는 무시, 보관함은 편집자만', () => {
    const v = parseScheduleView(
      { view: 'gantt', day: '2026-02-30', archived: '1' },
      '2026-10-07',
      'customer',
    );
    expect(v).toMatchObject({ view: 'month', day: null, archived: false });
  });
});

describe('scheduleHref', () => {
  it('기본값은 생략', () => {
    expect(
      scheduleHref('/s', { view: 'month', month: '2026-10', day: null, archived: false }),
    ).toBe('/s?month=2026-10');
    expect(
      scheduleHref('/s', { view: 'timeline', month: '2026-10', day: '2026-10-07', archived: true }),
    ).toBe('/s?view=timeline&month=2026-10&day=2026-10-07&archived=1');
  });
});

describe('parseProjectFilter (PM-30)', () => {
  it('쉼표·반복 값을 모두 받고 편집 가능 목록 밖은 버린다', () => {
    expect(parseProjectFilter({ projects: 'a,b,zz' }, ['a', 'b', 'c'])).toEqual(['a', 'b']);
    expect(parseProjectFilter({ projects: ['c', 'a'] }, ['a', 'b', 'c'])).toEqual(['c', 'a']);
    expect(parseProjectFilter({}, ['a'])).toEqual([]);
  });
});
