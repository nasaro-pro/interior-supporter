'use server';
// 포트폴리오 권한 — 요청(담당자) · 단계 정하기 · 승인/거절(업체관리자). 판정은 RPC(SECURITY DEFINER)
// 프로젝트 생성 권한(core/server/create-permission-actions.ts)과 같은 모양
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAccessContext } from '@/features/core';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { routes } from '@/shared/contracts/routes';
import { dbFail, parseInput } from '@/shared/lib/action';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { PORTFOLIO_LEVELS } from '../lib/access';
import { portfolioRoutes } from '../routes';

const requestSchema = z.object({
  companyId: z.uuid(),
  level: z.enum(['works', 'full']),
  note: z.string().trim().max(500).default(''),
});
const setSchema = z.object({
  companyId: z.uuid(),
  memberId: z.uuid(),
  level: z.enum(PORTFOLIO_LEVELS),
});
const decideSchema = z.object({ companyId: z.uuid(), requestId: z.uuid(), approve: z.boolean() });

async function memberOf(companyId: string) {
  const ctx = await getAccessContext();
  return ctx.memberships.find((m) => m.companyId === companyId) ?? null;
}

function rpcFail(event: string, error: { code?: string; message?: string }, companyId: string) {
  if (error.message === 'forbidden') return fail('FORBIDDEN');
  if (error.message === 'already_allowed') return fail('CONFLICT');
  if (error.message === 'invalid_target') return fail('VALIDATION_FAILED');
  return dbFail(event, error, { companyId });
}

function refresh(slug: string) {
  revalidatePath(routes.app.settings(slug, 'members'));
  revalidatePath(portfolioRoutes.settings(slug));
}

/** 담당자: '사례 올리기' 또는 '전체 관리' 요청 (대기 중이면 단계만 바꿈) */
export async function requestPortfolioAccess(
  raw: unknown,
): Promise<ActionResult<{ requestId: string }>> {
  const parsed = parseInput(requestSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const m = await memberOf(v.companyId);
  if (!m) return fail('NOT_FOUND');
  if (m.role !== 'pm') return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('request_portfolio_access', {
    p_company: v.companyId,
    p_level: v.level,
    p_note: v.note,
  });
  if (error) return rpcFail('portfolio_access.request_failed', error, v.companyId);
  refresh(m.slug);
  return ok({ requestId: data });
}

/** 업체관리자: 담당자 단계 정하기 (없음 / 사례 올리기 / 전체 관리) */
export async function setPortfolioAccess(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(setSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const m = await memberOf(v.companyId);
  if (!m) return fail('NOT_FOUND');
  if (m.role === 'pm') return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('set_portfolio_access', {
    p_member: v.memberId,
    p_level: v.level,
  });
  if (error) return rpcFail('portfolio_access.set_failed', error, v.companyId);
  refresh(m.slug);
  return ok(null);
}

/** 업체관리자: 요청 승인(요청한 단계로) · 거절 */
export async function decidePortfolioAccess(raw: unknown): Promise<ActionResult<null>> {
  const parsed = parseInput(decideSchema, raw);
  if (!parsed.ok) return parsed.result;
  const v = parsed.data;
  const m = await memberOf(v.companyId);
  if (!m) return fail('NOT_FOUND');
  if (m.role === 'pm') return fail('FORBIDDEN');
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('decide_portfolio_access_request', {
    p_request: v.requestId,
    p_approve: v.approve,
  });
  if (error) return rpcFail('portfolio_access.decide_failed', error, v.companyId);
  refresh(m.slug);
  return ok(null);
}
