// src/app/admin/(console)/audit/page.tsx — ADM-07 관리 기록 (A8)
import { getTranslations } from 'next-intl/server';
import { AuditTable } from '@/features/admin/components/AuditTable';
import { listAudit } from '@/features/admin/server/queries';
import { PageHeader } from '@/shared/ui/page-parts';
import { EmptyState } from '@/shared/ui/states';
import { tableScrollClass } from '@/shared/ui/styles';

export default async function AdminAuditPage() {
  const [rows, t] = await Promise.all([listAudit(), getTranslations('admin')]);
  return (
    <main data-screen-id="ADM-07" className="flex flex-col gap-6">
      <PageHeader title={t('screen.audit')} description={t('audit.description')} />
      {rows.length === 0 ? (
        <EmptyState title={t('audit.empty')} />
      ) : (
        <div className={tableScrollClass}>
          <AuditTable rows={rows} />
        </div>
      )}
    </main>
  );
}
