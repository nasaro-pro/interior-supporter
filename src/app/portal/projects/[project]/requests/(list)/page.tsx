// CL-06 요청 목록 + 작성 Sheet (D3) — REQ-200, REQ-201. 고객은 본인이 쓴 요청만 (POL-018)
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { RequestCreateSheet } from '@/features/requests/components/RequestCreateSheet';
import { RequestFilters } from '@/features/requests/components/RequestFilters';
import { RequestList } from '@/features/requests/components/RequestList';
import {
  parseRequestListParams,
  requestListHref,
  withQuery,
  type SearchParams,
} from '@/features/requests/lib/list-params';
import { listRequests } from '@/features/requests/server/queries';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { ButtonLink } from '@/shared/ui/button-link';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { EmptyState, FilterEmptyState } from '@/shared/ui/states';

type Props = { params: Promise<{ project: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('requests');
  return { title: t('customer.title') };
}

export default async function PortalRequestListPage({ params, searchParams }: Props) {
  const { project } = await params;
  const access = await requireProjectAccess(project, ['customer']);
  const ctx = await getAccessContext();
  const filters = parseRequestListParams(await searchParams, access.as);
  const { items, hasMore } = await listRequests(project, access, filters, ctx.userId);
  const t = await getTranslations();
  const base = routes.portal.project(project, 'requests');
  const filtered = filters.q !== '' || filters.status !== null;

  return (
    <main data-screen-id="CL-06" className="flex flex-col gap-4">
      <SectionHeader
        title={t('requests.customer.title')}
        description={t('requests.customer.ownOnly')}
        meta={items.length > 0 ? t('common.list.count', { count: items.length }) : undefined}
        actions={<RequestCreateSheet projectId={project} />}
      />
      <RequestFilters base={base} filters={filters} showArchiveTabs={false} />
      {items.length === 0 ? (
        filtered ? (
          <FilterEmptyState
            message={t('common.state.filterEmpty')}
            resetHref={requestListHref(base, filters, { q: '', status: null, size: PAGE_SIZE })}
            resetLabel={t('common.action.resetFilters')}
          />
        ) : (
          <EmptyState
            title={t('requests.customer.empty')}
            action={
              <ButtonLink
                href={withQuery(base, { mode: 'new' })}
                data-ui-key="request-empty-create"
              >
                <Plus aria-hidden />
                {t('requests.customer.create')}
              </ButtonLink>
            }
          />
        )
      ) : (
        <RequestList
          items={items}
          showAuthor={false}
          detailHref={(id) => routes.portal.request(project, id)}
        />
      )}
      <LoadMore
        href={hasMore ? requestListHref(base, filters, { size: filters.size + PAGE_SIZE }) : null}
        label={t('common.action.loadMore')}
      />
    </main>
  );
}
