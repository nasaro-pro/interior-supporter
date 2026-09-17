export type PortalHost = { companyId: string } | null;

/** 커스텀 도메인 → 업체 매핑. P3 이후 캐시 조회로 교체. */
export async function resolvePortalHost(_host: string): Promise<PortalHost> {
  return null;
}
