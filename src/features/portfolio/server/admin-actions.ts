'use server';
// 사이트 관리자 콘솔 › 업체 상세 › 공개 홈페이지 — 홈페이지 이름 · 대표자/사업자등록번호 잠금
// 권한은 RPC 안의 private.require_platform_admin() 이 확인하고, 관리 기록(admin_audit_events)도 RPC 가 남긴다
import { revalidatePath } from 'next/cache';
import { fail, ok, type ActionResult } from '@/shared/contracts/errors';
import { dbFail, parseInput } from '@/shared/lib/action';
import { routes } from '@/shared/contracts/routes';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { adminBusinessLockSchema, adminSiteNameSchema } from '../schema';

function refresh(companyId: string) {
  revalidatePath(routes.admin.company(companyId));
  revalidatePath('/c/[slug]', 'layout'); // 공개 페이지 머리·큰 제목
}

export async function setPortfolioSiteName(raw: unknown): Promise<ActionResult<void>> {
  const parsed = parseInput(adminSiteNameSchema, raw);
  if (!parsed.ok) return parsed.result;
  const { companyId, siteName } = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc('admin_set_portfolio_site_name', {
    p_company: companyId,
    p_name: siteName,
  });
  if (error) return dbFail('portfolio.admin.site_name_failed', error, { companyId });
  refresh(companyId);
  return ok(undefined);
}

export async function setPortfolioBusinessLock(
  raw: unknown,
): Promise<ActionResult<{ lockedAt: string | null }>> {
  const parsed = parseInput(adminBusinessLockSchema, raw);
  if (!parsed.ok) return parsed.result;
  const { companyId, locked } = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_set_portfolio_business_lock', {
    p_company: companyId,
    p_locked: locked,
  });
  if (error) return dbFail('portfolio.admin.business_lock_failed', error, { companyId });
  if (locked && !data) return fail('NOT_FOUND');
  refresh(companyId);
  return ok({ lockedAt: (data as string | null) ?? null });
}
