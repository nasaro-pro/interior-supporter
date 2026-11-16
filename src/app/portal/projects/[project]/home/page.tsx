// src/app/portal/projects/[project]/home/page.tsx (A · TASK-009, REQ-016) — CL-03 고객 프로젝트 홈 = 마이페이지
// 2026-11 새 디자인: 공사 진행(+인사말) → 도안 → 최근 현장 사진 → 다음 일정 (순서 · 표시는 고객 홈 꾸미기 값)
// 공개 항목만 (B·C provider 가 고객 권한 RLS 로 조회). 비공개 제목·개수 노출 0 (A-T08). 견적은 홈에 보이지 않는다 (견적 탭)
import { notFound } from 'next/navigation';
import { requireProjectAccess } from '@/features/core';
import { CustomerHome } from '@/features/core/components/customer-home';
import { getProject } from '@/features/core/server/project-queries';

export default async function CustomerHomePage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  const access = await requireProjectAccess(projectId, ['customer']);
  const project = await getProject(projectId);
  if (!project) notFound();
  return (
    <main data-screen-id="CL-03">
      <CustomerHome project={project} access={access} />
    </main>
  );
}
