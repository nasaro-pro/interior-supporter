// 사이트 관리자 '공개 홈페이지' 칸 — RPC admin_company_portfolio 결과를 화면용으로
export interface AdminPortfolio {
  slug: string;
  companyName: string;
  siteName: string | null;
  isPublic: boolean;
  publicWorks: number;
  businessName: string;
  representative: string;
  businessRegNo: string | null;
  businessLockedAt: string | null;
}

export function parseAdminPortfolio(raw: unknown): AdminPortfolio | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const nstr = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
  if (!str(r.slug) || !str(r.companyName)) return null;
  return {
    slug: str(r.slug),
    companyName: str(r.companyName),
    siteName: nstr(r.siteName),
    isPublic: r.isPublic === true,
    publicWorks: typeof r.publicWorks === 'number' ? r.publicWorks : Number(r.publicWorks) || 0,
    businessName: str(r.businessName),
    representative: str(r.representative),
    businessRegNo: nstr(r.businessRegNo),
    businessLockedAt: nstr(r.businessLockedAt),
  };
}
