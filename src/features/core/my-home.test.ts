import { describe, expect, it } from 'vitest';
import { constructionProgress } from './my-home';

const p = (startDate: string | null, endDate: string | null, status = 'active') => ({
  startDate,
  endDate,
  status,
});

describe('constructionProgress', () => {
  it('공사 중: 며칠째 · 남은 날 · 퍼센트 (양 끝 포함)', () => {
    expect(constructionProgress(p('2026-11-01', '2026-11-30'), '2026-11-08')).toEqual({
      state: 'during',
      percent: 27,
      dayNo: 8,
      totalDays: 30,
      daysLeft: 22,
      daysToStart: null,
    });
  });
  it('첫날 1%, 완공일 99% (완료 처리 전엔 100 아님)', () => {
    expect(constructionProgress(p('2026-11-01', '2026-11-30'), '2026-11-01')).toMatchObject({
      dayNo: 1,
      percent: 3,
    });
    expect(constructionProgress(p('2026-11-01', '2026-11-30'), '2026-11-30')).toMatchObject({
      daysLeft: 0,
      percent: 99,
    });
    expect(constructionProgress(p('2026-01-01', '2026-12-31'), '2026-01-01')).toMatchObject({
      percent: 1,
    });
  });
  it('시작 전 · 예정일 지남 · 완료', () => {
    expect(constructionProgress(p('2026-11-10', '2026-11-30'), '2026-11-08')).toMatchObject({
      state: 'before',
      percent: 0,
      daysToStart: 2,
    });
    expect(constructionProgress(p('2026-10-01', '2026-10-31'), '2026-11-08')).toMatchObject({
      state: 'after',
      percent: 100,
    });
    expect(
      constructionProgress(p('2026-10-01', '2026-10-31', 'completed'), '2026-11-08'),
    ).toMatchObject({ state: 'done', percent: 100, totalDays: 31 });
  });
  it('날짜가 없거나 거꾸로면 unknown', () => {
    expect(constructionProgress(p(null, '2026-11-30'), '2026-11-08').state).toBe('unknown');
    expect(constructionProgress(p('2026-11-30', '2026-11-01'), '2026-11-08').state).toBe('unknown');
  });
  it('월·윤년 경계', () => {
    expect(constructionProgress(p('2028-02-27', '2028-03-01'), '2028-02-29')).toMatchObject({
      dayNo: 3,
      totalDays: 4,
      daysLeft: 1,
    });
  });
});
