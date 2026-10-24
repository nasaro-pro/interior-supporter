// src/app/app/[company]/history/[eventId]/page.tsx (A · TASK-014, REQ-030) — PM-41 이력 상세: 행위자·시각·전후 값
// 비밀(토큰 해시)은 트리거가 기록하지 않는다 (POL-028). 수정·삭제 불가
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { Panel } from '@/features/core/components/summary-blocks';
import { getAuditEvent } from '@/features/core/server/history-queries';
import { routes } from '@/shared/contracts/routes';
import type { Json } from '@/shared/contracts/database.types';
import { DateText } from '@/shared/ui/date-text';
import { Breadcrumbs, PageHeader } from '@/shared/ui/page-parts';
import { tableScrollClass } from '@/shared/ui/styles';

const show = (v: Json | undefined) =>
  v === undefined ? '—' : v === null ? 'null' : typeof v === 'string' ? v : JSON.stringify(v);

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ company: string; eventId: string }>;
}) {
  const { company, eventId } = await params;
  const staff = await requireCompanyStaff(company);
  const event = await getAuditEvent(staff.companyId, eventId);
  if (!event) notFound();
  const slug = decodeURIComponent(company);
  const t = await getTranslations();
  const keys = [...new Set([...Object.keys(event.before), ...Object.keys(event.after)])].sort();

  return (
    <main data-screen-id="PM-41" className="flex flex-col gap-5">
      <Breadcrumbs
        items={[
          { label: t('history.screen.list'), href: routes.app.history(slug) },
          { label: t('history.screen.detail') },
        ]}
      />
      <PageHeader
        title={
          <>
            {t(`history.objectType.${event.objectType}` as 'history.objectType.projects')} ·{' '}
            {t(`history.eventType.${event.eventType}` as 'history.eventType.created')}
          </>
        }
      />
      <Panel title={t('history.screen.detail')}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-meta">{t('history.field.actor')}</dt>
            <dd>{event.actorName ?? t('history.actor.system')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-meta">{t('history.field.occurredAt')}</dt>
            <dd>
              <DateText value={event.occurredAt} />
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-meta">{t('history.field.project')}</dt>
            <dd>
              {event.projectId && event.projectName ? (
                <Link
                  href={routes.app.project(slug, event.projectId)}
                  className="text-primary underline-offset-4 hover:underline"
                  data-ui-key="history-project-open"
                >
                  {event.projectName}
                </Link>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-meta">{t('history.field.object')}</dt>
            <dd className="font-mono text-xs break-all">{event.objectId}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title={`${t('history.field.before')} → ${t('history.field.after')}`}>
        {keys.length === 0 ? (
          <p className="text-muted-foreground">{t('history.detail.noDiff')}</p>
        ) : (
          <div className={tableScrollClass}>
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-muted-foreground text-meta text-left">
                <tr className="border-b">
                  <th className="py-2 font-medium">{t('history.detail.column')}</th>
                  <th className="py-2 font-medium">{t('history.field.before')}</th>
                  <th className="py-2 font-medium">{t('history.field.after')}</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k} className="border-b align-top last:border-0">
                    <td className="py-2 font-mono text-xs">{k}</td>
                    <td className="text-muted-foreground py-2 break-all whitespace-pre-wrap">
                      {show(event.before[k])}
                    </td>
                    <td className="py-2 break-all whitespace-pre-wrap">{show(event.after[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </main>
  );
}
