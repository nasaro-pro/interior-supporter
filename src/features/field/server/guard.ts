// 시공팀 탭 화면 첫 줄 접근 검사 — 유효 배정(requireProjectAccess) + 담당자가 켠 탭인지. 아니면 404 (존재 숨김)
import 'server-only';
import { notFound } from 'next/navigation';
import { requireProjectAccess } from '@/features/core';
import type { FieldTab } from '@/shared/contracts/screens';
import type { FieldSiteDetail } from '../types';
import { getFieldSite } from './queries';

export async function requireFieldTab(projectId: string, tab: FieldTab): Promise<FieldSiteDetail> {
  await requireProjectAccess(projectId, ['field']);
  const site = await getFieldSite(projectId);
  if (!site || !site.tabs.includes(tab)) notFound();
  return site;
}
