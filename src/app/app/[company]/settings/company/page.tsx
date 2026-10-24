// src/app/app/[company]/settings/company/page.tsx (A · TASK-015, REQ-050) — PM-61 업체 정보·로고 (owner/manager)
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { CompanyInfoForm, LogoUploader } from '@/features/core/components/settings-forms';
import { Panel } from '@/features/core/components/summary-blocks';
import { getCompanySettings } from '@/features/core/server/company-queries';
import { routes } from '@/shared/contracts/routes';
import { ForbiddenState } from '@/shared/ui/states';

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const t = await getTranslations('settings');
  if (staff.role !== 'owner' && staff.role !== 'manager') {
    return (
      <main data-screen-id="PM-61">
        <ForbiddenState />
      </main>
    );
  }
  const settings = await getCompanySettings(staff.companyId);
  if (!settings) notFound();
  return (
    <main data-screen-id="PM-61" className="flex flex-col gap-5">
      <Panel title={t('field.logo')}>
        <LogoUploader
          companyId={settings.id}
          version={settings.version}
          logoUrl={settings.logoFileId ? routes.file(settings.logoFileId) : null}
        />
      </Panel>
      <Panel title={t('screen.company')}>
        <CompanyInfoForm
          companyId={settings.id}
          name={settings.name}
          version={settings.version}
          slug={settings.slug}
        />
      </Panel>
    </main>
  );
}
