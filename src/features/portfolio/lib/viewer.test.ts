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
  it('문구: 직원=관리 페이지, 고객=마이홈, 관계 없는 계정=내 작업 화면, 손님=로그인', () => {
    expect(viewerLabelKey({ role: 'staff' })).toBe('manage');
    expect(viewerLabelKey({ role: 'customer', projectIds: [P1] })).toBe('myHome');
    expect(viewerLabelKey({ role: 'none' })).toBe('workspace');
    expect(viewerLabelKey({ role: 'guest' })).toBe('login');
  });
  it('손님은 로그인 후 같은 갈림길로 돌아온다', () => {
    expect(viewerDestination({ role: 'guest' }, 'houseon')).toBe('/login?next=%2Fc%2Fhouseon%2Fmy');
  });
  it('직원 → 업체 대시보드, 고객 → 우리 집 홈', () => {
    expect(viewerDestination({ role: 'staff' }, 'houseon')).toBe('/app/houseon');
    expect(viewerDestination({ role: 'customer', projectIds: [P1] }, 'houseon')).toBe(
      `/portal/projects/${P1}/home`,
    );
    expect(viewerDestination({ role: 'customer', projectIds: [P1, P2] }, 'houseon')).toBe(
      `/portal/projects/${P1}/home`,
    );
  });
  it('관계 없음 + 역할 없음 → 포트폴리오로 돌아가 안내', () => {
    expect(viewerDestination({ role: 'none' }, 'houseon')).toBe('/c/houseon?my=none');
    expect(viewerDestination({ role: 'none' }, 'houseon', false)).toBe('/c/houseon?my=none');
  });
  it('관계 없음 + 자기 역할 있음(현장 · 다른 업체) → 영역 선택', () => {
    expect(viewerDestination({ role: 'none' }, 'houseon', true)).toBe('/select-area');
  });
  it('자기 역할 여부는 관계 있는 계정의 갈 곳을 바꾸지 않는다', () => {
    expect(viewerDestination({ role: 'staff' }, 'houseon', true)).toBe('/app/houseon');
    expect(viewerDestination({ role: 'guest' }, 'houseon', true)).toBe(
      '/login?next=%2Fc%2Fhouseon%2Fmy',
    );
  });
});
