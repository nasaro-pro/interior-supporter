// src/app/field/sites/[project]/layout.tsx — 시공팀 현장 컨테이너 (F2·F13): 머리글·켜진 탭·페이지 분위기
// 유효 배정이 아니거나 끝난 현장은 404 (POL-006). 탭은 담당자가 켠 것만 + 현장 사진
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MapPin } from 'lucide-react';
import { requireProjectAccess } from '@/features/core';
import { PageCanvas } from '@/features/core/components/page-canvas';
import { ProjectTabsNav } from '@/features/core/components/project-shell';
import { getFieldSite } from '@/features/field/server/queries';
import { routes } from '@/shared/contracts/routes';
import { Breadcrumbs } from '@/shared/ui/page-parts';

export default async function FieldSiteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: projectId } = await params;
  await requireProjectAccess(projectId, ['field']);
  const [site, t] = await Promise.all([getFieldSite(projectId), getTranslations('field')]);
  if (!site) notFound();
  const tabs = [
    ...site.tabs.map((tab) => ({
      key: tab,
      label: t(`tab.${tab}`),
      href: routes.field.site(projectId, tab),
    })),
    { key: 'photos', label: t('tab.photos'), href: routes.field.photos(projectId) },
  ];
  return (
    <PageCanvas tone={site.pageTone} imageFileId={null} variant="fixed" key={projectId}>
      <div className="flex flex-col gap-2">
        <Breadcrumbs
          items={[{ label: t('screen.sites'), href: routes.field.home() }, { label: site.name }]}
        />
        <p className="text-2xl font-semibold tracking-tight wrap-anywhere">{site.name}</p>
        {site.siteAddress ? (
          <p className="text-muted-foreground text-meta flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {site.siteAddress}
          </p>
        ) : null}
      </div>
      <ProjectTabsNav tabs={tabs} />
      {children}
    </PageCanvas>
  );
}
