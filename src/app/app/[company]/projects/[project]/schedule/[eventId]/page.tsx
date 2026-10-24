// PM-18 일정 상세 (D4) — 수정 Sheet(?mode=edit)·보관, 관련 항목 링크 (REQ-231, REQ-232)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { firstParam, isUuid, type SearchParams } from '@/features/requests/lib/list-params';
import { ScheduleArchiveButton } from '@/features/schedule/components/ScheduleArchiveButton';
import { ScheduleDetailView } from '@/features/schedule/components/ScheduleDetailView';
import { ScheduleFormSheet } from '@/features/schedule/components/ScheduleFormSheet';
import { getProjectPeriod, getScheduleEvent } from '@/features/schedule/server/queries';
import {
  NO_RELATED_CHOICES,
  loadRelatedChoices,
  resolveRelatedLink,
} from '@/features/schedule/server/related';
import { routes } from '@/shared/contracts/routes';

type Props = {
  params: Promise<{ company: string; project: string; eventId: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('schedule');
  return { title: t('screen.detail') };
}

export default async function PmScheduleDetailPage({ params, searchParams }: Props) {
  const { company, project, eventId } = await params;
  const access = await requireProjectAccess(project, ['editor']);
  if (access.companySlug !== company || !isUuid(eventId)) notFound();
  const event = await getScheduleEvent(project, eventId);
  if (!event) notFound();
  const editing = firstParam(await searchParams, 'mode') === 'edit';
  const [period, link, relatedOptions] = await Promise.all([
    getProjectPeriod(project),
    resolveRelatedLink(event, 'app', company),
    // C-08: 수정 Sheet 가 열렸을 때(?mode=edit)만, 보관 일정은 수정 폼이 없으므로 읽지 않는다
    !event.archived && editing ? loadRelatedChoices(access.companyId) : NO_RELATED_CHOICES,
  ]);

  return (
    <main data-screen-id="PM-18" className="flex flex-col gap-6">
      <ScheduleDetailView
        event={event}
        listHref={routes.app.project(company, project, 'schedule')}
        project={{ name: period?.name ?? '', href: routes.app.project(company, project) }}
        related={link ?? (event.relatedType ? 'unavailable' : null)}
        showVisibility
        actions={
          <div className="flex flex-col items-start gap-3" key={event.version}>
            {!event.archived ? (
              <ScheduleFormSheet
                mode="edit"
                projectId={project}
                companySlug={company}
                event={event}
                defaultDate={event.startDate}
                relatedOptions={relatedOptions.options}
                projectNames={relatedOptions.names}
              />
            ) : null}
            <ScheduleArchiveButton
              projectId={project}
              eventId={event.id}
              version={event.version}
              archived={event.archived}
            />
          </div>
        }
      />
    </main>
  );
}
