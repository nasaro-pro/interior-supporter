// src/app/app/[company]/history/(list)/page.tsx (A · TASK-014, REQ-030) — PM-40 변경이력: 기간·프로젝트·대상 종류 필터, 권한 범위만
// 고객·시공팀에게 노출하지 않는다 (PM 영역 셸 = 업체 구성원만)
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { listAuditEvents } from '@/features/core/server/history-queries';
import { isUuid } from '@/features/core/server/access';
import { listSwitcherProjects } from '@/features/core/server/project-queries';
import { withQuery } from '@/features/core/url';
import { routes } from '@/shared/contracts/routes';
import { Button } from '@/shared/ui/button';
import { ButtonLink } from '@/shared/ui/button-link';
import { DateText } from '@/shared/ui/date-text';
import { Input } from '@/shared/ui/input';
import { NativeSelect } from '@/shared/ui/native-fields';
import { LoadMore, PageHeader } from '@/shared/ui/page-parts';
import { EmptyState, ErrorState, FilterEmptyState } from '@/shared/ui/states';

const OBJECT_TYPES = [
  'projects',
  'project_participants',
  'invitations',
  'clients',
  'client_projects',
  'companies',
  'company_settings',
  'company_members',
  'designs',
  'design_versions',
  'design_previews',
  'materials',
  'estimates',
  'estimate_versions',
  'confirmations',
  'requests',
  'request_corrections',
  'request_replies',
  'photos',
  'schedule_events',
] as const;

type SP = { project?: string; type?: string; from?: string; to?: string; cursor?: string };

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<SP>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const sp = await searchParams;
  const slug = decodeURIComponent(company);
  const t = await getTranslations();
  const objectType = (OBJECT_TYPES as readonly string[]).includes(sp.type ?? '')
    ? sp.type
    : undefined;
  const [list, projects] = await Promise.all([
    listAuditEvents(staff.companyId, {
      projectId: sp.project && isUuid(sp.project) ? sp.project : undefined,
      objectType,
      from: sp.from,
      to: sp.to,
      cursor: sp.cursor,
    }),
    listSwitcherProjects(staff.companyId),
  ]);
  const listHref = routes.app.history(slug);
  const filtered = Boolean(sp.project || objectType || sp.from || sp.to);

  return (
    <main data-screen-id="PM-40" className="flex flex-col gap-6">
      <PageHeader title={t('history.screen.list')} description={t('history.list.staffOnly')} />
      <form
        method="get"
        action={listHref}
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <div>
          <label htmlFor="hf-project" className="text-meta text-muted-foreground">
            {t('history.field.project')}
          </label>
          <NativeSelect id="hf-project" name="project" defaultValue={sp.project ?? ''}>
            <option value="">{t('common.filter.all')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="hf-type" className="text-meta text-muted-foreground">
            {t('history.field.object')}
          </label>
          <NativeSelect id="hf-type" name="type" defaultValue={objectType ?? ''}>
            <option value="">{t('common.filter.all')}</option>
            {OBJECT_TYPES.map((o) => (
              <option key={o} value={o}>
                {t(`history.objectType.${o}`)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="hf-from" className="text-meta text-muted-foreground">
            {t('history.field.from')}
          </label>
          <Input id="hf-from" name="from" type="date" defaultValue={sp.from ?? ''} />
        </div>
        <div>
          <label htmlFor="hf-to" className="text-meta text-muted-foreground">
            {t('history.field.to')}
          </label>
          <Input id="hf-to" name="to" type="date" defaultValue={sp.to ?? ''} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" data-ui-key="history-filter-apply">
            {t('common.action.apply')}
          </Button>
          {filtered ? (
            <ButtonLink href={listHref} data-ui-key="history-filter-reset" variant="ghost">
              {t('common.action.resetFilters')}
            </ButtonLink>
          ) : null}
        </div>
      </form>

      {list.error ? (
        <ErrorState />
      ) : list.items.length === 0 ? (
        filtered ? (
          <FilterEmptyState
            action={
              <ButtonLink
                href={listHref}
                data-ui-key="history-filter-reset-empty"
                variant="outline"
              >
                {t('common.action.resetFilters')}
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState title={t('history.list.empty')} />
        )
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {list.items.map((e) => (
            <li key={e.id} data-key={e.id}>
              <Link
                href={routes.app.historyEvent(slug, e.id)}
                className="hover:bg-accent/60 flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                data-ui-key="history-event-open"
              >
                <span className="min-w-0">
                  <span className="font-medium">
                    {t(`history.objectType.${e.objectType}` as 'history.objectType.projects')} ·{' '}
                    {t(`history.eventType.${e.eventType}` as 'history.eventType.created')}
                  </span>
                  <span className="text-muted-foreground text-meta block truncate">
                    {e.projectName ?? '—'} · {e.actorName ?? t('history.actor.system')}
                  </span>
                </span>
                <span className="text-muted-foreground text-meta shrink-0">
                  <DateText value={e.occurredAt} />
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
                project: sp.project,
                type: objectType,
                from: sp.from,
                to: sp.to,
                cursor: list.nextCursor,
              })
            : null
        }
      />
    </main>
  );
}
