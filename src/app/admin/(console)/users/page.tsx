// src/app/admin/(console)/users/page.tsx — ADM-04 계정 관리 (A5)
import { getTranslations } from 'next-intl/server';
import { SearchForm } from '@/features/admin/components/SearchForm';
import { UserTable } from '@/features/admin/components/UserTable';
import { searchSchema } from '@/features/admin/schema';
import { listUsers } from '@/features/admin/server/queries';
import { getSessionUserId } from '@/features/core/server/access';
import { routes } from '@/shared/contracts/routes';
import { PageHeader } from '@/shared/ui/page-parts';
import { EmptyState } from '@/shared/ui/states';
import { tableScrollClass } from '@/shared/ui/styles';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = searchSchema.catch(undefined).parse((await searchParams).q);
  const [rows, t, selfId] = await Promise.all([
    listUsers(q),
    getTranslations('admin'),
    getSessionUserId(),
  ]);
  return (
    <main data-screen-id="ADM-04" className="flex flex-col gap-6">
      <PageHeader title={t('screen.users')} />
      <SearchForm action={routes.admin.users()} defaultValue={q} placeholder={t('search.users')} />
      {rows.length === 0 ? (
        <EmptyState title={q ? t('search.empty') : t('user.empty')} />
      ) : (
        <div className={tableScrollClass}>
          <UserTable rows={rows} selfId={selfId} />
        </div>
      )}
    </main>
  );
}
