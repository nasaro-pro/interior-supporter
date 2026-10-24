// PM-09 견적 목록 (D3) — REQ-130·131. 진행/보관함·더 보기는 화면 상태(query)
import { getTranslations } from 'next-intl/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';
import { EmptyState } from '@/shared/ui/states';
import { requireEditorIn } from '@/features/designs/server/access';
import { one, parseLimit, withQuery } from '@/features/designs/lib/query';
import { listEstimates } from '@/features/estimates/server/queries';
import { EstimateFormSheet } from '@/features/estimates/components/EstimateFormSheet';
import { EstimateList } from '@/features/estimates/components/EstimateList';

export default async function EstimatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { company, project } = await params;
  const access = await requireEditorIn(company, project);
  const sp = await searchParams;
  const archived = one(sp.archived) === '1';
  const limit = parseLimit(sp.limit);
  const { items, hasMore } = await listEstimates(project, access, { archived, limit });
  const t = await getTranslations('estimates');
  const tc = await getTranslations('common');
  const base = routes.app.project(access.companySlug, project, 'estimates');
  const create = (
    <EstimateFormSheet
      mode="create"
      projectId={project}
      companyId={access.companyId}
      companySlug={access.companySlug}
    />
  );

  return (
    <main data-screen-id="PM-09" className="flex min-w-0 flex-col gap-6">
      <SectionHeader title={t('screen.list')} actions={archived ? undefined : create} />
      <SegmentedTabs
        label={t('screen.list')}
        items={[
          {
            key: 'active',
            href: base,
            label: tc('filter.active'),
            current: !archived,
            uiKey: 'estimate-list-active',
          },
          {
            key: 'archived',
            href: withQuery(base, { archived: 1 }),
            label: tc('filter.archived'),
            current: archived,
            uiKey: 'estimate-list-archive-toggle',
          },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState
          title={archived ? tc('state.empty') : t('list.empty')}
          action={archived ? undefined : create}
        />
      ) : (
        <EstimateList items={items} viewer={access} />
      )}
      <LoadMore
        href={
          hasMore
            ? withQuery(base, { archived: archived ? 1 : undefined, limit: limit + PAGE_SIZE })
            : null
        }
        uiKey="estimate-list-more"
      />
    </main>
  );
}
