import { describe, expect, it } from 'vitest';
import { isFieldTab, visibleTabs } from './tabs';

const off = { showSchedule: false, showDesigns: false, showMaterials: false };

describe('visibleTabs', () => {
  it('기본(모두 꺼짐)은 탭 없음', () => {
    expect(visibleTabs(off)).toEqual([]);
  });
  it('켠 탭만 정해진 순서로', () => {
    expect(visibleTabs({ ...off, showMaterials: true, showSchedule: true })).toEqual([
      'schedule',
      'materials',
    ]);
  });
});

describe('isFieldTab', () => {
  it('탭 이름만 통과', () => {
    expect(isFieldTab('designs')).toBe(true);
    expect(isFieldTab('estimates')).toBe(false);
    expect(isFieldTab(null)).toBe(false);
  });
});
