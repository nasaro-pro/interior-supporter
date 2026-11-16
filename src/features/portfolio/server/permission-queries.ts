// 업체관리자: 포트폴리오 권한 — 구성원별 단계 · 대기 요청 (RLS: 요청은 업체관리자에게 업체 전체가 보인다)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { displayNames } from '@/features/core/server/participant-queries';
import { normalizeLevel, type PortfolioLevel } from '../lib/access';

/** 구성원 id → 단계 (담당자만 의미 있음) */
export async function loadMemberPortfolioLevels(
  companyId: string,
): Promise<Map<string, PortfolioLevel>> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from('company_members')
    .select('id, portfolio_access')
    .eq('company_id', companyId)
    .is('removed_at', null);
  return new Map((data ?? []).map((r) => [r.id, normalizeLevel(r.portfolio_access)]));
}

export interface PortfolioAccessRequestItem {
  id: string;
  userId: string;
  displayName: string;
  level: 'works' | 'full';
  note: string;
  createdAt: string;
}

export async function listPortfolioAccessRequests(
  companyId: string,
): Promise<PortfolioAccessRequestItem[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('portfolio_access_requests')
    .select('id, user_id, level, note, created_at')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return null;
  const names = await displayNames(data.map((r) => r.user_id));
  return data.map((r) => ({
    id: r.id,
    userId: r.user_id,
    displayName: names.get(r.user_id) ?? '—',
    level: r.level === 'full' ? 'full' : 'works',
    note: r.note,
    createdAt: r.created_at,
  }));
}
