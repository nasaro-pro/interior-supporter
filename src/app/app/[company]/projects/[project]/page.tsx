// src/app/app/[company]/projects/[project]/page.tsx (A · TR-01) — PM-02 는 빈 중간 화면 없이 PM-03 개요로
import { redirect } from 'next/navigation';
import { routes } from '@/shared/contracts/routes';

export default async function ProjectContainerPage({
  params,
}: {
  params: Promise<{ company: string; project: string }>;
}) {
  const { company, project } = await params;
  redirect(routes.app.project(decodeURIComponent(company), project, 'overview'));
}
