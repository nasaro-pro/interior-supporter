// CL-09 견적 목록 (고객, D3) — 공개 버전이 있는 견적만 (RLS) · REQ-130
import { getTranslations } from 'next-intl/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { EmptyState } from '@/shared/ui/states';
import { requireCustomerOf } from '@/features/designs/server/access';
import { parseLimit, withQuery } from '@/features/designs/lib/query';
import { listEstimates } from '@/features/estimates/server/queries';
import { EstimateList } from '@/features/estimates/components/EstimateList';

export default async function PortalEstimatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { project } = await params;
  const access = await requireCustomerOf(project);
  const limit = parseLimit((await searchParams).limit);
  const { items, hasMore } = await listEstimates(project, access, { limit });
  const t = await getTranslations('estimates');
  return (
    <main data-screen-id="CL-09" className="flex min-w-0 flex-col gap-6">
      <SectionHeader title={t('screen.list')} />
      {items.length === 0 ? (
        <EmptyState title={t('list.emptyCustomer')} />
      ) : (
        <EstimateList items={items} viewer={access} />
      )}
      <LoadMore
        href={
          hasMore
            ? withQuery(routes.portal.project(project, 'estimates'), { limit: limit + PAGE_SIZE })
            : null
        }
        uiKey="estimate-list-more"
      />
    </main>
  );
}
