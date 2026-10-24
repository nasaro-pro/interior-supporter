// PM-08 프로젝트 일정 (D3) — 월간(일요일 시작) + 타임라인, 모바일 주간 목록 (REQ-230, REQ-231)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { firstParam, type SearchParams } from '@/features/requests/lib/list-params';
import { ScheduleBoard } from '@/features/schedule/components/ScheduleBoard';
import { ScheduleFormSheet } from '@/features/schedule/components/ScheduleFormSheet';
import { buildMonthGrid } from '@/features/schedule/lib/calendar';
import { parseScheduleView, scheduleHref } from '@/features/schedule/lib/view-params';
import {
  getProjectPeriod,
  listEventsInRange,
  listProjectEvents,
} from '@/features/schedule/server/queries';
import { NO_RELATED_CHOICES, loadRelatedChoices } from '@/features/schedule/server/related';
import { routes } from '@/shared/contracts/routes';
import { todayKst } from '@/shared/lib/dates';
import { Notice } from '@/shared/ui/notice';
import { SectionHeader } from '@/shared/ui/section';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';

type Props = {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('schedule');
  return { title: t('screen.list') };
}

export default async function PmSchedulePage({ params, searchParams }: Props) {
  const { company, project } = await params;
  const access = await requireProjectAccess(project, ['editor']);
  if (access.companySlug !== company) notFound();
  const today = todayKst();
  const sp = await searchParams;
  const state = parseScheduleView(sp, today, access.as);
  const grid = buildMonthGrid(state.month);
  const opts = { archived: state.archived, publicOnly: false };
  const [events, period, relatedOptions, timelineEvents] = await Promise.all([
    listEventsInRange([project], grid[0]![0]!, grid[grid.length - 1]![6]!, opts),
    getProjectPeriod(project),
    // C-08: 관련 항목 선택지(5쿼리)는 등록 Sheet 가 열렸을 때(?mode=new)만 읽는다
    firstParam(sp, 'mode') === 'new' ? loadRelatedChoices(access.companyId) : NO_RELATED_CHOICES,
    state.view === 'timeline' ? listProjectEvents(project, opts) : Promise.resolve([]),
  ]);
  const t = await getTranslations();
  const base = routes.app.project(company, project, 'schedule');

  return (
    <main data-screen-id="PM-08" className="flex flex-col gap-4">
      <SectionHeader
        title={t('schedule.screen.list')}
        description={t('schedule.form.publishHint')}
        actions={
          <ScheduleFormSheet
            key={state.day ?? today}
            mode="new"
            projectId={project}
            companySlug={company}
            defaultDate={state.day ?? today}
            relatedOptions={relatedOptions.options}
            projectNames={relatedOptions.names}
          />
        }
      />
      <SegmentedTabs
        label={t('common.filter.archived')}
        items={[false, true].map((archived) => ({
          key: String(archived),
          href: scheduleHref(base, { ...state, archived, day: null }),
          label: archived ? t('common.filter.archived') : t('common.filter.active'),
          current: state.archived === archived,
          uiKey: archived ? 'schedule-filter-archived' : 'schedule-filter-active',
        }))}
      />
      {state.monthInvalid ? (
        <Notice tone="caution" role="status">
          {t('schedule.month.invalid')}
        </Notice>
      ) : null}
      <ScheduleBoard
        state={state}
        today={today}
        base={base}
        events={events}
        timeline={
          period
            ? {
                project: { startDate: period.startDate, endDate: period.endDate },
                events: timelineEvents,
              }
            : undefined
        }
        eventHref={(e) => routes.app.scheduleEvent(company, project, e.id)}
        showVisibility
        emptyText={state.archived ? t('common.state.empty') : t('schedule.month.empty')}
      />
    </main>
  );
}
