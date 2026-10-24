// CL-18 고객 일정 상세 (D4) — 공개 일정만, 접근 가능한 관련 항목만 링크 (REQ-232, C-T09)
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { ScheduleDetailView } from '@/features/schedule/components/ScheduleDetailView';
import { getProjectPeriod, getScheduleEvent } from '@/features/schedule/server/queries';
import { isUuid } from '@/features/requests/lib/list-params';
import { resolveRelatedLink } from '@/features/schedule/server/related';
import { routes } from '@/shared/contracts/routes';

type Props = { params: Promise<{ project: string; eventId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('schedule');
  return { title: t('screen.detail') };
}

export default async function PortalScheduleDetailPage({ params }: Props) {
  const { project, eventId } = await params;
  const access = await requireProjectAccess(project, ['customer']);
  if (!isUuid(eventId)) notFound();
  // RLS: 비공개·보관 일정은 null → 404 (직접 URL 차단, 존재 숨김)
  const event = await getScheduleEvent(project, eventId);
  if (!event || !event.isPublic || event.archived) notFound();
  const [period, link] = await Promise.all([
    getProjectPeriod(project),
    resolveRelatedLink(event, 'portal', access.companySlug),
  ]);

  return (
    <main data-screen-id="CL-18" className="flex flex-col gap-6">
      <ScheduleDetailView
        event={event}
        listHref={routes.portal.project(project, 'schedule')}
        project={{ name: period?.name ?? '', href: routes.portal.project(project) }}
        related={link ?? (event.relatedType ? 'unavailable' : null)}
        showVisibility={false}
      />
    </main>
  );
}
