// 선택한 날의 일정 ("+N" 또는 날짜 선택 시, md 이상) — ?day=YYYY-MM-DD
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { formatCalendarDate, type DateLocale } from '@/shared/lib/dates';
import { linkClass } from '@/shared/ui/styles';
import { ButtonLink } from '@/shared/ui/button-link';
import { eventsOnDay } from '../lib/calendar';
import { formatEventWhen } from '../lib/format';
import type { ScheduleEvent } from '../types';

export function DayEventsPanel({
  day,
  events,
  eventHref,
  closeHref,
  projectNames,
}: {
  day: string;
  events: ScheduleEvent[];
  eventHref: (e: ScheduleEvent) => string;
  closeHref: string;
  projectNames?: Map<string, string>;
}) {
  const t = useTranslations('schedule');
  const locale = useLocale() as DateLocale;
  const list = eventsOnDay(events, day);
  const title = t('month.dayTitle', { date: formatCalendarDate(day, locale) });
  return (
    <section
      className="bg-card hidden flex-col gap-3 rounded-lg border p-4 md:flex"
      aria-label={title}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <ButtonLink
          href={closeHref}
          scroll={false}
          variant="ghost"
          size="icon-sm"
          aria-label={t('month.closeDay')}
          data-ui-key="calendar-day-close"
        >
          <X aria-hidden />
        </ButtonLink>
      </div>
      {list.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('month.dayEmpty')}</p>
      ) : (
        <ul className="divide-y">
          {list.map((e) => (
            <li
              key={e.id}
              data-key={e.id}
              className="grid gap-1 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4"
            >
              <span className="text-muted-foreground text-meta" data-numeric>
                {formatEventWhen(e, locale, { allDay: t('field.allDay') })}
              </span>
              <Link
                href={eventHref(e)}
                className={`${linkClass} min-w-0 font-medium break-words`}
                data-ui-key="schedule-event-open"
              >
                {projectNames?.get(e.projectId) ? `${projectNames.get(e.projectId)} · ` : ''}
                {e.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
