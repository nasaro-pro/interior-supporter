// src/app/field/page.tsx — FW-00 내 현장 (통합본 7장 F1, CR-11): 배정된 현장 카드, 카드에서 현장 탭·사진으로
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SiteCardList } from '@/features/field/components/SiteCardList';
import { listFieldSiteCards } from '@/features/field/server/queries';
import { PageHeader } from '@/shared/ui/page-parts';
import { EmptyState } from '@/shared/ui/states';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('field');
  return { title: t('screen.sites') };
}

export default async function FieldSitesPage() {
  const [sites, t] = await Promise.all([listFieldSiteCards(), getTranslations('field')]);
  return (
    <main data-screen-id="FW-00" className="flex flex-col gap-4">
      <PageHeader title={t('screen.sites')} description={t('sites.description')} />
      {sites.length === 0 ? (
        <EmptyState title={t('sites.empty')} description={t('sites.emptyHint')} />
      ) : (
        <SiteCardList sites={sites} />
      )}
    </main>
  );
}
