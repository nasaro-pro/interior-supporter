// A-T03·A-T05 / TC-017·TC-018 접근 판정 (requireProjectAccess 의 순수 판정부) — 정상·예외·권한 거부
import { describe, expect, it } from 'vitest';
import { decideProjectAccess } from './server/access';

const X = 'company-x';
const Y = 'company-y';
const P1 = { id: 'p1', company_id: X, is_public: true, archived_at: null };
const P2 = { id: 'p2', company_id: X, is_public: false, archived_at: null };
const Q1 = { id: 'q1', company_id: Y, is_public: true, archived_at: null };

const ctx = (
  memberships: { companyId: string; role: 'owner' | 'manager' | 'pm' }[],
  participations: { projectId: string; role: 'pm' | 'customer' | 'field'; canConfirm?: boolean }[],
) => ({
  memberships: memberships.map((m) => ({ ...m, slug: m.companyId, name: m.companyId })),
  participations: participations.map((p) => ({
    projectId: p.projectId,
    companyId: X,
    role: p.role,
    canConfirm: p.canConfirm ?? false,
  })),
});

describe('decideProjectAccess', () => {
  it('A-T03 업체 owner/manager 는 자기 업체 모든 프로젝트를 편집한다', () => {
    const owner = ctx([{ companyId: X, role: 'owner' }], []);
    expect(decideProjectAccess(owner, P2, ['editor'])).toEqual({ as: 'editor', canConfirm: false });
  });

  it('A-T03 다른 업체 프로젝트는 거부한다 (TC-901)', () => {
    const owner = ctx([{ companyId: X, role: 'owner' }], []);
    expect(decideProjectAccess(owner, Q1, ['editor', 'customer', 'field'])).toBeNull();
  });

  it('A-T03 pm 구성원은 배정된 프로젝트만 편집한다 (PM2 → P1 거부)', () => {
    const pm2 = ctx([{ companyId: X, role: 'pm' }], [{ projectId: 'p2', role: 'pm' }]);
    expect(decideProjectAccess(pm2, P2, ['editor'])?.as).toBe('editor');
    expect(decideProjectAccess(pm2, P1, ['editor'])).toBeNull();
  });

  it('TC-016 고객은 공개 프로젝트만, 확정권을 그대로 돌려준다', () => {
    const u1 = ctx([], [{ projectId: 'p1', role: 'customer', canConfirm: true }]);
    expect(decideProjectAccess(u1, P1, ['customer'])).toEqual({ as: 'customer', canConfirm: true });
    const u1onP2 = ctx([], [{ projectId: 'p2', role: 'customer' }]);
    expect(decideProjectAccess(u1onP2, P2, ['customer'])).toBeNull();
  });

  it('TC-017 미초대 고객(U3)·PM 화면 요청 고객은 거부한다', () => {
    const u3 = ctx([], []);
    expect(decideProjectAccess(u3, P1, ['customer'])).toBeNull();
    const u1 = ctx([], [{ projectId: 'p1', role: 'customer' }]);
    expect(decideProjectAccess(u1, P1, ['editor'])).toBeNull();
  });

  it('TC-018 보관된 프로젝트는 고객·시공팀에게 거부, 편집자는 복원 위해 허용', () => {
    const archived = { ...P1, archived_at: '2026-10-07T00:00:00Z' };
    const f1 = ctx([], [{ projectId: 'p1', role: 'field' }]);
    expect(decideProjectAccess(f1, archived, ['field'])).toBeNull();
    const owner = ctx([{ companyId: X, role: 'owner' }], []);
    expect(decideProjectAccess(owner, archived, ['editor'])?.as).toBe('editor');
  });

  it('A-T05 시공팀은 비공개 프로젝트도 사진 영역 진입은 허용(POL-005), 편집은 거부', () => {
    const f1 = ctx([], [{ projectId: 'p2', role: 'field' }]);
    expect(decideProjectAccess(f1, P2, ['field'])?.as).toBe('field');
    expect(decideProjectAccess(f1, P2, ['editor'])).toBeNull();
  });
});
