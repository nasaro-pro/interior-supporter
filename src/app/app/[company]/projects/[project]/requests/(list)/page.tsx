// PM-06 요청 목록 (D3) — REQ-200. 프로젝트 헤더(h1) 아래 탭 본문이므로 구획 제목은 h2
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireProjectAccess } from '@/features/core';
import { RequestFilters } from '@/features/requests/components/RequestFilters';
import { RequestList } from '@/features/requests/components/RequestList';
import {
  parseRequestListParams,
  requestListHref,
  type SearchParams,
} from '@/features/requests/lib/list-params';
import { listRequests } from '@/features/requests/server/queries';
import { PAGE_SIZE } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { LoadMore } from '@/shared/ui/page-parts';
import { SectionHeader } from '@/shared/ui/section';
import { EmptyState, FilterEmptyState } from '@/shared/ui/states';

type Props = {
  params: Promise<{ company: string; project: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('requests');
  return { title: t('screen.list') };
}

export default async function PmRequestListPage({ params, searchParams }: Props) {
  const { company, project } = await params;
  const access = await requireProjectAccess(project, ['editor']);
  if (access.companySlug !== company) notFound();
  const ctx = await getAccessContext();
  const filters = parseRequestListParams(await searchParams, access.as);
  const { items, hasMore } = await listRequests(project, access, filters, ctx.userId);
  const t = await getTranslations();
  const base = routes.app.project(company, project, 'requests');
  const filtered = filters.q !== '' || filters.status !== null;

  return (
    <main data-screen-id="PM-06" className="flex flex-col gap-4">
      <SectionHeader
        title={t('requests.screen.list')}
        meta={items.length > 0 ? t('common.list.count', { count: items.length }) : undefined}
      />
      <RequestFilters base={base} filters={filters} showArchiveTabs />
      {items.length === 0 ? (
        filtered ? (
          <FilterEmptyState
            message={t('common.state.filterEmpty')}
            resetHref={requestListHref(base, filters, { q: '', status: null, size: PAGE_SIZE })}
            resetLabel={t('common.action.resetFilters')}
          />
        ) : (
          <EmptyState
            title={filters.archived ? t('common.state.empty') : t('requests.list.empty')}
          />
        )
      ) : (
        <RequestList
          items={items}
          showAuthor
          detailHref={(id) => routes.app.request(company, project, id)}
        />
      )}
      <LoadMore
        href={hasMore ? requestListHref(base, filters, { size: filters.size + PAGE_SIZE }) : null}
        label={t('common.action.loadMore')}
      />
    </main>
  );
}
