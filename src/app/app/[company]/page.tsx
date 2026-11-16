// src/app/app/[company]/page.tsx (A) — PM-00 업체 첫 화면(대시보드). 로그인 뒤 처음 보이는 화면
// 2026-11: 헌법 P-11 · REQ-010 · 02 문서 PM-00 에 반영된 업체 첫 화면
// 데이터는 모두 원본을 호출자 권한(RLS)으로 조회한다 (dashboard-queries.ts)
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireCompanyStaff } from '@/features/core';
import { DashboardHeader } from '@/features/core/components/dashboard/dashboard-header';
import { DashboardView } from '@/features/core/components/dashboard/dashboard-view';
import { getCreatePermission } from '@/features/core/server/create-permission-queries';
import {
  loadDashboard,
  parseDashboardTab,
  type DashboardTab,
} from '@/features/core/server/dashboard-queries';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const slug = staff.slug;
  const tab = parseDashboardTab((await searchParams).tab);
  const ctx = await getAccessContext();
  const [t, data, permission] = await Promise.all([
    getTranslations('projects.dashboard'),
    loadDashboard(
      ctx,
      { companyId: staff.companyId, slug },
      { photoLimit: tab === 'photos' ? 12 : 6 },
    ),
    getCreatePermission(staff.companyId, staff.role, ctx.userId),
  ]);
  const count: Record<DashboardTab, number | null> = {
    all: null,
    projects: data.counts?.active ?? null,
    requests: data.openRequests.length,
    schedule: data.weekEvents.length,
    documents: data.pendingDesigns.length,
    photos: null,
  };

  return (
    <main data-screen-id="PM-00" className="flex flex-col gap-6">
      <DashboardHeader slug={slug} tab={tab} count={count} canCreate={permission.allowed} />
      {data.failed ? (
        <p
          role="status"
          className="bg-tone-caution-bg text-tone-caution-fg rounded-lg px-4 py-2.5 text-sm"
        >
          {t('partial')}
        </p>
      ) : null}
      <DashboardView data={data} tab={tab} slug={slug} displayName={ctx.displayName} />
    </main>
  );
}
