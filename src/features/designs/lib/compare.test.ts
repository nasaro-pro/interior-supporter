import { describe, expect, it } from 'vitest';
import {
  clampPosition,
  clipForPosition,
  compareDisabledReason,
  positionForKey,
  positionFromPointer,
} from '@/features/designs/lib/compare';

describe('TC-105 A/B 비교 위치 계산 (B-T03·B-T04)', () => {
  it('0% = B 전체, 50% = 절반, 100% = A 전체 (A 레이어 clip)', () => {
    expect(clipForPosition(0)).toBe('inset(0 100% 0 0)');
    expect(clipForPosition(50)).toBe('inset(0 50% 0 0)');
    expect(clipForPosition(100)).toBe('inset(0 0% 0 0)');
  });

  it('키보드: ←→ 1%, Shift 10%, Home 0%, End 100%, 범위 밖은 자른다', () => {
    expect(positionForKey(50, 'ArrowRight', false)).toBe(51);
    expect(positionForKey(50, 'ArrowLeft', false)).toBe(49);
    expect(positionForKey(50, 'ArrowRight', true)).toBe(60);
    expect(positionForKey(5, 'ArrowLeft', true)).toBe(0);
    expect(positionForKey(95, 'ArrowRight', true)).toBe(100);
    expect(positionForKey(37, 'Home', false)).toBe(0);
    expect(positionForKey(37, 'End', false)).toBe(100);
    expect(positionForKey(37, 'Enter', false)).toBeNull();
  });

  it('포인터 위치 → 비율 (영역 밖은 0·100 으로 자른다)', () => {
    expect(positionFromPointer(150, 100, 200)).toBe(25);
    expect(positionFromPointer(50, 100, 200)).toBe(0);
    expect(positionFromPointer(400, 100, 200)).toBe(100);
    expect(positionFromPointer(10, 0, 0)).toBe(50);
    expect(clampPosition(Number.NaN)).toBe(50);
  });

  it('비활성 사유 4종을 구분한다', () => {
    const base = { candidateCount: 3, a: 'x', b: 'y', denied: false, loadFailed: false };
    expect(compareDisabledReason(base)).toBeNull();
    expect(compareDisabledReason({ ...base, candidateCount: 1 })).toBe('needTwo');
    expect(compareDisabledReason({ ...base, b: null })).toBe('unselected');
    expect(compareDisabledReason({ ...base, b: 'x' })).toBe('unselected');
    expect(compareDisabledReason({ ...base, denied: true })).toBe('denied');
    expect(compareDisabledReason({ ...base, loadFailed: true })).toBe('loadFailed');
  });
});
