// 전체 기간 타임라인 (REQ-230) — 프로젝트 기간 전체, 시작일순 막대
// 날짜 칸 | 제목·막대. 막대는 보조 표시(aria-hidden), 일시는 글자로 함께 보인다
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatCalendarDate, type DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { EmptyState } from '@/shared/ui/states';
import { linkClass } from '@/shared/ui/styles';
import { eventEnd, spanPercent, timelineRange } from '../lib/calendar';
import { formatEventWhen } from '../lib/format';
import type { ScheduleEvent } from '../types';
import { ScheduleProgressBadge } from './ScheduleProgress';

const row = 'grid gap-2 px-4 py-3 md:grid-cols-[200px_minmax(0,1fr)] md:gap-4';

export function Timeline({
  project,
  events,
  eventHref,
}: {
  project: { startDate: string | null; endDate: string | null };
  events: ScheduleEvent[];
  eventHref: (e: ScheduleEvent) => string;
}) {
  const t = useTranslations('schedule');
  const locale = useLocale() as DateLocale;
  const range = timelineRange(project, events);
  if (!range) return <EmptyState title={t('timeline.empty')} />;
  const period =
    project.startDate !== null
      ? spanPercent(range, project.startDate, project.endDate ?? project.startDate)
      : null;
  return (
    <section aria-label={t('timeline.label')} className="bg-card divide-y rounded-lg border">
      <div className={cn(row, 'text-muted-foreground text-meta')}>
        <span>{t('timeline.label')}</span>
        <span className="flex justify-between gap-2" data-numeric>
          <span>{formatCalendarDate(range.from, locale)}</span>
          <span>{formatCalendarDate(range.to, locale)}</span>
        </span>
      </div>
      {period ? (
        <div className={row}>
          <span className="text-meta font-medium">{t('timeline.projectPeriod')}</span>
          <div className="bg-muted relative h-2 self-center rounded-full" aria-hidden>
            <div
              className="bg-foreground/30 absolute inset-y-0 rounded-full"
              style={{ left: `${period.left}%`, width: `${period.width}%` }}
            />
          </div>
        </div>
      ) : null}
      <ol className="divide-y">
        {events.map((e) => {
          const span = spanPercent(range, e.startDate, eventEnd(e));
          return (
            <li key={e.id} data-key={e.id} className={row}>
              <span className="text-muted-foreground text-meta" data-numeric>
                {formatEventWhen(e, locale, { allDay: t('field.allDay') })}
              </span>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    href={eventHref(e)}
                    className={cn(linkClass, 'min-w-0 truncate font-medium')}
                    data-ui-key="schedule-event-open"
                  >
                    {e.title}
                  </Link>
                  <ScheduleProgressBadge progress={e.progress} />
                </div>
                <div className="bg-muted relative h-2 rounded-full" aria-hidden>
                  <div
                    className={cn(
                      'absolute inset-y-0 rounded-full',
                      e.progress === 'done'
                        ? 'bg-tone-positive-fg'
                        : e.progress === 'in_progress'
                          ? 'bg-tone-info-fg'
                          : 'bg-primary/50',
                    )}
                    style={{ left: `${span.left}%`, width: `${span.width}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
