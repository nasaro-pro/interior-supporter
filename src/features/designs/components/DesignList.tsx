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
  MainBadge,
  MemoCountBadge,
  VisibilityBadge,
} from '@/features/designs/components/StateBadges';
import {
  DesignMoveButtons,
  DesignSpaceMoveButtons,
} from '@/features/designs/components/DesignSpaceControls';
import { groupBySpace } from '@/features/designs/lib/order';
import type { DesignListItem } from '@/features/designs/types';

/** D-26·D-28: 공간별 묶음 — 규칙은 lib/order.ts (목록·순서 저장 공통) */
export { groupBySpace };

export async function DesignList({
  items,
  viewer,
  emptyAction,
  memoCounts,
}: {
  items: DesignListItem[];
  viewer: ProjectAccess;
  emptyAction?: ReactNode;
  /** CU-04: 도안별 메모 수 (고객 화면이 넘긴다 — 없으면 표시 안 함) */
  memoCounts?: Record<string, number>;
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
  const tm = await getTranslations('materials');
  const groups = groupBySpace(items);
  const canMove = editor && items.every((d) => !d.archivedAt);
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, gi) => (
        <section
          key={g.space ?? 'all'}
          aria-labelledby={`design-space-${g.space ?? 'all'}`}
          className="flex flex-col gap-2"
          data-ui-key="design-space-group"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 id={`design-space-${g.space ?? 'all'}`} className="font-semibold">
              {g.space ? tm(`space.${g.space}`) : t('space.all')}
              <span className="text-muted-foreground text-meta ms-2">{g.items.length}</span>
            </h3>
            {canMove && groups.length > 1 ? (
              <DesignSpaceMoveButtons
                projectId={viewer.projectId}
                space={g.space}
                label={g.space ? tm(`space.${g.space}`) : t('space.all')}
                first={gi === 0}
                last={gi === groups.length - 1}
              />
            ) : null}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((d, idx) => {
              const href = editor
                ? routes.app.design(viewer.companySlug, viewer.projectId, d.id)
                : routes.portal.design(viewer.projectId, d.id);
              return (
                <li
                  key={d.id}
                  data-key={d.id}
                  className="bg-card hover:border-ring/50 flex min-w-0 flex-col rounded-lg border shadow-xs transition-colors"
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
                      {d.isMain ? <MainBadge label={t('main.badge')} /> : null}
                      {editor && d.isMain && !d.isPublic ? (
                        <span className="text-tone-attention-fg">{t('main.hiddenShort')}</span>
                      ) : null}
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
                      {memoCounts?.[d.id] ? (
                        <MemoCountBadge label={t('list.memoCount', { count: memoCounts[d.id]! })} />
                      ) : null}
                      <span data-numeric>{formatDate(d.updatedAt, locale)}</span>
                    </div>
                  </Link>
                  {canMove ? (
                    <div className="flex justify-end border-t px-2 py-1">
                      <DesignMoveButtons
                        projectId={viewer.projectId}
                        id={d.id}
                        title={d.title}
                        first={idx === 0}
                        last={idx === g.items.length - 1}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
