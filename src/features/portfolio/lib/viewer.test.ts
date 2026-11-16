import { describe, expect, it } from 'vitest';
import { parseViewer, viewerDestination, viewerLabelKey } from './viewer';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

describe('parseViewer', () => {
  it('RPC 모양 → 타입, 모르는 모양은 손님', () => {
    expect(parseViewer({ role: 'staff' })).toEqual({ role: 'staff' });
    expect(parseViewer({ role: 'customer', projects: [{ id: P1 }, { id: 3 }, null] })).toEqual({
      role: 'customer',
      projectIds: [P1],
    });
    expect(parseViewer({ role: 'customer', projects: [] })).toEqual({ role: 'guest' });
    expect(parseViewer({ role: 'none' })).toEqual({ role: 'none' });
    expect(parseViewer(null)).toEqual({ role: 'guest' });
    expect(parseViewer({ role: 'admin' })).toEqual({ role: 'guest' });
  });
});

describe('버튼 문구 · 갈 곳', () => {
  it('문구: 직원=관리 페이지, 고객=마이홈, 그 외=로그인', () => {
    expect(viewerLabelKey({ role: 'staff' })).toBe('manage');
    expect(viewerLabelKey({ role: 'customer', projectIds: [P1] })).toBe('myHome');
    expect(viewerLabelKey({ role: 'none' })).toBe('login');
    expect(viewerLabelKey({ role: 'guest' })).toBe('login');
  });
  it('손님은 로그인 후 같은 갈림길로 돌아온다', () => {
    expect(viewerDestination({ role: 'guest' }, 'houseon')).toBe('/login?next=%2Fc%2Fhouseon%2Fmy');
  });
  it('직원 → 업체 프로젝트 목록, 고객 집 1개 → 우리 집 홈, 여러 개 → 내 프로젝트', () => {
    expect(viewerDestination({ role: 'staff' }, 'houseon')).toBe('/app/houseon');
    expect(viewerDestination({ role: 'customer', projectIds: [P1] }, 'houseon')).toBe(
      `/portal/projects/${P1}/home`,
    );
    expect(viewerDestination({ role: 'customer', projectIds: [P1, P2] }, 'houseon')).toBe(
      '/portal/projects',
    );
  });
  it('관계 없음 → 포트폴리오로 돌아가 안내', () => {
    expect(viewerDestination({ role: 'none' }, 'houseon')).toBe('/c/houseon?my=none');
  });
});
