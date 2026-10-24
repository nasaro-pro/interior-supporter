// src/app/app/[company]/projects/[project]/overview/page.tsx (A · TASK-006·012) — PM-03 개요 + 고객 홈 미리보기·편집 (REQ-013·014)
// 현재 공정(PM 수동 입력, POL-025)·최근 업데이트(B·C)·다음 일정(C). 개요 안에서 편집 기능을 복제하지 않고 원본 D4 로 이동
import { notFound } from 'next/navigation';
import { Eye, Pencil } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { HomeEditor } from '@/features/core/components/home-editor';
import { CustomerHomeBody, OverviewBlocks, Panel } from '@/features/core/components/summary-blocks';
import { loadProjectSummaries } from '@/features/core/server/overview-queries';
import { getProject } from '@/features/core/server/project-queries';
import { withQuery } from '@/features/core/url';
import { routes } from '@/shared/contracts/routes';
import { ButtonLink } from '@/shared/ui/button-link';

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { project: projectId } = await params;
  const sp = await searchParams;
  const access = await requireProjectAccess(projectId, ['editor']);
  const project = await getProject(projectId);
  if (!project) notFound();
  const t = await getTranslations('projects');
  const here = routes.app.project(access.companySlug, projectId, 'overview');
  const editing = sp.mode === 'edit';

  // PM 화면용(편집자 권한) / 고객 미리보기용(고객과 같은 공개 범위 — viewer.as='customer' 로 provider 호출)
  const [staffView, previewView] = await Promise.all([
    loadProjectSummaries(projectId, access),
    loadProjectSummaries(projectId, { ...access, as: 'customer', canConfirm: false }),
  ]);

  return (
    <main data-screen-id="PM-03" className="flex flex-col gap-5">
      <Panel title={t('field.currentPhase')}>
        <p className="text-base font-medium">{project.currentPhase || t('overview.phaseEmpty')}</p>
      </Panel>

      <OverviewBlocks recent={staffView.recent} schedule={staffView.schedule} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            {editing ? t('home.editTitle') : t('home.preview')}
          </h2>
          {editing ? null : (
            <ButtonLink
              href={withQuery(here, { mode: 'edit' })}
              data-ui-key="home-edit-open"
              variant="outline"
            >
              <Pencil aria-hidden />
              {t('home.editTitle')}
            </ButtonLink>
          )}
        </div>
        {editing ? (
          <HomeEditor
            projectId={project.id}
            version={project.version}
            homeMessage={project.homeMessage}
            homeSections={project.homeSections}
            homeTheme={project.homeTheme}
            homeBackgroundFileId={project.homeBackgroundFileId}
            doneHref={here}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-3">
            <p className="text-muted-foreground text-meta mb-3 flex items-center gap-1.5">
              <Eye aria-hidden className="size-4" />
              {t('home.previewNotice')}
              {!project.isPublic ? ` ${t('home.privateProjectNotice')}` : ''}
            </p>
            <CustomerHomeBody project={project} blocks={previewView} />
          </div>
        )}
      </section>
    </main>
  );
}
