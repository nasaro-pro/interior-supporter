// PM-09 / CL-09 견적 목록 (REQ-130) — 견적별 최신 버전·버전 수·공개 상태. 고객은 공개 버전이 있는 견적만(RLS)
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { formatDate } from '@/shared/lib/dates';
import { StatusBadge } from '@/shared/ui/status-badge';
import { ArchivedBadge } from '@/features/designs/components/StateBadges';
import type { EstimateListItem } from '@/features/estimates/types';

export async function EstimateList({
  items,
  viewer,
}: {
  items: EstimateListItem[];
  viewer: ProjectAccess;
}) {
  const t = await getTranslations('estimates');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  const editor = viewer.as === 'editor';
  return (
    <ul className="flex flex-col gap-2">
      {items.map((e) => {
        const href = editor
          ? routes.app.estimate(viewer.companySlug, viewer.projectId, e.id)
          : routes.portal.estimate(viewer.projectId, e.id);
        return (
          <li
            key={e.id}
            data-key={e.id}
            className="bg-card hover:border-ring/50 min-w-0 rounded-lg border shadow-xs transition-colors"
          >
            <Link
              href={href}
              data-ui-key="estimate-list-item"
              className="focus-visible:ring-ring/50 flex flex-col gap-1 rounded-lg p-3 text-sm outline-none focus-visible:ring-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 font-medium break-words">{e.title}</span>
                {editor ? (
                  e.hasPublic ? (
                    <StatusBadge status="public" label={tc('visibility.public')} />
                  ) : (
                    <StatusBadge status="private" label={t('label.noPublicVersion')} />
                  )
                ) : null}
                {e.archivedAt ? <ArchivedBadge label={tc('filter.archived')} /> : null}
              </div>
              <p className="text-meta text-muted-foreground" data-numeric>
                {e.latest
                  ? `${t('field.version', { no: e.latest.versionNo })} · ${e.latest.versionLabel} · ${formatDate(e.latest.createdAt, locale)}`
                  : t('label.noVersion')}
                {' · '}
                {t('list.versionCount', { count: e.versionCount })}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
