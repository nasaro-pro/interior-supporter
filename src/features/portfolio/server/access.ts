// 지금 로그인한 사람의 이 업체 포트폴리오 단계 + 담당 프로젝트 + 대기 중 권한 요청
import 'server-only';
import { cache } from 'react';
import { getAccessContext } from '@/features/core';
import { fail, type ActionResult } from '@/shared/contracts/errors';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { portfolioLevel, type PortfolioLevel } from '../lib/access';

export interface PortfolioAccess {
  companyId: string;
  slug: string;
  userId: string;
  level: PortfolioLevel;
  /** 담당자(pm)로 참여 중인 이 업체 프로젝트 — works 단계가 올릴 수 있는 곳 */
  myProjectIds: Set<string>;
  /** 대기 중인 권한 요청 단계 (없으면 null) */
  pendingRequest: 'works' | 'full' | null;
  isManager: boolean;
}

export const loadPortfolioAccess = cache(
  async (companyId: string): Promise<PortfolioAccess | null> => {
    const ctx = await getAccessContext();
    const m = ctx.memberships.find((x) => x.companyId === companyId);
    if (!m) return null;
    const isManager = m.role === 'owner' || m.role === 'manager';
    const myProjectIds = new Set(
      ctx.participations
        .filter((p) => p.companyId === companyId && p.role === 'pm')
        .map((p) => p.projectId),
    );
    if (isManager) {
      return {
        companyId,
        slug: m.slug,
        userId: ctx.userId,
        level: 'full',
        myProjectIds,
        pendingRequest: null,
        isManager,
      };
    }
    const supabase = await createServerSupabase();
    const [member, request] = await Promise.all([
      supabase
        .from('company_members')
        .select('portfolio_access')
        .eq('company_id', companyId)
        .eq('user_id', ctx.userId)
        .is('removed_at', null)
        .maybeSingle(),
      supabase
        .from('portfolio_access_requests')
        .select('level')
        .eq('company_id', companyId)
        .eq('user_id', ctx.userId)
        .eq('status', 'pending')
        .maybeSingle(),
    ]);
    // 조회 실패는 'none' 으로 — 액션·RLS 가 다시 막는다
    const pending = request.data?.level;
    return {
      companyId,
      slug: m.slug,
      userId: ctx.userId,
      level: portfolioLevel(m.role, member.data?.portfolio_access),
      myProjectIds,
      pendingRequest: pending === 'works' || pending === 'full' ? pending : null,
      isManager,
    };
  },
);

/** 액션 첫 줄: 필요한 단계가 없으면 FORBIDDEN (소속이 아니면 NOT_FOUND) */
export async function requirePortfolioLevel(
  companyId: string,
  need: 'works' | 'full',
): Promise<{ ok: true; a: PortfolioAccess } | { ok: false; error: ActionResult<never> }> {
  const a = await loadPortfolioAccess(companyId);
  if (!a) return { ok: false, error: fail('NOT_FOUND') };
  const okLevel = need === 'works' ? a.level !== 'none' : a.level === 'full';
  if (!okLevel) return { ok: false, error: fail('FORBIDDEN') };
  return { ok: true, a };
}
