// src/app/admin/(console)/cleanup/page.tsx — ADM-06 자동 정리 (A7)
import { getTranslations } from 'next-intl/server';
import { CleanupPanel } from '@/features/admin/components/CleanupPanel';
import { listCleanupCandidates } from '@/features/admin/server/queries';
import { PageHeader } from '@/shared/ui/page-parts';

export default async function AdminCleanupPage() {
  const [files, t] = await Promise.all([listCleanupCandidates(), getTranslations('admin')]);
  return (
    <main data-screen-id="ADM-06" className="flex flex-col gap-6">
      <PageHeader title={t('screen.cleanup')} description={t('cleanup.description')} />
      <CleanupPanel files={files} />
    </main>
  );
}
