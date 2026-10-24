// src/features/core/components/project-header.tsx (A · TASK-003) — ProjectHeader: 이름·현장·기간·상태·현재 공정 (02 문서 2.1, integration.ts 2장)
import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PeriodText } from '@/shared/ui/date-text';
import { Breadcrumbs } from '@/shared/ui/page-parts';
import type { ProjectHeaderData } from '@/shared/contracts/integration';
import { ProjectStatusBadge } from './project-badges';

export function ProjectHeader({
  project,
  breadcrumbs,
  switcher,
  extraBadges,
}: {
  project: ProjectHeaderData;
  breadcrumbs: { label: string; href?: string }[];
  switcher?: ReactNode;
  extraBadges?: ReactNode;
}) {
  const t = useTranslations('projects');
  return (
    <div className="flex flex-col gap-3">
      <Breadcrumbs items={breadcrumbs} />
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="max-w-full truncate text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} />
            {extraBadges}
          </div>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex min-w-0 items-center gap-1 wrap-anywhere">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              {project.siteAddress || '—'}
            </span>
            <PeriodText
              from={project.startDate}
              until={project.endDate}
              emptyLabel={t('list.noPeriod')}
            />
            <span>
              {t('field.currentPhase')}: {project.currentPhase || t('overview.phaseEmpty')}
            </span>
          </p>
        </div>
        {switcher}
      </div>
    </div>
  );
}
