// 보는 사람과 업체의 관계 (RPC portfolio_viewer — 부르는 사람 자신의 관계만 돌려준다)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { logger } from '@/shared/lib/logger';
import { loadAccessContext } from '@/features/core/server/access';
import { parseViewer, viewerDestination, type PortfolioViewer } from '../lib/viewer';

export async function loadPortfolioViewer(slug: string): Promise<PortfolioViewer> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('portfolio_viewer', { p_slug: slug });
  if (error) {
    logger.warn('portfolio.viewer.failed', { dbCode: error.code });
    return { role: 'guest' }; // 실패하면 '로그인' 버튼 — 눌러도 로그인 후 다시 판단한다
  }
  return parseViewer(data);
}

/**
 * 업체 사이트 마이페이지(/c/{slug}/my) · 사이트에서 로그인한 직후의 갈 곳 (2026-11)
 * 관계 없는 계정이면 자기 역할(현장 · 다른 업체 등)이 있는지 한 번 더 본다 — 있으면 영역 선택, 없으면 사이트 안내
 */
export async function portfolioDestination(viewer: PortfolioViewer, slug: string): Promise<string> {
  if (viewer.role !== 'none') return viewerDestination(viewer, slug);
  const ctx = await loadAccessContext();
  return viewerDestination(viewer, slug, (ctx?.areas.length ?? 0) > 0);
}
