// 화면 진입 검사 래퍼 — URL 의 업체가 프로젝트 업체와 다르면 존재 숨김 (다른 업체로 묵시 이동 금지, 02 문서 4장)
import 'server-only';
import { notFound } from 'next/navigation';
import { requireProjectAccess } from '@/features/core';
import type { ProjectAccess } from '@/shared/contracts/integration';

export async function requireEditorIn(company: string, projectId: string): Promise<ProjectAccess> {
  const access = await requireProjectAccess(projectId, ['editor']);
  if (access.companySlug !== company) notFound();
  return access;
}

export function requireCustomerOf(projectId: string): Promise<ProjectAccess> {
  return requireProjectAccess(projectId, ['customer']);
}
