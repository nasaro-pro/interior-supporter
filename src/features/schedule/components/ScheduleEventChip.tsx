// 일정 칩 — 시각(또는 종일) + 제목, 클릭 → 정규 상세 (PM-18 / CL-18)
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { EyeOff } from 'lucide-react';
import type { DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { chipTime } from '../lib/format';
import type { ScheduleEvent } from '../types';

export function ScheduleEventChip({
  event,
  href,
  projectName,
  showVisibility = false,
  className,
}: {
  event: ScheduleEvent;
  href: string;
  projectName?: string;
  showVisibility?: boolean;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as DateLocale;
  return (
    <Link
      href={href}
      data-key={event.id}
      data-ui-key="schedule-event-open"
      className={cn(
        'bg-accent text-accent-foreground hover:bg-primary/15 focus-visible:ring-ring/50 flex min-h-6 items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs leading-tight outline-none focus-visible:ring-3 motion-safe:transition-colors',
        className,
      )}
    >
      {showVisibility && !event.isPublic ? (
        <EyeOff className="size-3 shrink-0" aria-label={t('common.visibility.private')} />
      ) : null}
      <span className="shrink-0 tabular-nums">
        {chipTime(event.startTime, locale, t('schedule.field.allDay'))}
      </span>
      <span className="min-w-0 truncate font-medium">
        {projectName ? `${projectName} · ` : ''}
        {event.title}
      </span>
    </Link>
  );
}
