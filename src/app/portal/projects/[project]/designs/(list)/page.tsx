// CL-04 도안 목록 (고객, D3) — 공개분만 (RLS) · REQ-100
// CU-03 · CU-04: 대표 도안 크게 → 누르면 공간 칩 + 공간별 도안 (?space=)
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { countItemMemos } from '@/features/requests/server/queries';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { requireCustomerOf } from '@/features/designs/server/access';
import { listDesigns } from '@/features/designs/server/queries';
import { CustomerDesignBrowser } from '@/features/designs/components/CustomerDesignBrowser';
import { one, parseLimit, withQuery } from '@/features/designs/lib/query';

export default async function PortalDesignsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { project } = await params;
  const access = await requireCustomerOf(project);
  const sp = await searchParams;
  const limit = parseLimit(sp.limit);
  const space = one(sp.space);
  const ctx = await getAccessContext();
  const [{ items, hasMore }, memoCounts] = await Promise.all([
    listDesigns(project, access, { limit }),
    // CU-04: 카드에 내 메모 수
    countItemMemos(project, access, ctx.userId, 'designs'),
  ]);
  const t = await getTranslations('designs');
  return (
    <main data-screen-id="CL-04" className="flex min-w-0 flex-col gap-6">
      <SectionHeader title={t('screen.list')} />
      <CustomerDesignBrowser
        items={items}
        viewer={access}
        spaceParam={space}
        memoCounts={memoCounts}
      />
      <LoadMore
        href={
          hasMore
            ? withQuery(routes.portal.project(project, 'designs'), {
                limit: limit + PAGE_SIZE,
                space,
              })
            : null
        }
        uiKey="design-list-more"
      />
    </main>
  );
}
