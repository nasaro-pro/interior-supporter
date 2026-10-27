// src/app/field/sites/[project]/page.tsx — 현장 입구: 켜진 첫 탭으로, 켜진 탭이 없으면 현장 사진으로 이동
import { notFound, redirect } from 'next/navigation';
import { requireProjectAccess } from '@/features/core';
import { getFieldSite } from '@/features/field/server/queries';
import { routes } from '@/shared/contracts/routes';

export default async function FieldSiteEntry({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectId } = await params;
  await requireProjectAccess(projectId, ['field']);
  const site = await getFieldSite(projectId);
  if (!site) notFound();
  const first = site.tabs[0];
  redirect(first ? routes.field.site(projectId, first) : routes.field.photos(projectId));
}
