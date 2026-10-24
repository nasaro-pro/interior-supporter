// 월간 캘린더 (02 문서 6.4) — 일요일 시작, 오늘 강조, 칸마다 시각순 칩, 많으면 "+N" (md 이상)
// 모바일(md 미만)은 CalendarWeekList 가 대신 그린다
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { formatCalendarDate, type DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { buildMonthGrid, eventsOnDay } from '../lib/calendar';
import type { ScheduleEvent } from '../types';
import { ScheduleEventChip } from './ScheduleEventChip';

const MAX_CHIPS = 3;

export function CalendarMonth({
  month,
  today,
  selectedDay,
  events,
  eventHref,
  dayHref,
  projectNames,
  showVisibility = false,
  label,
}: {
  month: string;
  today: string;
  selectedDay: string | null;
  events: ScheduleEvent[];
  eventHref: (e: ScheduleEvent) => string;
  dayHref: (day: string) => string;
  /** 전체 캘린더(PM-30): 칩에 프로젝트 이름 */
  projectNames?: Map<string, string>;
  showVisibility?: boolean;
  label: string;
}) {
  const t = useTranslations('schedule');
  const locale = useLocale() as DateLocale;
  const grid = buildMonthGrid(month);
  return (
    <div className="bg-card hidden overflow-hidden rounded-lg border md:block">
      <table className="w-full table-fixed border-collapse" aria-label={label}>
        <thead>
          <tr>
            {Array.from({ length: 7 }, (_, i) => (
              <th
                key={i}
                scope="col"
                className={cn(
                  'text-meta border-b px-2 py-2 text-left font-medium',
                  i === 0 ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {t(`view.weekdays.${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((week) => (
            <tr key={week[0]}>
              {week.map((day) => {
                const inMonth = day.startsWith(month);
                const dayEvents = eventsOnDay(events, day);
                const hidden = dayEvents.length - MAX_CHIPS;
                const isToday = day === today;
                return (
                  <td
                    key={day}
                    data-key={day}
                    className={cn(
                      'h-28 border-t border-l p-1.5 align-top first:border-l-0',
                      !inMonth && 'bg-muted/50',
                      selectedDay === day && 'bg-accent/60',
                    )}
                  >
                    <Link
                      href={dayHref(day)}
                      scroll={false}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={formatCalendarDate(day, locale)}
                      className={cn(
                        'focus-visible:ring-ring/50 mb-1 inline-flex size-7 items-center justify-center rounded-full text-xs tabular-nums outline-none focus-visible:ring-3 motion-safe:transition-colors',
                        !inMonth && 'text-muted-foreground',
                        isToday
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'hover:bg-muted',
                      )}
                      data-ui-key="calendar-day-open"
                    >
                      {Number(day.slice(8))}
                    </Link>
                    <ul className="flex flex-col gap-1">
                      {dayEvents.slice(0, MAX_CHIPS).map((e) => (
                        <li key={e.id}>
                          <ScheduleEventChip
                            event={e}
                            href={eventHref(e)}
                            projectName={projectNames?.get(e.projectId)}
                            showVisibility={showVisibility}
                          />
                        </li>
                      ))}
                    </ul>
                    {hidden > 0 ? (
                      <Link
                        href={dayHref(day)}
                        scroll={false}
                        className="text-muted-foreground hover:text-foreground mt-1 block rounded-sm text-xs font-medium"
                        data-ui-key="calendar-day-more"
                      >
                        {t('month.moreEvents', { count: hidden })}
                      </Link>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
