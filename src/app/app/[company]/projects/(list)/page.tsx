// src/app/app/[company]/projects/(list)/page.tsx (A · TASK-005) — PM-01 프로젝트 목록·검색·상태 필터·요약·생성 Sheet (REQ-010·011)
// 요약 수치는 목록 위 (목록과 같은 권한 범위) · 카드에 최근 현장 사진 (25번 시안)
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { ProjectCreateEntry } from '@/features/core/components/create-permission';
import { getCreatePermission } from '@/features/core/server/create-permission-queries';
import { getAccessContext } from '@/features/core';
import { countUnansweredRequests } from '@/features/requests/server/summary';
import { countEventsThisWeek } from '@/features/schedule/server/queries';
import { ProjectStatusBadge, VisibilityBadge } from '@/features/core/components/project-badges';
import { projectCovers } from '@/features/core/server/project-covers';
import { listProjects, projectStatusCounts } from '@/features/core/server/project-queries';
import { PROJECT_STATUSES, type ProjectStatus } from '@/shared/contracts/domain';
import { routes } from '@/shared/contracts/routes';
import { withQuery } from '@/features/core/url';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { ButtonLink } from '@/shared/ui/button-link';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { PageHeader, LoadMore } from '@/shared/ui/page-parts';
import { EmptyState, ErrorState, FilterEmptyState } from '@/shared/ui/states';
import { PeriodText } from '@/shared/ui/date-text';
import { ImageIcon } from 'lucide-react';

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
  const [list, counts, permission, unanswered, thisWeek] = await Promise.all([
    listProjects(staff.companyId, { q: sp.q, status, archived, cursor: sp.cursor }),
    projectStatusCounts(staff.companyId),
    // D-36: 담당자는 업체관리자가 준 생성 권한이 있을 때만 '생성', 없으면 '권한 요청'
    getCreatePermission(staff.companyId, staff.role, ctx.userId),
    // D-31: 내 미답변 요청 (같은 권한 범위 — RLS)
    countUnansweredRequests(staff.companyId),
    // 이번 주 일정 (편집 가능한 프로젝트 · 달력과 같은 주)
    countEventsThisWeek(ctx, staff.companyId),
  ]);
  const covers = await projectCovers(list.items.map((p) => p.id));
  const hasUnanswered = (unanswered ?? 0) > 0;
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
        // 담당자는 배정된 프로젝트만 보인다 → '내 담당 프로젝트'
        title={staff.role === 'pm' ? t('projects.screen.myAssigned') : t('projects.screen.list')}
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
          {/* 한 줄로 이어진 칸: 이름 왼쪽 · 숫자 오른쪽 (휴대폰은 3칸씩 두 줄) */}
          <ul className="bg-card grid grid-cols-3 overflow-hidden rounded-lg border lg:grid-cols-6">
            {PROJECT_STATUSES.map((s, i) => (
              <li
                key={s}
                className={cn(
                  'min-w-0',
                  i % 3 !== 0 && 'border-l',
                  i > 0 && 'lg:border-l',
                  i >= 3 && 'max-lg:border-t',
                )}
              >
                <Link
                  href={routes.app.projects(slug, { status: s })}
                  aria-current={status === s ? 'page' : undefined}
                  className={cn(
                    'hover:bg-muted/60 flex h-full items-baseline justify-between gap-2 px-3 py-3 md:px-4',
                    status === s && 'bg-accent',
                  )}
                  data-ui-key="project-summary-filter"
                  data-key={s}
                >
                  <span className="text-muted-foreground truncate text-[13px]">
                    {t(`projects.status.${s}`)}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">{counts[s]}</span>
                </Link>
              </li>
            ))}
            <li className="min-w-0 border-l max-lg:border-t">
              {/* D-31: 답할 요청이 있으면 강조 */}
              <div
                className={cn(
                  'flex h-full items-baseline justify-between gap-2 px-3 py-3 md:px-4',
                  hasUnanswered && 'bg-tone-attention-bg',
                )}
                data-ui-key="project-summary-unanswered"
                data-state={hasUnanswered ? 'attention' : 'none'}
              >
                <span
                  className={cn(
                    'truncate text-[13px]',
                    hasUnanswered ? 'text-tone-attention-fg' : 'text-muted-foreground',
                  )}
                >
                  {t('projects.list.unanswered')}
                </span>
                <span
                  className={cn(
                    'text-lg font-semibold tabular-nums',
                    hasUnanswered && 'text-tone-attention-fg',
                  )}
                >
                  {unanswered ?? '—'}
                </span>
              </div>
            </li>
            <li className="min-w-0 border-l max-lg:border-t">
              <div
                className="flex h-full items-baseline justify-between gap-2 px-3 py-3 md:px-4"
                data-ui-key="project-summary-this-week"
              >
                <span className="text-muted-foreground truncate text-[13px]">
                  {t('projects.list.thisWeekEvents')}
                </span>
                <span className="text-lg font-semibold tabular-nums">{thisWeek ?? '—'}</span>
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
        // 카드 격자 (모바일 1열 · sm 2열 · xl 3열) — 위에 최근 현장 사진
        <ul className="grid gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-3">
          {list.items.map((p) => {
            const cover = covers.get(p.id);
            return (
              <li key={p.id} data-key={p.id} className="min-w-0">
                <Link
                  href={routes.app.project(slug, p.id)}
                  className="bg-card hover:border-foreground/25 flex h-full flex-col overflow-hidden rounded-lg border transition-colors"
                  data-ui-key="project-list-open"
                >
                  <span className="bg-muted text-muted-foreground grid aspect-[16/9] place-items-center overflow-hidden">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element -- /api/files 가 권한 확인 후 서명 주소로 보낸다
                      <img
                        src={routes.file(cover)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon aria-hidden className="size-6" />
                    )}
                  </span>
                  <span className="flex flex-1 flex-col justify-between gap-3 p-4">
                    <span className="block min-w-0">
                      <span className="block truncate text-base font-semibold">{p.name}</span>
                      <span className="text-muted-foreground mt-1 block truncate text-sm">
                        {p.siteAddress || '—'}
                      </span>
                      <span className="text-muted-foreground block truncate text-sm">
                        <PeriodText
                          from={p.startDate}
                          until={p.endDate}
                          emptyLabel={t('projects.list.noPeriod')}
                        />
                        {p.currentPhase ? ` · ${p.currentPhase}` : null}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap gap-1.5">
                      <ProjectStatusBadge status={p.status} />
                      <VisibilityBadge isPublic={p.isPublic} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <LoadMore href={nextHref} />
    </main>
  );
}
