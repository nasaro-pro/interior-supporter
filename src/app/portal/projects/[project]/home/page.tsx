// src/app/portal/projects/[project]/home/page.tsx (A · TASK-009, REQ-016) — CL-03 고객 프로젝트 홈
// 안내문 + 설정된 순서·표시의 4영역, 공개 항목만 (B·C provider 가 고객 권한 RLS 로 조회). 비공개 제목·개수 노출 0 (A-T08)
import { notFound } from 'next/navigation';
import { requireProjectAccess } from '@/features/core';
import { CustomerHomeBody } from '@/features/core/components/summary-blocks';
import { loadProjectSummaries } from '@/features/core/server/overview-queries';
import { getProject } from '@/features/core/server/project-queries';

export default async function CustomerHomePage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  const access = await requireProjectAccess(projectId, ['customer']);
  const [project, blocks] = await Promise.all([
    getProject(projectId),
    loadProjectSummaries(projectId, access),
  ]);
  if (!project) notFound();
  return (
    <main data-screen-id="CL-03">
      <CustomerHomeBody project={project} blocks={blocks} />
    </main>
  );
}
