// PM-04 도안 목록 (D3) — REQ-100·101. 진행/보관함은 화면 상태(query) — 새 뎁스 아님
import { getTranslations } from 'next-intl/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { SegmentedTabs } from '@/shared/ui/segmented-tabs';
import { requireEditorIn } from '@/features/designs/server/access';
import { listDesigns } from '@/features/designs/server/queries';
import { DesignList } from '@/features/designs/components/DesignList';
import { DesignCreateButton } from '@/features/designs/components/DesignCreateButton';
import { one, parseLimit, withQuery } from '@/features/designs/lib/query';

export default async function DesignsPage({
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
  const { items, hasMore } = await listDesigns(project, access, { archived, limit });
  const t = await getTranslations('designs');
  const tc = await getTranslations('common');
  const base = routes.app.project(access.companySlug, project, 'designs');
  const create = (
    <DesignCreateButton
      projectId={project}
      companyId={access.companyId}
      companySlug={access.companySlug}
    />
  );

  return (
    <main data-screen-id="PM-04" className="flex min-w-0 flex-col gap-6">
      <SectionHeader title={t('screen.list')} actions={archived ? undefined : create} />
      <SegmentedTabs
        label={t('screen.list')}
        items={[
          {
            key: 'active',
            href: base,
            label: tc('filter.active'),
            current: !archived,
            uiKey: 'design-list-active',
          },
          {
            key: 'archived',
            href: withQuery(base, { archived: 1 }),
            label: tc('filter.archived'),
            current: archived,
            uiKey: 'design-list-archive-toggle',
          },
        ]}
      />
      <DesignList items={items} viewer={access} emptyAction={archived ? undefined : create} />
      <LoadMore
        href={
          hasMore
            ? withQuery(base, { archived: archived ? 1 : undefined, limit: limit + PAGE_SIZE })
            : null
        }
        uiKey="design-list-more"
      />
    </main>
  );
}
