// CL-04 도안 목록 (고객, D3) — 공개분만 (RLS) · REQ-100
import { getTranslations } from 'next-intl/server';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { requireCustomerOf } from '@/features/designs/server/access';
import { listDesigns } from '@/features/designs/server/queries';
import { DesignList } from '@/features/designs/components/DesignList';
import { parseLimit, withQuery } from '@/features/designs/lib/query';

export default async function PortalDesignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { project } = await params;
  const access = await requireCustomerOf(project);
  const limit = parseLimit((await searchParams).limit);
  const { items, hasMore } = await listDesigns(project, access, { limit });
  const t = await getTranslations('designs');
  return (
    <main data-screen-id="CL-04" className="flex min-w-0 flex-col gap-6">
      <SectionHeader title={t('screen.list')} />
      <DesignList items={items} viewer={access} />
      <LoadMore
        href={
          hasMore
            ? withQuery(routes.portal.project(project, 'designs'), { limit: limit + PAGE_SIZE })
            : null
        }
        uiKey="design-list-more"
      />
    </main>
  );
}
