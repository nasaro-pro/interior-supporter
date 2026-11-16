import { describe, expect, it } from 'vitest';
import { canDo, canEditWork, normalizeLevel, portfolioLevel, requestableLevels } from './access';

describe('portfolio 권한 단계', () => {
  it('대표·관리자는 언제나 full, 담당자는 받은 단계 (모르는 값은 none)', () => {
    expect(portfolioLevel('owner', 'none')).toBe('full');
    expect(portfolioLevel('manager', null)).toBe('full');
    expect(portfolioLevel('pm', 'works')).toBe('works');
    expect(portfolioLevel('pm', 'full')).toBe('full');
    expect(portfolioLevel('pm', 'admin')).toBe('none');
    expect(normalizeLevel(undefined)).toBe('none');
  });
  it('works 는 사례 만들기·고치기만', () => {
    expect(canDo('works', 'createWork')).toBe(true);
    expect(canDo('works', 'editWork')).toBe(true);
    for (const a of ['settings', 'publish', 'feature', 'reorder'] as const)
      expect(canDo('works', a)).toBe(false);
    expect(canDo('none', 'createWork')).toBe(false);
    expect(canDo('full', 'settings')).toBe(true);
  });
  it('works 는 자기 담당 프로젝트의 초안만 고친다', () => {
    const mine = new Set(['p1']);
    expect(canEditWork('works', { status: 'draft', projectId: 'p1' }, mine)).toBe(true);
    expect(canEditWork('works', { status: 'published', projectId: 'p1' }, mine)).toBe(false);
    expect(canEditWork('works', { status: 'draft', projectId: 'p2' }, mine)).toBe(false);
    expect(canEditWork('works', { status: 'draft', projectId: null }, mine)).toBe(false);
    expect(canEditWork('full', { status: 'published', projectId: null }, mine)).toBe(true);
    expect(canEditWork('none', { status: 'draft', projectId: 'p1' }, mine)).toBe(false);
  });
  it('요청할 수 있는 단계는 지금보다 높은 것만', () => {
    expect(requestableLevels('none')).toEqual(['works', 'full']);
    expect(requestableLevels('works')).toEqual(['full']);
    expect(requestableLevels('full')).toEqual([]);
  });
});
