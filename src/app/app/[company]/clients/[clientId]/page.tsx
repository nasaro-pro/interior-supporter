// src/app/app/[company]/clients/[clientId]/page.tsx (A · TASK-013, REQ-020·021·A-11·DB-08) — PM-21 고객 카드 상세
// 관련 프로젝트 선택 → PM-03 (TR-06). 고객 아래에 도안·요청·일정을 복제하지 않는다
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { ClientEditSheet, LinkProjectForm } from '@/features/core/components/client-forms';
import { ProjectStatusBadge } from '@/features/core/components/project-badges';
import { Panel } from '@/features/core/components/summary-blocks';
import { setClientArchived, unlinkClientProject } from '@/features/core/server/client-actions';
import {
  getClient,
  listClientProjects,
  listLinkableProjects,
} from '@/features/core/server/client-queries';
import { isUuid } from '@/features/core/server/access';
import { routes } from '@/shared/contracts/routes';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Notice } from '@/shared/ui/notice';
import { Breadcrumbs, PageHeader } from '@/shared/ui/page-parts';
import { StatusBadge } from '@/shared/ui/status-badge';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ company: string; clientId: string }>;
}) {
  const { company, clientId } = await params;
  const staff = await requireCompanyStaff(company);
  if (!isUuid(clientId)) notFound();
  // A-11: 경로 업체의 카드만 — 다른 업체 카드 id 는 404 (존재 숨김)
  const client = await getClient(clientId, staff.companyId);
  if (!client) notFound();
  const slug = staff.slug; // A-09: 정규 주소명 (URL 대소문자와 무관)
  const [projects, linkable, t] = await Promise.all([
    listClientProjects(clientId, staff.companyId),
    listLinkableProjects(staff.companyId),
    getTranslations(),
  ]);

  return (
    <main data-screen-id="PM-21" className="flex flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: t('clients.screen.list'), href: routes.app.clients(slug) },
          { label: client.name },
        ]}
      />
      <PageHeader
        title={client.name}
        meta={
          client.archivedAt ? (
            <StatusBadge status="private" label={t('common.filter.archived')} />
          ) : undefined
        }
        actions={
          <>
            <ClientEditSheet companySlug={slug} client={client} />
            <ConfirmDialog
              trigger={client.archivedAt ? t('common.action.restore') : t('common.action.archive')}
              title={
                client.archivedAt
                  ? t('clients.confirm.restore.title')
                  : t('common.confirm.archive.title')
              }
              body={
                client.archivedAt
                  ? t('clients.confirm.restore.body')
                  : t('common.confirm.archive.body')
              }
              confirmLabel={
                client.archivedAt ? t('common.action.restore') : t('common.action.archive')
              }
              successMessage={
                client.archivedAt ? t('common.toast.restored') : t('common.toast.archived')
              }
              action={setClientArchived.bind(null, slug, {
                clientId: client.id,
                baseVersion: client.version,
                archive: !client.archivedAt,
              })}
              uiKey="client-archive"
              destructive={!client.archivedAt}
            />
          </>
        }
      />

      {client.archivedAt ? (
        <Notice tone="caution" role="status" uiKey="client-archived-notice">
          {t('common.state.archivedItem')}
        </Notice>
      ) : null}

      <Panel title={t('clients.screen.detail')}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-meta">{t('clients.field.phone')}</dt>
            <dd>{client.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-meta">{t('clients.field.email')}</dt>
            <dd className="break-all">{client.email || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground text-meta">{t('clients.field.memo')}</dt>
            <dd className="whitespace-pre-line">{client.memo || '—'}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground text-meta mt-3">{t('clients.detail.cardVsAccount')}</p>
      </Panel>

      <Panel title={t('clients.field.projects')}>
        <div className="flex flex-col gap-4">
          {projects.length === 0 ? (
            <p className="text-muted-foreground">{t('clients.detail.noProjects')}</p>
          ) : (
            <ul className="divide-y">
              {projects.map((p) => (
                <li key={p.id} data-key={p.id} className="flex items-center gap-2">
                  <Link
                    href={routes.app.project(slug, p.id)}
                    className="hover:bg-accent/60 -mx-2 flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2 py-2.5"
                    data-ui-key="client-project-open"
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    <ProjectStatusBadge status={p.status} />
                  </Link>
                  <ConfirmDialog
                    trigger={t('clients.action.unlink')}
                    triggerVariant="ghost"
                    title={t('clients.confirm.unlink.title')}
                    body={t('clients.confirm.unlink.body', { project: p.name })}
                    confirmLabel={t('clients.action.unlink')}
                    successMessage={t('clients.toast.projectUnlinked')}
                    action={unlinkClientProject.bind(null, {
                      clientId: client.id,
                      projectId: p.id,
                    })}
                    uiKey="client-project-unlink"
                  />
                </li>
              ))}
            </ul>
          )}
          {client.archivedAt ? null : <LinkProjectForm clientId={client.id} options={linkable} />}
          <p className="text-muted-foreground text-meta">{t('clients.detail.oneCardPerProject')}</p>
        </div>
      </Panel>
    </main>
  );
}
