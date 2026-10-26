// D-37 · CA-09 견적서 관리 권한 — 업체관리자(owner · manager)만 등록 · 새 버전 · 공개 · 보관
// 담당자(pm)는 편집자여도 보기만. DB(RLS can_manage_estimates)가 한 번 더 막는다
import 'server-only';
import { getAccessContext } from '@/features/core';

export async function canManageEstimates(companyId: string): Promise<boolean> {
  const ctx = await getAccessContext();
  const role = ctx.memberships.find((m) => m.companyId === companyId)?.role;
  return role === 'owner' || role === 'manager';
}
