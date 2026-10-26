// src/app/admin/(console)/settings/page.tsx — ADM-05 사이트 설정 (A6)
import { getTranslations } from 'next-intl/server';
import { SiteSettingsForm } from '@/features/admin/components/SiteSettingsForm';
import { getSiteSettings } from '@/features/admin/server/queries';
import { DateText } from '@/shared/ui/date-text';
import { PageHeader } from '@/shared/ui/page-parts';
import { ErrorState } from '@/shared/ui/states';

export default async function AdminSettingsPage() {
  const [settings, t] = await Promise.all([getSiteSettings(), getTranslations('admin')]);
  return (
    <main data-screen-id="ADM-05" className="flex flex-col gap-6">
      <PageHeader
        title={t('screen.settings')}
        description={t('settings.description')}
        meta={
          settings
            ? t.rich('settings.updatedAt', { date: () => <DateText value={settings.updatedAt} /> })
            : undefined
        }
      />
      {settings ? <SiteSettingsForm settings={settings} /> : <ErrorState />}
    </main>
  );
}
