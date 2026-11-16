// 사이트 관리자 콘솔 업체 상세(ADM-03)의 '공개 홈페이지' 칸 데이터 — RPC 가 사이트 관리자인지 다시 확인한다
import 'server-only';
import { createServerSupabase } from '@/shared/lib/supabase/server';
import { parseAdminPortfolio, type AdminPortfolio } from '../lib/admin';

/** 포트폴리오를 아직 안 만든 업체는 null */
export async function getAdminCompanyPortfolio(companyId: string): Promise<AdminPortfolio | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc('admin_company_portfolio', { p_company: companyId });
  if (error) return null;
  return parseAdminPortfolio(data);
}
