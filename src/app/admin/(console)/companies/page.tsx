// src/app/admin/(console)/companies/page.tsx — ADM-02 업체 목록 (A4)
import { getTranslations } from 'next-intl/server';
import { CompanyTable } from '@/features/admin/components/CompanyTable';
import { SearchForm } from '@/features/admin/components/SearchForm';
import { searchSchema } from '@/features/admin/schema';
import { listCompanies } from '@/features/admin/server/queries';
import { routes } from '@/shared/contracts/routes';
import { PageHeader } from '@/shared/ui/page-parts';
import { EmptyState } from '@/shared/ui/states';
import { tableScrollClass } from '@/shared/ui/styles';

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = searchSchema.catch(undefined).parse((await searchParams).q);
  const [rows, t] = await Promise.all([listCompanies(q), getTranslations('admin')]);
  return (
    <main data-screen-id="ADM-02" className="flex flex-col gap-6">
      <PageHeader title={t('screen.companies')} />
      <SearchForm
        action={routes.admin.companies()}
        defaultValue={q}
        placeholder={t('search.companies')}
      />
      {rows.length === 0 ? (
        <EmptyState title={q ? t('search.empty') : t('company.empty')} />
      ) : (
        <div className={tableScrollClass}>
          <CompanyTable rows={rows} />
        </div>
      )}
    </main>
  );
}
