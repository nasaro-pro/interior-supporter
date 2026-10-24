// 모바일 주간 목록 (02 문서 6.4: 모바일은 월간 대신 주간 목록) — md 미만
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCalendarDate, type DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { ButtonLink } from '@/shared/ui/button-link';
import { eventsOnDay } from '../lib/calendar';
import type { ScheduleEvent } from '../types';
import { ScheduleEventChip } from './ScheduleEventChip';

export function CalendarWeekList({
  days,
  today,
  events,
  eventHref,
  prevHref,
  nextHref,
  projectNames,
  showVisibility = false,
}: {
  days: string[];
  today: string;
  events: ScheduleEvent[];
  eventHref: (e: ScheduleEvent) => string;
  prevHref: string;
  nextHref: string;
  projectNames?: Map<string, string>;
  showVisibility?: boolean;
}) {
  const t = useTranslations('schedule');
  const locale = useLocale() as DateLocale;
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const title = t('view.weekTitle', {
    start: formatCalendarDate(first, locale),
    end: formatCalendarDate(last, locale),
  });
  return (
    <section className="flex flex-col gap-3 md:hidden" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <ButtonLink
          href={prevHref}
          scroll={false}
          variant="outline"
          size="icon"
          aria-label={t('view.prevWeek')}
          data-ui-key="calendar-prev-week"
        >
          <ChevronLeft aria-hidden />
        </ButtonLink>
        <h3 className="min-w-0 text-center text-sm font-semibold" data-numeric>
          {title}
        </h3>
        <ButtonLink
          href={nextHref}
          scroll={false}
          variant="outline"
          size="icon"
          aria-label={t('view.nextWeek')}
          data-ui-key="calendar-next-week"
        >
          <ChevronRight aria-hidden />
        </ButtonLink>
      </div>
      <ol className="bg-card divide-y rounded-lg border">
        {days.map((day) => {
          const list = eventsOnDay(events, day);
          const isToday = day === today;
          return (
            <li key={day} data-key={day} className="flex flex-col gap-2 px-4 py-3">
              <p
                className={cn(
                  'text-meta',
                  isToday ? 'text-primary font-semibold' : 'text-muted-foreground',
                )}
                aria-current={isToday ? 'date' : undefined}
              >
                {formatCalendarDate(day, locale)}
              </p>
              {list.length === 0 ? (
                <p className="text-muted-foreground text-xs">{t('month.dayEmpty')}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {list.map((e) => (
                    <li key={e.id}>
                      <ScheduleEventChip
                        event={e}
                        href={eventHref(e)}
                        projectName={projectNames?.get(e.projectId)}
                        showVisibility={showVisibility}
                        className="min-h-10 px-2 text-sm"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
