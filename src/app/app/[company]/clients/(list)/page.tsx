// src/app/app/[company]/clients/(list)/page.tsx (A · TASK-013, REQ-020) — PM-20 고객 관리 (고객 아래 업무 복제 없음)
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { ClientCreateSheet } from '@/features/core/components/client-forms';
import { listClients } from '@/features/core/server/client-queries';
import { withQuery } from '@/features/core/url';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';
import { ButtonLink } from '@/shared/ui/button-link';
import { Input } from '@/shared/ui/input';
import { LoadMore, PageHeader } from '@/shared/ui/page-parts';
import { EmptyState, ErrorState, FilterEmptyState } from '@/shared/ui/states';

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ q?: string; archived?: string; cursor?: string; mode?: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const sp = await searchParams;
  const slug = staff.slug; // A-09: 정규 주소명 (URL 대소문자와 무관)
  const t = await getTranslations();
  const archived = sp.archived === '1';
  const list = await listClients(staff.companyId, { q: sp.q, archived, cursor: sp.cursor });
  const listHref = routes.app.clients(slug);
  const filtered = Boolean(sp.q || archived);

  return (
    <main data-screen-id="PM-20" className="flex flex-col gap-6">
      <PageHeader
        title={t('clients.screen.list')}
        description={t('clients.detail.cardVsAccount')}
        actions={<ClientCreateSheet companySlug={slug} />}
      />
      <form method="get" action={listHref} role="search" className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="cf-q" className="sr-only">
            {t('common.action.search')}
          </label>
          <Input
            id="cf-q"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder={t('clients.list.searchPlaceholder')}
          />
        </div>
        <label className="inline-flex h-8 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="archived"
            value="1"
            defaultChecked={archived}
            className="accent-primary size-4"
          />
          {t('common.filter.archived')}
        </label>
        <Button type="submit" variant="secondary" data-ui-key="client-filter-apply">
          {t('common.action.apply')}
        </Button>
        {filtered ? (
          <ButtonLink href={listHref} data-ui-key="client-filter-reset" variant="ghost">
            {t('common.action.resetFilters')}
          </ButtonLink>
        ) : null}
      </form>
      {list.error ? (
        <ErrorState />
      ) : list.items.length === 0 ? (
        filtered ? (
          <FilterEmptyState
            action={
              <ButtonLink href={listHref} data-ui-key="client-filter-reset-empty" variant="outline">
                {t('common.action.resetFilters')}
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title={t('clients.list.empty')}
            action={
              <ButtonLink
                href={withQuery(listHref, { mode: 'new' })}
                data-ui-key="client-empty-create"
              >
                {t('clients.list.create')}
              </ButtonLink>
            }
          />
        )
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {list.items.map((c) => (
            <li key={c.id} data-key={c.id}>
              <Link
                href={routes.app.client(slug, c.id)}
                className="hover:bg-accent/60 flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                data-ui-key="client-list-open"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground text-meta">
                  {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <LoadMore
        href={
          list.nextCursor
            ? withQuery(listHref, {
                q: sp.q,
                archived: archived ? '1' : undefined,
                cursor: list.nextCursor,
              })
            : null
        }
      />
    </main>
  );
}
