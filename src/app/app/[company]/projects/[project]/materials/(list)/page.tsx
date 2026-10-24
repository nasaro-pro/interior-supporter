// PM-05 자재 목록 (D3) — REQ-110·111 · TR-02·03. 필터·진행/보관함·더 보기는 화면 상태(query)
import { getTranslations } from 'next-intl/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';
import { EmptyState, FilterEmptyState } from '@/shared/ui/states';
import { requireEditorIn } from '@/features/designs/server/access';
import { one, parseLimit, withQuery } from '@/features/designs/lib/query';
import { parseMaterialFilter } from '@/features/materials/schema';
import { listMaterialCategories, listMaterials } from '@/features/materials/server/queries';
import { MaterialFilters } from '@/features/materials/components/MaterialFilters';
import { MaterialFormSheet } from '@/features/materials/components/MaterialFormSheet';
import { MaterialList } from '@/features/materials/components/MaterialList';

export default async function MaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { company, project } = await params;
  const access = await requireEditorIn(company, project);
  const sp = await searchParams;
  const filter = parseMaterialFilter(sp);
  const archived = one(sp.archived) === '1';
  const limit = parseLimit(sp.limit);
  const [{ items, hasMore }, categories] = await Promise.all([
    listMaterials(project, access, filter, { archived, limit }),
    listMaterialCategories(project),
  ]);
  const t = await getTranslations('materials');
  const tc = await getTranslations('common');
  const base = routes.app.project(access.companySlug, project, 'materials');
  const filtered = !!(filter.category || filter.space || filter.q);
  const create = (
    <MaterialFormSheet
      mode="create"
      projectId={project}
      companyId={access.companyId}
      companySlug={access.companySlug}
      categories={categories}
    />
  );

  return (
    <main data-screen-id="PM-05" className="flex min-w-0 flex-col gap-6">
      <SectionHeader title={t('screen.list')} actions={archived ? undefined : create} />
      <SegmentedTabs
        label={t('screen.list')}
        items={[
          {
            key: 'active',
            href: base,
            label: tc('filter.active'),
            current: !archived,
            uiKey: 'material-list-active',
          },
          {
            key: 'archived',
            href: withQuery(base, { archived: 1 }),
            label: tc('filter.archived'),
            current: archived,
            uiKey: 'material-list-archive-toggle',
          },
        ]}
      />
      <MaterialFilters categories={categories} value={filter} />
      {items.length === 0 ? (
        filtered ? (
          <FilterEmptyState
            message={tc('state.filterEmpty')}
            resetHref={archived ? withQuery(base, { archived: 1 }) : base}
            resetLabel={tc('action.resetFilters')}
          />
        ) : (
          <EmptyState title={t('list.empty')} action={archived ? undefined : create} />
        )
      ) : (
        <MaterialList items={items} viewer={access} />
      )}
      <LoadMore
        href={
          hasMore
            ? withQuery(base, {
                ...filter,
                archived: archived ? 1 : undefined,
                limit: limit + PAGE_SIZE,
              })
            : null
        }
        uiKey="material-list-more"
      />
    </main>
  );
}
