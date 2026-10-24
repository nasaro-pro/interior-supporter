// src/features/core/testing/access-fixture.ts (A · 테스트 전용) — loadAccessContext 가 읽는 테이블 응답 묶음
import type { FakeResult, Query, Responder } from './fake-supabase';

export const X = '00000000-0000-4000-8000-0000000000c1'; // 업체 X
export const Y = '00000000-0000-4000-8000-0000000000c2'; // 업체 Y
export const P1 = '00000000-0000-4000-8000-0000000000f1';
export const P2 = '00000000-0000-4000-8000-0000000000f2';
export const Q1 = '00000000-0000-4000-8000-0000000000f9'; // 업체 Y 프로젝트
export const U = '00000000-0000-4000-8000-0000000000a1';

export interface Who {
  userId?: string;
  email?: string;
  members?: { company_id: string; slug: string; role: 'owner' | 'manager' | 'pm' }[];
  parts?: {
    project_id: string;
    company_id: string;
    role: 'pm' | 'customer' | 'field';
    can_confirm?: boolean;
  }[];
}

/** auth.getUser 대역 */
export function authOf(who: Who | null) {
  return {
    getUser: async () => ({
      data: { user: who ? { id: who.userId ?? U, email: who.email ?? 'u@test.local' } : null },
      error: null,
    }),
  };
}

const single = (q: Query) => q.calls.some(([m]) => m === 'maybeSingle' || m === 'single');
const eqArg = (q: Query, col: string) => q.calls.find(([m, c]) => m === 'eq' && c === col)?.[2];

/**
 * loadAccessContext 의 profiles·company_members·project_participants(목록)·companies 응답,
 * editableScope 의 company_members(단건)·project_participants(role=pm) 응답, loadCompanySlug 의 companies(단건)
 */
export function accessResponder(who: Who): (q: Query) => FakeResult | undefined {
  const members = who.members ?? [];
  const parts = who.parts ?? [];
  return (q) => {
    if (q.table === 'profiles') return { data: { display_name: 'U', locale: 'ko' } };
    if (q.table === 'company_members') {
      if (single(q)) {
        const m = members.find((x) => x.company_id === eqArg(q, 'company_id'));
        return { data: m ? { role: m.role } : null };
      }
      return { data: members.map((m) => ({ company_id: m.company_id, role: m.role })) };
    }
    if (q.table === 'project_participants' && !single(q)) {
      const role = eqArg(q, 'role');
      const company = eqArg(q, 'company_id');
      return {
        data: parts
          .filter((p) => (role ? p.role === role : true))
          .filter((p) => (company ? p.company_id === company : true))
          .map((p) => ({
            project_id: p.project_id,
            company_id: p.company_id,
            role: p.role,
            can_confirm: p.can_confirm ?? false,
            valid_from: null,
            valid_until: null,
          })),
      };
    }
    if (q.table === 'companies') {
      const all = members.map((m) => ({ id: m.company_id, slug: m.slug, name: m.slug }));
      if (single(q)) {
        const id = eqArg(q, 'id');
        return { data: all.find((c) => c.id === id) ?? { slug: 'other-co' } };
      }
      return { data: all };
    }
    return undefined;
  };
}

/** 앞의 응답자가 undefined 면 다음으로 */
export function chain(...rs: Responder[]): Responder {
  return (q) => {
    for (const r of rs) {
      const out = r(q);
      if (out !== undefined) return out;
    }
    return undefined; // 아무도 답하지 않으면 { data: null } (fake 기본값)
  };
}
