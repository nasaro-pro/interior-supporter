// CL-08 고객 일정 (D3) — 공개 일정만, 등록·수정 없음 (REQ-230, POL-004·D13: 프로젝트 공개 AND 일정 공개)
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import type { SearchParams } from '@/features/requests/lib/list-params';
import { ScheduleBoard } from '@/features/schedule/components/ScheduleBoard';
import { buildMonthGrid } from '@/features/schedule/lib/calendar';
import { parseScheduleView } from '@/features/schedule/lib/view-params';
import {
  getProjectPeriod,
  listEventsInRange,
  listProjectEvents,
} from '@/features/schedule/server/queries';
import { routes } from '@/shared/contracts/routes';
import { todayKst } from '@/shared/lib/dates';
import { Notice } from '@/shared/ui/notice';
import { SectionHeader } from '@/shared/ui/section';

type Props = { params: Promise<{ project: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('schedule');
  return { title: t('screen.list') };
}

export default async function PortalSchedulePage({ params, searchParams }: Props) {
  const { project } = await params;
  const access = await requireProjectAccess(project, ['customer']);
  const today = todayKst();
  const state = parseScheduleView(await searchParams, today, access.as);
  const grid = buildMonthGrid(state.month);
  const opts = { archived: false, publicOnly: true };
  const [events, period, timelineEvents] = await Promise.all([
    listEventsInRange([project], grid[0]![0]!, grid[grid.length - 1]![6]!, opts),
    getProjectPeriod(project),
    state.view === 'timeline' ? listProjectEvents(project, opts) : Promise.resolve([]),
  ]);
  const t = await getTranslations();

  return (
    <main data-screen-id="CL-08" className="flex flex-col gap-4">
      <SectionHeader title={t('schedule.screen.list')} />
      {state.monthInvalid ? (
        <Notice tone="caution" role="status">
          {t('schedule.month.invalid')}
        </Notice>
      ) : null}
      <ScheduleBoard
        state={state}
        today={today}
        base={routes.portal.project(project, 'schedule')}
        events={events}
        timeline={
          period
            ? {
                project: { startDate: period.startDate, endDate: period.endDate },
                events: timelineEvents,
              }
            : undefined
        }
        eventHref={(e) => routes.portal.scheduleEvent(project, e.id)}
        showVisibility={false}
        emptyText={t('schedule.list.emptyCustomer')}
      />
    </main>
  );
}
