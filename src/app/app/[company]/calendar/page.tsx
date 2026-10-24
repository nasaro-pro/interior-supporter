// PM-30 전체 캘린더 (D1) — 편집 가능한 모든 프로젝트 일정을 합쳐 보는 조회 창. 별도 원본 없음 (REQ-233)
// 일정 선택 → 해당 프로젝트 PM-18 (TR-05, 원본 계층 유지)
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireCompanyStaff } from '@/features/core';
import type { SearchParams } from '@/features/requests/lib/list-params';
import { CalendarProjectFilter } from '@/features/schedule/components/CalendarProjectFilter';
import { ScheduleBoard } from '@/features/schedule/components/ScheduleBoard';
import { buildMonthGrid } from '@/features/schedule/lib/calendar';
import { parseProjectFilter, parseScheduleView } from '@/features/schedule/lib/view-params';
import { listEditableProjects, listEventsInRange } from '@/features/schedule/server/queries';
import { routes } from '@/shared/contracts/routes';
import { todayKst } from '@/shared/lib/dates';
import { Notice } from '@/shared/ui/notice';
import { PageHeader } from '@/shared/ui/page-parts';
import { EmptyState, FilterEmptyState } from '@/shared/ui/states';

type Props = { params: Promise<{ company: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('schedule');
  return { title: t('screen.calendar') };
}

export default async function CompanyCalendarPage({ params, searchParams }: Props) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const ctx = await getAccessContext();
  const sp = await searchParams;
  const today = todayKst();
  const projects = await listEditableProjects(ctx, staff.companyId);
  const selected = parseProjectFilter(
    sp,
    projects.map((p) => p.id),
  );
  // 전체 캘린더는 월간·사용 중 일정만 (보관함은 각 프로젝트 일정 화면에서)
  const state = {
    ...parseScheduleView(sp, today, 'editor'),
    view: 'month' as const,
    archived: false,
  };
  const grid = buildMonthGrid(state.month);
  const ids = selected.length > 0 ? selected : projects.map((p) => p.id);
  const events = await listEventsInRange(ids, grid[0]![0]!, grid[grid.length - 1]![6]!, {
    archived: false,
    publicOnly: false,
  });
  const t = await getTranslations();
  const base = routes.app.calendar(company);
  const names = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <main data-screen-id="PM-30" className="flex flex-col gap-4">
      <PageHeader
        title={t('schedule.screen.calendar')}
        description={t('schedule.calendar.scopeHint')}
        meta={t('common.list.count', { count: events.length })}
      />
      {projects.length === 0 ? (
        <EmptyState title={t('schedule.calendar.noProjects')} />
      ) : (
        <>
          <CalendarProjectFilter
            action={base}
            month={state.month}
            projects={projects}
            selected={selected}
          />
          {state.monthInvalid ? (
            <Notice tone="caution" role="status">
              {t('schedule.month.invalid')}
            </Notice>
          ) : null}
          {selected.length > 0 && events.length === 0 ? (
            <FilterEmptyState
              message={t('schedule.calendar.filterEmpty')}
              resetHref={routes.app.calendar(company, state.month)}
              resetLabel={t('common.action.resetFilters')}
            />
          ) : null}
          <ScheduleBoard
            state={state}
            today={today}
            base={base}
            extraQuery={selected.length > 0 ? { projects: selected.join(',') } : {}}
            events={events}
            eventHref={(e) => routes.app.scheduleEvent(company, e.projectId, e.id)}
            projectNames={names}
            showVisibility
            // C-09: 필터 빈 결과 안내(FilterEmptyState)가 이미 보이면 달력 빈 문구는 생략
            emptyText={
              selected.length > 0 && events.length === 0 ? null : t('schedule.month.empty')
            }
            allowTimeline={false}
          />
        </>
      )}
    </main>
  );
}
