// 보는 사람과 업체의 관계 (RPC portfolio_viewer — 부르는 사람 자신의 관계만 돌려준다)
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { logger } from '@/shared/lib/logger';
import { parseViewer, type PortfolioViewer } from '../lib/viewer';

export async function loadPortfolioViewer(slug: string): Promise<PortfolioViewer> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('portfolio_viewer', { p_slug: slug });
  if (error) {
    logger.warn('portfolio.viewer.failed', { dbCode: error.code });
    return { role: 'guest' }; // 실패하면 '로그인' 버튼 — 눌러도 로그인 후 다시 판단한다
  }
  return parseViewer(data);
}
