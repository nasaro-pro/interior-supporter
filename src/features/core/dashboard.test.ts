// PM-00 대시보드 계산 도우미 — 주(일~토) · 공사 기간 진행률 · 탭 파싱
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));

const { addDays, isOnDay, parseDashboardTab, periodPercent, weekOf } =
  await import('@/features/core/server/dashboard-queries');

describe('PM-00 대시보드 도우미', () => {
  it('addDays 는 달·해를 넘긴다', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('weekOf 는 전체 캘린더와 같은 일~토 주를 돌려준다', () => {
    const w = weekOf('2026-11-12'); // 목요일
    expect(w).toHaveLength(7);
    expect(w[0]).toBe('2026-11-08');
    expect(w[6]).toBe('2026-11-14');
  });

  it('periodPercent: 시작 전 0 · 끝난 뒤 100 · 기간 없으면 null', () => {
    expect(periodPercent('2026-11-10', '2026-11-19', '2026-11-01')).toBe(0);
    expect(periodPercent('2026-11-10', '2026-11-19', '2026-11-14')).toBe(50);
    expect(periodPercent('2026-11-10', '2026-11-19', '2026-12-01')).toBe(100);
    expect(periodPercent(null, '2026-11-19', '2026-11-14')).toBeNull();
    expect(periodPercent('2026-11-19', '2026-11-10', '2026-11-14')).toBeNull();
  });

  it('isOnDay 는 종료일을 포함한다', () => {
    expect(isOnDay({ startDate: '2026-11-10', endDate: '2026-11-12' }, '2026-11-12')).toBe(true);
    expect(isOnDay({ startDate: '2026-11-10', endDate: null }, '2026-11-11')).toBe(false);
  });

  it('parseDashboardTab 은 모르는 값을 전체로', () => {
    expect(parseDashboardTab('requests')).toBe('requests');
    expect(parseDashboardTab('x')).toBe('all');
    expect(parseDashboardTab(undefined)).toBe('all');
  });
});
