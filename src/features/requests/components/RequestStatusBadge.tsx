// 요청 처리 상태 배지 — 02 문서 7.2 고정 매핑(StatusBadge): 접수 info·CircleDot / 처리 중 caution·Clock / 완료 positive·CircleCheck
import { useTranslations } from 'next-intl';
import type { RequestStatus } from '@/shared/contracts/domain';
import { StatusBadge } from '@/shared/ui/status-badge';

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const t = useTranslations('requests.status');
  return <StatusBadge status={`request_${status}`} label={t(status)} />;
}
