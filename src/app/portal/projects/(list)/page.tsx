// src/app/portal/projects/(list)/page.tsx (A · TASK-009, REQ-015) — CL-01 내 프로젝트: 초대된 공개 프로젝트만, 업체명으로 묶음
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { ProjectStatusBadge } from '@/features/core/components/project-badges';
import { listPortalProjects } from '@/features/core/server/project-queries';
import { routes } from '@/shared/contracts/routes';
import { ButtonLink } from '@/shared/ui/button-link';
import { PeriodText } from '@/shared/ui/date-text';
import { PageHeader } from '@/shared/ui/page-parts';
import { EmptyState, ErrorState } from '@/shared/ui/states';

export default async function MyProjectsPage() {
  const ctx = await getAccessContext();
  const t = await getTranslations();
  const ids = [
    ...new Set(ctx.participations.filter((p) => p.role === 'customer').map((p) => p.projectId)),
  ];
  const groups = await listPortalProjects(ids);

  return (
    <main data-screen-id="CL-01" className="flex flex-col gap-6">
      <PageHeader title={t('projects.screen.myProjects')} />
      {groups === null ? (
        <ErrorState
          action={
            <ButtonLink
              href={routes.portal.projects()}
              data-ui-key="my-projects-retry"
              variant="outline"
            >
              {t('common.action.retry')}
            </ButtonLink>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState title={t('projects.myProjects.empty')} />
      ) : (
        groups.map((g) => (
          <section
            key={g.companyId}
            aria-labelledby={`co-${g.companyId}`}
            className="flex flex-col gap-2"
          >
            <h2 id={`co-${g.companyId}`} className="text-muted-foreground text-sm font-semibold">
              {g.companyName}
            </h2>
            <ul className="flex flex-col gap-2">
              {g.projects.map((p) => (
                <li key={p.id} data-key={p.id}>
                  <Link
                    href={routes.portal.project(p.id)}
                    className="bg-card hover:bg-accent/60 flex flex-col gap-2 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    data-ui-key="my-project-open"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium">{p.name}</span>
                      <span className="text-muted-foreground text-meta block">
                        <PeriodText
                          from={p.startDate}
                          until={p.endDate}
                          emptyLabel={t('projects.list.noPeriod')}
                        />
                        {p.currentPhase
                          ? ` · ${t('projects.field.currentPhase')}: ${p.currentPhase}`
                          : ''}
                      </span>
                    </span>
                    <ProjectStatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
