// CL-06 메모 (D3) — REQ-200, REQ-201. 고객은 본인이 쓴 요청만 (POL-018)
// 2026-11 새 디자인: 기본은 대화창 (메모 · 정정 · 디자이너 답을 시간 순 말풍선 + 아래 입력줄).
// 예전 목록(검색 · 상태 필터)은 ?view=list 로 그대로 남긴다 (오래된 메모 찾기)
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
import { ChatComposer } from '@/features/requests/components/ChatComposer';
import { MemoChat } from '@/features/requests/components/MemoChat';
import {
  listMemoConversation,
  listMemoTargets,
  listRequests,
} from '@/features/requests/server/queries';
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
  const sp = await searchParams;
  // 검색 · 필터 · 더 보기 값이 있으면 목록으로 (목록 화면의 GET 폼이 view 를 따로 싣지 않아도 목록에 머문다)
  const listMode = sp.view === 'list' || !!sp.q || !!sp.status || !!sp.size;
  if (!listMode) {
    const [t, { items: memos, hasMore }, targets] = await Promise.all([
      getTranslations('requests'),
      listMemoConversation(project, access, ctx.userId),
      access.preview ? Promise.resolve([]) : listMemoTargets(project),
    ]);
    const listHref = withQuery(routes.portal.project(project, 'requests'), { view: 'list' });
    return (
      <main data-screen-id="CL-06" className="mx-auto flex w-full max-w-[760px] flex-col py-6">
        <h2 className="sr-only">{t('customer.title')}</h2>
        <p className="text-muted-foreground mb-6 text-center text-xs">{t('chat.notice')}</p>
        {hasMore ? (
          <a
            href={listHref}
            className="text-muted-foreground hover:text-foreground mb-6 self-center text-sm underline-offset-2 hover:underline"
            data-ui-key="memo-chat-older"
          >
            {t('chat.olderLink')}
          </a>
        ) : null}
        {memos.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {access.preview ? t('chat.emptyPreview') : t('chat.empty')}
          </p>
        ) : (
          <MemoChat
            memos={memos}
            memoHref={(id) => routes.portal.request(project, id)}
            targetHref={(x) =>
              x.type === 'designs'
                ? routes.portal.design(project, x.id)
                : routes.portal.material(project, x.id)
            }
          />
        )}
        {access.preview ? null : (
          <div className="bg-background sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] mt-8 pt-3 pb-3 md:bottom-0 md:pb-6">
            <ChatComposer projectId={project} targets={targets} />
          </div>
        )}
      </main>
    );
  }
  const filters = parseRequestListParams(sp, access.as);
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
        actions={
          <>
            <ButtonLink href={base} variant="outline" data-ui-key="memo-chat-back">
              {t('requests.chat.backToChat')}
            </ButtonLink>
            {access.preview ? null : <RequestCreateSheet projectId={project} />}
          </>
        }
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
            title={
              access.preview ? t('requests.customer.emptyPreview') : t('requests.customer.empty')
            }
            action={
              access.preview ? undefined : (
                <ButtonLink
                  href={withQuery(base, { mode: 'new' })}
                  data-ui-key="request-empty-create"
                >
                  <Plus aria-hidden />
                  {t('requests.customer.create')}
                </ButtonLink>
              )
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
