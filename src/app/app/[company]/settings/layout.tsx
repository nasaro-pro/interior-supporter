// src/app/app/[company]/settings/layout.tsx (A · TASK-015·016) — PM-60 설정: 업체 정보·구성원·기본 템플릿·저장공간 분류 탭
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { ProjectTabsNav } from '@/features/core/components/project-shell';
import { routes } from '@/shared/contracts/routes';
import { PageHeader } from '@/shared/ui/page-parts';

const SECTIONS = ['company', 'members', 'templates', 'storage'] as const;

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  await requireCompanyStaff(company);
  const slug = decodeURIComponent(company);
  const t = await getTranslations('settings');
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t('screen.root')} />
      <ProjectTabsNav
        tabs={SECTIONS.map((s) => ({
          key: s,
          label: t(`screen.${s}`),
          href: routes.app.settings(slug, s),
        }))}
      />
      {children}
    </div>
  );
}
