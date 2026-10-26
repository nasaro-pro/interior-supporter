// src/app/portal/projects/[project]/layout.tsx (A · TASK-003) — CL-02 고객 프로젝트 컨테이너: 헤더·탭 (홈 | 도안 | 자재 | 요청 | 사진 | 일정 | 견적)
// 유효 고객 참여 + 프로젝트 공개 + 미보관이 아니면 404 (POL-004)
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { ProjectHeader } from '@/features/core/components/project-header';
import { ProjectTabsNav } from '@/features/core/components/project-shell';
import { getProjectHeader } from '@/features/core/server/project-queries';
import { PORTAL_TABS } from '@/shared/contracts/screens';
import { routes } from '@/shared/contracts/routes';

export default async function PortalProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  await requireProjectAccess(projectId, ['customer']);
  const [project, t] = await Promise.all([getProjectHeader(projectId), getTranslations()]);
  if (!project) notFound();
  return (
    <div className="flex flex-col gap-5" key={projectId}>
      <ProjectHeader
        project={project}
        breadcrumbs={[
          { label: t('projects.screen.myProjects'), href: routes.portal.projects() },
          { label: project.name },
        ]}
      />
      <ProjectTabsNav
        tabs={PORTAL_TABS.map((tab) => ({
          key: tab,
          // CU-06: 고객에게 요청 탭은 '메모 대화'
          label: tab === 'requests' ? t('projects.tab.memos') : t(`projects.tab.${tab}`),
          href: routes.portal.project(projectId, tab),
        }))}
      />
      {children}
    </div>
  );
}
