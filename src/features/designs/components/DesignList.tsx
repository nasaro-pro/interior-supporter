// PM-04 / CL-04 도안 목록 (REQ-100) — 같은 컴포넌트 + viewer.as 로 표시 차이
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ProjectAccess } from '@/shared/contracts/integration';
import { routes } from '@/shared/contracts/routes';
import { formatDate } from '@/shared/lib/dates';
import { EmptyState } from '@/shared/ui/states';
import {
  ArchivedBadge,
  ConfirmStateBadge,
  VisibilityBadge,
} from '@/features/designs/components/StateBadges';
import type { DesignListItem } from '@/features/designs/types';

export async function DesignList({
  items,
  viewer,
  emptyAction,
}: {
  items: DesignListItem[];
  viewer: ProjectAccess;
  emptyAction?: ReactNode;
}) {
  const t = await getTranslations('designs');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) === 'en' ? 'en' : 'ko';
  const editor = viewer.as === 'editor';
  if (items.length === 0) {
    return (
      <EmptyState title={editor ? t('list.empty') : t('list.emptyCustomer')} action={emptyAction} />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((d) => {
        const href = editor
          ? routes.app.design(viewer.companySlug, viewer.projectId, d.id)
          : routes.portal.design(viewer.projectId, d.id);
        return (
          <li
            key={d.id}
            data-key={d.id}
            className="bg-card hover:border-ring/50 min-w-0 rounded-lg border shadow-xs transition-colors"
          >
            <Link
              href={href}
              className="focus-visible:ring-ring/50 flex flex-col gap-2 rounded-lg p-3 outline-none focus-visible:ring-3"
              data-ui-key="design-list-item"
            >
              <div className="bg-muted aspect-[16/10] overflow-hidden rounded-sm">
                {d.previewFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 권한 재검사 라우트(302)
                  <img
                    src={routes.file(d.previewFileId)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <p className="text-meta text-muted-foreground flex h-full items-center justify-center p-2 text-center">
                    {t('preview.none')}
                  </p>
                )}
              </div>
              <p className="truncate font-medium">{d.title}</p>
              <div className="text-meta text-muted-foreground flex flex-wrap items-center gap-1">
                <span>{t('field.version', { no: d.currentVersion })}</span>
                {editor ? (
                  <VisibilityBadge
                    isPublic={d.isPublic}
                    label={d.isPublic ? tc('visibility.public') : tc('visibility.private')}
                  />
                ) : null}
                {/* 고객 화면에는 미확정 배지를 그리지 않는다 (04 문서 B 주의) */}
                {editor || d.confirmState !== 'none' ? (
                  <ConfirmStateBadge
                    state={d.confirmState}
                    label={t(`confirmState.${d.confirmState}`)}
                  />
                ) : null}
                {d.archivedAt ? <ArchivedBadge label={tc('filter.archived')} /> : null}
                <span data-numeric>{formatDate(d.updatedAt, locale)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
