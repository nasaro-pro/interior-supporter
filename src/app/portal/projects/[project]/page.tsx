// src/app/portal/projects/[project]/page.tsx (A) — CL-02 는 빈 중간 화면 없이 CL-03 홈으로
import { redirect } from 'next/navigation';
import { routes } from '@/shared/contracts/routes';

export default async function PortalProjectPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  redirect(routes.portal.project(project, 'home'));
}
