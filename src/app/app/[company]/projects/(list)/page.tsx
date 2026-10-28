// src/app/app/[company]/projects/(list)/page.tsx (A · TASK-005) — PM-01 프로젝트 목록·검색·상태 필터·요약·생성 Sheet (REQ-010·011)
// 별도 대시보드 없음 — 요약 수치는 목록 위 (목록과 같은 권한 범위)
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { ProjectCreateEntry } from '@/features/core/components/create-permission';
import { getCreatePermission } from '@/features/core/server/create-permission-queries';
import { getAccessContext } from '@/features/core';
import { countUnansweredRequests } from '@/features/requests/server/summary';
import { ProjectStatusBadge, VisibilityBadge } from '@/features/core/components/project-badges';
import { listProjects, projectStatusCounts } from '@/features/core/server/project-queries';
import { PROJECT_STATUSES, type ProjectStatus } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { withQuery } from '@/features/core/url';
import { Button } from '@/shared/ui/button';
import { ButtonLink } from '@/shared/ui/button-link';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { PageHeader, LoadMore } from '@/shared/ui/page-parts';
import { EmptyState, ErrorState, FilterEmptyState } from '@/shared/ui/states';
import { PeriodText } from '@/shared/ui/date-text';

type SP = { q?: string; status?: string; archived?: string; cursor?: string; mode?: string };

export default async function ProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<SP>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const sp = await searchParams;
  const slug = staff.slug; // A-09: 정규 주소명 (URL 대소문자와 무관)
  const t = await getTranslations();
  const status = (PROJECT_STATUSES as readonly string[]).includes(sp.status ?? '')
    ? (sp.status as ProjectStatus)
    : undefined;
  const archived = sp.archived === '1';
  const ctx = await getAccessContext();
  const [list, counts, permission, unanswered] = await Promise.all([
    listProjects(staff.companyId, { q: sp.q, status, archived, cursor: sp.cursor }),
    projectStatusCounts(staff.companyId),
    // D-36: 담당자는 업체관리자가 준 생성 권한이 있을 때만 '생성', 없으면 '권한 요청'
    getCreatePermission(staff.companyId, staff.role, ctx.userId),
    // D-31: 내 미답변 요청 (같은 권한 범위 — RLS)
    countUnansweredRequests(staff.companyId),
  ]);
  const filtered = Boolean(sp.q || status || archived);
  const listHref = routes.app.projects(slug);
  const nextHref = list.nextCursor
    ? withQuery(listHref, {
        q: sp.q,
        status,
        archived: archived ? '1' : undefined,
        cursor: list.nextCursor,
      })
    : null;

  return (
    <main data-screen-id="PM-01" className="flex flex-col gap-6">
      <PageHeader
        title={t('projects.screen.list')}
        actions={
          <ProjectCreateEntry
            companySlug={slug}
            companyId={staff.companyId}
            allowed={permission.allowed}
            pending={permission.pending}
          />
        }
      />

      {counts ? (
        <section aria-label={t('projects.list.summaryTitle')}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PROJECT_STATUSES.map((s) => (
              <li key={s}>
                <Link
                  href={routes.app.projects(slug, { status: s })}
                  className="bg-card hover:bg-accent flex flex-col gap-1 rounded-lg border p-3 shadow-sm"
                  data-ui-key="project-summary-filter"
                  data-key={s}
                >
                  <span className="text-muted-foreground text-meta">
                    {t(`projects.status.${s}`)}
                  </span>
                  <span className="text-2xl font-semibold tabular-nums">{counts[s]}</span>
                </Link>
              </li>
            ))}
            <li>
              <div
                className="bg-card flex flex-col gap-1 rounded-lg border p-3 shadow-sm"
                data-ui-key="project-summary-unanswered"
              >
                <span className="text-muted-foreground text-meta">
                  {t('projects.list.unanswered')}
                </span>
                <span className="text-2xl font-semibold tabular-nums">{unanswered ?? '—'}</span>
              </div>
            </li>
          </ul>
        </section>
      ) : null}

      <form method="get" action={listHref} className="flex flex-wrap items-end gap-2" role="search">
        <div className="min-w-48 flex-1">
          <label htmlFor="pf-q" className="sr-only">
            {t('common.action.search')}
          </label>
          <Input
            id="pf-q"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder={t('projects.list.searchPlaceholder')}
          />
        </div>
        <div className="w-36">
          <label htmlFor="pf-status" className="sr-only">
            {t('projects.list.statusLabel')}
          </label>
          <NativeSelect id="pf-status" name="status" defaultValue={status ?? ''}>
            <option value="">{t('common.filter.all')}</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`projects.status.${s}`)}
              </option>
            ))}
          </NativeSelect>
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
        <Button type="submit" variant="secondary" data-ui-key="project-filter-apply">
          {t('common.action.apply')}
        </Button>
        {filtered ? (
          <ButtonLink href={listHref} data-ui-key="project-filter-reset" variant="ghost">
            {t('common.action.resetFilters')}
          </ButtonLink>
        ) : null}
      </form>

      {list.error ? (
        <ErrorState
          action={
            <ButtonLink href={listHref} data-ui-key="project-list-retry" variant="outline">
              {t('common.action.retry')}
            </ButtonLink>
          }
        />
      ) : list.items.length === 0 ? (
        filtered ? (
          <FilterEmptyState
            action={
              <ButtonLink
                href={listHref}
                data-ui-key="project-filter-reset-empty"
                variant="outline"
              >
                {t('common.action.resetFilters')}
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            title={t('projects.list.empty')}
            action={
              permission.allowed ? (
                <ButtonLink
                  href={withQuery(listHref, { mode: 'new' })}
                  data-ui-key="project-empty-create"
                >
                  {t('projects.list.create')}
                </ButtonLink>
              ) : (
                <ProjectCreateEntry
                  companySlug={slug}
                  companyId={staff.companyId}
                  allowed={false}
                  pending={permission.pending}
                />
              )
            }
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {list.items.map((p) => (
            <li key={p.id} data-key={p.id}>
              <Link
                href={routes.app.project(slug, p.id)}
                className="bg-card hover:bg-accent/60 flex flex-col gap-2 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                data-ui-key="project-list-open"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-meta truncate">
                    {p.siteAddress || '—'} ·{' '}
                    <PeriodText
                      from={p.startDate}
                      until={p.endDate}
                      emptyLabel={t('projects.list.noPeriod')}
                    />
                  </p>
                  {p.currentPhase ? (
                    <p className="text-meta mt-0.5">
                      {t('projects.field.currentPhase')}: {p.currentPhase}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <ProjectStatusBadge status={p.status} />
                  <VisibilityBadge isPublic={p.isPublic} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <LoadMore href={nextHref} />
    </main>
  );
}
