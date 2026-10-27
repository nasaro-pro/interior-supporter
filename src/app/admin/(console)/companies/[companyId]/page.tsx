// src/app/admin/(console)/companies/[companyId]/page.tsx — ADM-03 업체 상세 (A4 소유자 변경 · A6 저장공간 한도)
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { OwnerChangeForm } from '@/features/admin/components/OwnerChangeForm';
import { QuotaForm } from '@/features/admin/components/QuotaForm';
import { formatBytes, usagePercent } from '@/features/admin/lib/bytes';
import { getCompany, listCompanyMembers } from '@/features/admin/server/queries';
import { isUuid } from '@/features/core/server/access';
import { routes } from '@/shared/contracts/routes';
import { Breadcrumbs, PageHeader } from '@/shared/ui/page-parts';
import { Section } from '@/shared/ui/section';

export default async function AdminCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  if (!isUuid(companyId)) notFound();
  const company = await getCompany(companyId);
  if (!company) notFound();
  const [members, t] = await Promise.all([listCompanyMembers(companyId), getTranslations('admin')]);
  const percent = usagePercent(company.storageBytes, company.quotaBytes);

  return (
    <main data-screen-id="ADM-03" className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: t('screen.companies'), href: routes.admin.companies() },
          { label: company.name },
        ]}
      />
      <PageHeader
        title={company.name}
        description={company.slug}
        meta={`${t('company.owner')}: ${company.ownerName ?? t('company.ownerNone')}`}
      />
      <Section title={t('company.changeOwner')} variant="card">
        <OwnerChangeForm companyId={company.id} members={members} />
      </Section>
      <Section
        title={t('company.quotaTitle')}
        description={`${t('company.storage')} ${formatBytes(company.storageBytes)}${
          company.quotaBytes
            ? ` / ${formatBytes(company.quotaBytes)} (${percent}%)`
            : ` · ${t('company.quotaNone')}`
        }`}
        variant="card"
      >
        <QuotaForm companyId={company.id} quotaBytes={company.quotaBytes} />
      </Section>
    </main>
  );
}
