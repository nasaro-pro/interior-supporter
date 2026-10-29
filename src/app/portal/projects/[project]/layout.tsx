// src/app/portal/projects/[project]/layout.tsx (A · TASK-003) — CL-02 고객 프로젝트 컨테이너: 헤더·탭 (홈 | 도안 | 자재 | 요청 | 사진 | 일정 | 견적)
// 유효 고객 참여 + 프로젝트 공개 + 미보관이 아니면 404 (POL-004)
// 페이지 분위기·탭별 이미지(CR-A-10)는 PortalPageCanvas 가 그린다 — 각 탭 화면(B·C)은 바꾸지 않는다
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireProjectAccess } from '@/features/core';
import { ProjectHeader } from '@/features/core/components/project-header';
import { PortalPageCanvas } from '@/features/core/components/portal-page-canvas';
import { ProjectTabsNav } from '@/features/core/components/project-shell';
import { getProject, getProjectHeader } from '@/features/core/server/project-queries';
import { PORTAL_TABS } from '@/shared/contracts/screens';
import { routes } from '@/shared/contracts/routes';
import { CustomerPreviewBanner } from '@/features/core/components/customer-preview';

export default async function PortalProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  const access = await requireProjectAccess(projectId, ['customer']);
  const [project, detail, t] = await Promise.all([
    getProjectHeader(projectId),
    getProject(projectId),
    getTranslations(),
  ]);
  if (!project || !detail) notFound();
  return (
    <PortalPageCanvas tone={detail.pageTone} images={detail.pageImages} key={projectId}>
      {access.preview ? (
        <CustomerPreviewBanner projectId={projectId} isPublic={detail.isPublic} />
      ) : null}
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
    </PortalPageCanvas>
  );
}
