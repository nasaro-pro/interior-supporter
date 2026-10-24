// PM-05 / CL-05 자재 목록 (REQ-110) — 사양·수량·단가·확정 상태. 고객은 공개분만(RLS)
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { formatWon } from '@/shared/lib/money';
import {
  ArchivedBadge,
  ConfirmStateBadge,
  VisibilityBadge,
} from '@/features/designs/components/StateBadges';
import type { MaterialListItem } from '@/features/materials/types';

export async function MaterialList({
  items,
  viewer,
}: {
  items: MaterialListItem[];
  viewer: ProjectAccess;
}) {
  const t = await getTranslations('materials');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  const editor = viewer.as === 'editor';
  return (
    <ul className="flex flex-col gap-2">
      {items.map((m) => {
        const href = editor
          ? routes.app.material(viewer.companySlug, viewer.projectId, m.id)
          : routes.portal.material(viewer.projectId, m.id);
        return (
          <li
            key={m.id}
            data-key={m.id}
            className="bg-card hover:border-ring/50 min-w-0 rounded-lg border shadow-xs transition-colors"
          >
            <Link
              href={href}
              data-ui-key="material-list-item"
              className="focus-visible:ring-ring/50 flex gap-3 rounded-lg p-3 outline-none focus-visible:ring-3"
            >
              <div className="bg-muted h-16 w-16 shrink-0 overflow-hidden rounded-sm">
                {m.imageFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 라우트(302)
                  <img
                    src={routes.file(m.imageFileId)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="min-w-0 font-medium break-words">{m.name}</span>
                  {editor ? (
                    <VisibilityBadge
                      isPublic={m.isPublic}
                      label={m.isPublic ? tc('visibility.public') : tc('visibility.private')}
                    />
                  ) : null}
                  {editor || m.confirmState !== 'none' ? (
                    <ConfirmStateBadge
                      state={m.confirmState}
                      label={t(`confirmState.${m.confirmState}`)}
                    />
                  ) : null}
                  {m.archivedAt ? <ArchivedBadge label={tc('filter.archived')} /> : null}
                </div>
                <p className="text-meta text-muted-foreground">
                  {[m.category, t(`space.${m.space}`)].filter(Boolean).join(' · ')}
                </p>
                {m.spec ? <p className="text-muted-foreground line-clamp-2">{m.spec}</p> : null}
                <p className="text-meta" data-numeric>
                  {m.quantity !== null
                    ? `${t('field.quantity')} ${m.quantity}${m.unit ? ` ${m.unit}` : ''}`
                    : null}
                  {m.quantity !== null && m.unitPrice !== null ? ' · ' : null}
                  {m.unitPrice !== null
                    ? `${t('field.unitPrice')} ${formatWon(m.unitPrice, locale)}`
                    : null}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
