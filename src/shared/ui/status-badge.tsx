// src/shared/ui/status-badge.tsx (A) — 상태 배지 7톤 (02 문서 7.2). 라벨+아이콘으로 의미 전달, 색만 쓰지 않는다
import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  Check,
  Circle,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  Eye,
  EyeOff,
  Flag,
  Hammer,
  LoaderCircle,
  Pause,
  TriangleAlert,
} from 'lucide-react';
import { ToneBadge, type Tone } from '@/shared/ui/tone-badge';

export type { Tone } from '@/shared/ui/tone-badge';

/** 02 문서 7.2 표의 상태 → 톤·아이콘 */
export const STATUS_STYLE = {
  public: { tone: 'brand', icon: Eye },
  private: { tone: 'neutral', icon: EyeOff },
  confirmed: { tone: 'positive', icon: CircleCheck },
  needs_reconfirm: { tone: 'attention', icon: TriangleAlert },
  unconfirmed: { tone: 'neutral', icon: Circle },
  request_open: { tone: 'info', icon: CircleDot },
  request_in_progress: { tone: 'caution', icon: Clock },
  request_resolved: { tone: 'positive', icon: CircleCheck },
  file_pending: { tone: 'info', icon: LoaderCircle },
  file_ready: { tone: 'positive', icon: Check },
  file_rejected: { tone: 'critical', icon: CircleX },
  project_planned: { tone: 'neutral', icon: CalendarClock },
  project_active: { tone: 'brand', icon: Hammer },
  project_on_hold: { tone: 'caution', icon: Pause },
  project_completed: { tone: 'positive', icon: Flag },
} as const satisfies Record<string, { tone: Tone; icon: LucideIcon }>;

export type StatusKey = keyof typeof STATUS_STYLE;

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusKey;
  label: string;
  className?: string;
}) {
  const { tone, icon } = STATUS_STYLE[status];
  return (
    <ToneBadge tone={tone} icon={icon} data-status={status} className={className}>
      {label}
    </ToneBadge>
  );
}
