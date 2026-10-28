// B 상태 배지 (02 문서 7.2) — 표준 StatusBadge/ToneBadge 위의 얇은 매핑. 서버·클라이언트 공용(훅 없음)
// 확정 상태: none=미확정(neutral, PM 화면만) · confirmed=positive · needs_reconfirm=attention
// 공개: public=brand+Eye · private=neutral+EyeOff. 라벨+아이콘이 의미를 전달한다 (색만 쓰지 않음)
import { Archive, LayoutGrid, MessageSquare, Star } from 'lucide-react';
import type { ConfirmState } from '@/shared/contracts/domain';
import { StatusBadge, type StatusKey } from '@/shared/ui/status-badge';
import { ToneBadge } from '@/shared/ui/tone-badge';

export const CONFIRM_STATUS = {
  none: 'unconfirmed',
  confirmed: 'confirmed',
  needs_reconfirm: 'needs_reconfirm',
} as const satisfies Record<ConfirmState, StatusKey>;

export function ConfirmStateBadge({ state, label }: { state: ConfirmState; label: string }) {
  return <StatusBadge status={CONFIRM_STATUS[state]} label={label} />;
}

export function VisibilityBadge({ isPublic, label }: { isPublic: boolean; label: string }) {
  return <StatusBadge status={isPublic ? 'public' : 'private'} label={label} />;
}

export function ArchivedBadge({ label }: { label: string }) {
  return (
    <ToneBadge tone="neutral" icon={Archive} data-status="archived">
      {label}
    </ToneBadge>
  );
}

/** D-26 공간 (전체·거실·주방…) */
export function SpaceBadge({ label }: { label: string }) {
  return (
    <ToneBadge tone="info" icon={LayoutGrid} data-status="space">
      {label}
    </ToneBadge>
  );
}

/** CU-04 고객 카드: 이 도안에 남긴 내 메모 수 */
export function MemoCountBadge({ label }: { label: string }) {
  return (
    <ToneBadge
      tone="neutral"
      icon={MessageSquare}
      data-status="memo-count"
      data-ui-key="design-memo-count"
    >
      {label}
    </ToneBadge>
  );
}

/** D-27 대표 도안 */
export function MainBadge({ label }: { label: string }) {
  return (
    <ToneBadge tone="brand" icon={Star} data-status="main" data-ui-key="design-main-badge">
      {label}
    </ToneBadge>
  );
}
