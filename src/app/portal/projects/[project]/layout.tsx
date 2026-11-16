// src/app/portal/projects/[project]/layout.tsx (A · TASK-003) — CL-02 고객 프로젝트 컨테이너: 머리 · 탭 (홈 | 도안 | 자재 | 메모 | 사진 | 일정 | 견적)
// 유효 고객 참여 + 프로젝트 공개 + 미보관이 아니면 404 (POL-004)
// 2026-11 새 디자인: 메인페이지와 같은 짜임의 머리 + 밑줄 탭. 제목 글꼴·굵기는 고객 홈 꾸미기 값 (customer-style.ts)
// 페이지 분위기·탭별 이미지(CR-A-10)는 PortalPageCanvas 가 그린다 — 각 탭 화면(B·C)은 바꾸지 않는다
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { customerTitleVars } from '@/features/core/customer-style';
import { PortalProjectHeader } from '@/features/core/components/portal-project-header';
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
  const [project, detail, t, ctx] = await Promise.all([
    getProjectHeader(projectId),
    getProject(projectId),
    getTranslations(),
    getAccessContext(),
  ]);
  if (!project || !detail) notFound();
  const homes = ctx.participations.filter((p) => p.role === 'customer').length;
  return (
    <div style={customerTitleVars(detail.titleFont, detail.titleWeight)}>
      <PortalPageCanvas tone={detail.pageTone} images={detail.pageImages} key={projectId}>
        {access.preview ? (
          <CustomerPreviewBanner projectId={projectId} isPublic={detail.isPublic} />
        ) : null}
        <PortalProjectHeader
          project={project}
          projectsHref={!access.preview && homes > 1 ? routes.portal.projects() : undefined}
        />
        <ProjectTabsNav
          variant="underline"
          tabs={PORTAL_TABS.map((tab) => ({
            key: tab,
            // CU-06: 고객에게 요청 탭은 '메모'
            label: tab === 'requests' ? t('projects.tab.memos') : t(`projects.tab.${tab}`),
            href: routes.portal.project(projectId, tab),
          }))}
        />
        <div className="pt-2 md:pt-4">{children}</div>
      </PortalPageCanvas>
    </div>
  );
}
