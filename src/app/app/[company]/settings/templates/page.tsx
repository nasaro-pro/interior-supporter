// src/app/app/[company]/settings/templates/page.tsx (A · TASK-016, REQ-052) — PM-63 기본 템플릿 (신규 프로젝트 고객 홈 안내문·커버·테마·4영역 기본값, CR-A-10)
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { TemplateForm } from '@/features/core/components/settings-forms';
import { Panel } from '@/features/core/components/summary-blocks';
import { getCompanySettings } from '@/features/core/server/company-queries';
import { ForbiddenState } from '@/shared/ui/states';

export default async function TemplatesPage({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  if (staff.role !== 'owner' && staff.role !== 'manager') {
    return (
      <main data-screen-id="PM-63">
        <ForbiddenState />
      </main>
    );
  }
  const [settings, t] = await Promise.all([
    getCompanySettings(staff.companyId),
    getTranslations('settings'),
  ]);
  if (!settings) notFound();
  return (
    <main data-screen-id="PM-63">
      <Panel title={t('screen.templates')}>
        <TemplateForm
          companyId={settings.id}
          version={settings.settingsVersion}
          value={{
            homeMessage: settings.defaultHomeMessage,
            homeSections: settings.defaultHomeSections,
            homeTheme: settings.defaultHomeTheme,
            homeCoverFileId: settings.defaultHomeCoverFileId,
          }}
        />
      </Panel>
    </main>
  );
}
