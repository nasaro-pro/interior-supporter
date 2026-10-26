// D-30 일정 진행 상태 표시 — 색 + 아이콘 + 문구 (색만으로 의미 전달 금지)
import { useTranslations } from 'next-intl';
import { Circle, CircleCheck, CircleDot, type LucideIcon } from 'lucide-react';
import { ToneBadge, type Tone } from '@/shared/ui/tone-badge';
import type { ScheduleProgress } from '../schema';

export const PROGRESS_STYLE: Record<
  ScheduleProgress,
  { tone: Tone; icon: LucideIcon; chip: string }
> = {
  planned: { tone: 'neutral', icon: Circle, chip: 'border-s-muted-foreground/50' },
  in_progress: { tone: 'info', icon: CircleDot, chip: 'border-s-tone-info-fg' },
  done: { tone: 'positive', icon: CircleCheck, chip: 'border-s-tone-positive-fg' },
};

export function ScheduleProgressBadge({ progress }: { progress: ScheduleProgress }) {
  const t = useTranslations('schedule');
  const s = PROGRESS_STYLE[progress];
  return (
    <ToneBadge tone={s.tone} icon={s.icon} data-status={progress}>
      {t(`progress.${progress}`)}
    </ToneBadge>
  );
}

/** 칩 · 타임라인용 작은 아이콘 (스크린 리더용 이름 포함) */
export function ScheduleProgressIcon({ progress }: { progress: ScheduleProgress }) {
  const t = useTranslations('schedule');
  const Icon = PROGRESS_STYLE[progress].icon;
  return (
    <Icon
      className="size-3 shrink-0"
      role="img"
      aria-label={t(`progress.${progress}`)}
      data-progress={progress}
    />
  );
}
