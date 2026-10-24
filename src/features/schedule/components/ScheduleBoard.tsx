// 일정 보드 — 월간(md 이상) + 주간 목록(모바일) + 선택한 날 / 타임라인 (PM-08 · CL-08 · PM-30 공통)
// 도구 줄(달 이동 | 보기 전환) → 달력. 02 문서 6.4
import { useTranslations } from 'next-intl';
import { addDaysYmd, buildMonthGrid, shiftMonth, weekDays } from '../lib/calendar';
import { scheduleHref, type ScheduleViewState } from '../lib/view-params';
import type { ScheduleEvent } from '../types';
import { CalendarMonth } from './CalendarMonth';
import { MonthNav, ViewSwitch } from './CalendarToolbar';
import { CalendarWeekList } from './CalendarWeekList';
import { DayEventsPanel } from './DayEventsPanel';
import { Timeline } from './Timeline';

export function ScheduleBoard({
  state,
  today,
  base,
  extraQuery = {},
  events,
  timeline,
  eventHref,
  projectNames,
  showVisibility,
  emptyText,
  allowTimeline = true,
}: {
  state: ScheduleViewState;
  today: string;
  /** routes 로 만든 목록 경로 */
  base: string;
  /** 전체 캘린더의 ?projects= 처럼 항상 유지할 query */
  extraQuery?: Record<string, string>;
  /** 월간 그리드 범위의 일정 */
  events: ScheduleEvent[];
  /** 타임라인 보기일 때: 프로젝트 기간 + 전체 일정 */
  timeline?: {
    project: { startDate: string | null; endDate: string | null };
    events: ScheduleEvent[];
  };
  eventHref: (e: ScheduleEvent) => string;
  projectNames?: Map<string, string>;
  showVisibility: boolean;
  /** 빈 달 문구. 호출자가 이미 빈 결과 안내(필터 빈 결과 등)를 보이면 null (C-09 — 이중 표시 방지) */
  emptyText: string | null;
  allowTimeline?: boolean;
}) {
  const t = useTranslations('schedule');
  const href = (patch: Partial<ScheduleViewState>) =>
    scheduleHref(base, { ...state, ...patch }, extraQuery);
  const [year, month] = state.month.split('-').map(Number) as [number, number];
  const monthTitle = t('view.monthTitle', { year, month });
  const anchor = state.day ?? (today.startsWith(state.month) ? today : `${state.month}-01`);
  const week = weekDays(anchor);
  const grid = buildMonthGrid(state.month);
  const inGrid = events.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {state.view === 'month' ? (
          <MonthNav
            title={monthTitle}
            prevHref={href({ month: shiftMonth(state.month, -1), day: null })}
            nextHref={href({ month: shiftMonth(state.month, 1), day: null })}
            todayHref={href({ month: today.slice(0, 7), day: today })}
          />
        ) : (
          <span />
        )}
        {allowTimeline ? (
          <ViewSwitch
            current={state.view}
            monthHref={href({ view: 'month' })}
            timelineHref={href({ view: 'timeline', day: null })}
          />
        ) : null}
      </div>

      {state.view === 'timeline' && timeline ? (
        <Timeline project={timeline.project} events={timeline.events} eventHref={eventHref} />
      ) : (
        <>
          {!inGrid && emptyText !== null ? (
            <p role="status" className="text-muted-foreground text-sm">
              {emptyText}
            </p>
          ) : null}
          <CalendarMonth
            month={state.month}
            today={today}
            selectedDay={state.day}
            events={events}
            eventHref={eventHref}
            dayHref={(day) => href({ day })}
            projectNames={projectNames}
            showVisibility={showVisibility}
            label={monthTitle}
          />
          {state.day && grid.flat().includes(state.day) ? (
            <DayEventsPanel
              day={state.day}
              events={events}
              eventHref={eventHref}
              closeHref={href({ day: null })}
              projectNames={projectNames}
            />
          ) : null}
          <CalendarWeekList
            days={week}
            today={today}
            events={events}
            eventHref={eventHref}
            prevHref={weekHref(href, addDaysYmd(anchor, -7))}
            nextHref={weekHref(href, addDaysYmd(anchor, 7))}
            projectNames={projectNames}
            showVisibility={showVisibility}
          />
        </>
      )}
    </div>
  );
}

function weekHref(href: (p: Partial<ScheduleViewState>) => string, day: string) {
  return href({ month: day.slice(0, 7), day });
}
