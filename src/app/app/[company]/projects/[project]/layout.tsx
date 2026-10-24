// src/app/app/[company]/projects/[project]/layout.tsx (A · TASK-003, REQ-012) — PM-02 프로젝트 컨테이너: 헤더·탭·전환
// B·C 는 탭 page.tsx 만 만든다 (integration.ts 2장). 권한 없거나 없는 프로젝트 → 404 (존재 숨김)
// 프로젝트를 바꾸면 key 로 하위 트리를 새로 그려 이전 프로젝트의 목록·필터·선택이 남지 않게 한다 (02 문서 4장)
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff, requireProjectAccess } from '@/features/core';
import { ProjectHeader } from '@/features/core/components/project-header';
import { ProjectSwitcher, ProjectTabsNav } from '@/features/core/components/project-shell';
import { VisibilityBadge } from '@/features/core/components/project-badges';
import { getProject, listSwitcherProjects } from '@/features/core/server/project-queries';
import { PROJECT_TABS } from '@/shared/contracts/screens';
import { routes } from '@/shared/contracts/routes';
import { StatusBadge } from '@/shared/ui/status-badge';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ company: string; project: string }>;
}) {
  const { company, project: projectId } = await params;
  const staff = await requireCompanyStaff(company);
  const access = await requireProjectAccess(projectId, ['editor']);
  if (access.companyId !== staff.companyId) notFound(); // 다른 업체 경로로 들어온 경우
  const slug = access.companySlug;
  const [project, switcher, t] = await Promise.all([
    getProject(projectId),
    listSwitcherProjects(staff.companyId),
    getTranslations(),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-5" key={projectId}>
      <ProjectHeader
        project={project}
        breadcrumbs={[
          { label: t('projects.screen.list'), href: routes.app.projects(slug) },
          { label: project.name },
        ]}
        extraBadges={
          <>
            <VisibilityBadge isPublic={project.isPublic} />
            {project.archivedAt ? (
              <StatusBadge status="private" label={t('common.filter.archived')} />
            ) : null}
          </>
        }
        switcher={
          <ProjectSwitcher
            current={projectId}
            currentName={project.name}
            currentArchived={Boolean(project.archivedAt)}
            options={switcher.map((p) => ({
              id: p.id,
              name: p.name,
              href: routes.app.project(slug, p.id),
            }))}
          />
        }
      />
      <ProjectTabsNav
        tabs={PROJECT_TABS.map((tab) => ({
          key: tab,
          label: t(`projects.tab.${tab}`),
          href: routes.app.project(slug, projectId, tab),
        }))}
      />
      {children}
    </div>
  );
}
