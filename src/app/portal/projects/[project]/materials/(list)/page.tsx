// CL-05 자재 목록 (고객, D3) — 공개분만 (RLS) · REQ-110
import { getTranslations } from 'next-intl/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { EmptyState, FilterEmptyState } from '@/shared/ui/states';
import { requireCustomerOf } from '@/features/designs/server/access';
import { parseLimit, withQuery } from '@/features/designs/lib/query';
import { parseMaterialFilter } from '@/features/materials/schema';
import { listMaterialCategories, listMaterials } from '@/features/materials/server/queries';
import { MaterialFilters } from '@/features/materials/components/MaterialFilters';
import { MaterialList } from '@/features/materials/components/MaterialList';

export default async function PortalMaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { project } = await params;
  const access = await requireCustomerOf(project);
  const sp = await searchParams;
  const filter = parseMaterialFilter(sp);
  const limit = parseLimit(sp.limit);
  const [{ items, hasMore }, categories] = await Promise.all([
    listMaterials(project, access, filter, { limit }),
    listMaterialCategories(project),
  ]);
  const t = await getTranslations('materials');
  const tc = await getTranslations('common');
  const base = routes.portal.project(project, 'materials');
  const filtered = !!(filter.category || filter.space || filter.q);
  return (
    <main data-screen-id="CL-05" className="flex min-w-0 flex-col gap-6">
      <SectionHeader title={t('screen.list')} />
      <MaterialFilters categories={categories} value={filter} />
      {items.length === 0 ? (
        filtered ? (
          <FilterEmptyState
            message={tc('state.filterEmpty')}
            resetHref={base}
            resetLabel={tc('action.resetFilters')}
          />
        ) : (
          <EmptyState title={t('list.emptyCustomer')} />
        )
      ) : (
        <MaterialList items={items} viewer={access} />
      )}
      <LoadMore
        href={hasMore ? withQuery(base, { ...filter, limit: limit + PAGE_SIZE }) : null}
        uiKey="material-list-more"
      />
    </main>
  );
}
