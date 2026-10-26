// src/app/admin/(console)/page.tsx — ADM-01 대시보드 (A3). 승인·결정 대기를 맨 위에
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { StatGrid } from '@/features/admin/components/StatGrid';
import { formatBytes } from '@/features/admin/lib/bytes';
import { getDashboard } from '@/features/admin/server/queries';
import { routes } from '@/shared/contracts/routes';
import { PageHeader } from '@/shared/ui/page-parts';
import { Section } from '@/shared/ui/section';

export default async function AdminDashboardPage() {
  const [d, t] = await Promise.all([getDashboard(), getTranslations('admin')]);
  return (
    <main data-screen-id="ADM-01" className="flex flex-col gap-6">
      <PageHeader title={t('screen.dashboard')} />
      <Section title={t('dashboard.pending')} variant="card">
        <p className="text-muted-foreground">{t('dashboard.pendingEmpty')}</p>
        <p className="text-muted-foreground text-meta">{t('dashboard.pendingHint')}</p>
        {d.suspendedUsers > 0 ? (
          <Link href={routes.admin.users()} className="text-sm underline-offset-4 hover:underline">
            {t('dashboard.suspendedUsers', { count: d.suspendedUsers })}
          </Link>
        ) : null}
      </Section>
      <StatGrid
        items={[
          { key: 'companies', label: t('dashboard.companies'), value: d.companies },
          { key: 'users', label: t('dashboard.users'), value: d.users },
          { key: 'projects', label: t('dashboard.projects'), value: d.projects },
          { key: 'storage', label: t('dashboard.storage'), value: formatBytes(d.storageBytes) },
          { key: 'signups', label: t('dashboard.signups7d'), value: d.signups7d },
        ]}
      />
    </main>
  );
}
