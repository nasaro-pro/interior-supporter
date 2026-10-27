// PM-09 견적 등록 / PM-19 새 버전 진입점 — D-37: 업체관리자(owner · manager)에게만 그린다
// 담당자(pm) 화면에는 버튼이 없다 (서버 액션 · RLS 도 거부). 실제 폼은 EstimateFormSheetClient
import { canManageEstimates } from '@/features/estimates/server/permission';
import { EstimateFormSheetClient } from '@/features/estimates/components/EstimateFormSheetClient';

export async function EstimateFormSheet(props: {
  mode: 'create' | 'newVersion';
  projectId: string;
  companyId: string;
  companySlug: string;
  estimateId?: string;
}) {
  if (!(await canManageEstimates(props.companyId))) return null;
  return <EstimateFormSheetClient {...props} />;
}
