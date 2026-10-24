// src/features/core/components/notifications-view.tsx (A · TASK-010) — PM-50·CL-50·FW-50 공통 알림 목록 (REQ-040)
// 알림 자체는 편집 화면이 아니다 — 클릭하면 읽음 + 정규 D4 로 이동. 볼 수 없으면 안내로 끝냄 (A-T07)
import { getTranslations } from 'next-intl/server';
import { BellDot, CircleSlash } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { DateText } from '@/shared/ui/date-text';
import { LoadMore, PageHeader } from '@/shared/ui/page-parts';
import { EmptyState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';
import { listNotifications, type Area } from '../server/notification-queries';
import { openNotification } from '../server/notification-actions';
import { withQuery } from '../url';
import { MarkAllReadButton } from './mark-all-read';

export async function NotificationsView({
  area,
  slug,
  screenId,
  listHref,
  cursor,
  unavailable,
}: {
  area: Area;
  slug: string;
  screenId: 'PM-50' | 'CL-50' | 'FW-50';
  listHref: string;
  cursor?: string;
  unavailable?: boolean;
}) {
  const t = await getTranslations('notifications');
  const list = await listNotifications(area, cursor, slug || undefined);
  const hasUnread = list.items.some((n) => !n.readAt);
  return (
    <main data-screen-id={screenId} className="flex flex-col gap-5">
      <PageHeader
        title={t('screen.list')}
        description={t('list.retention')}
        actions={hasUnread ? <MarkAllReadButton area={area} slug={slug} /> : null}
      />
      {unavailable ? (
        <p
          role="status"
          className="bg-tone-caution-bg text-tone-caution-fg flex items-center gap-2 rounded-md px-3 py-2"
        >
          <CircleSlash aria-hidden className="size-4" />
          {t('target.unavailable')}
        </p>
      ) : null}
      {list.error ? (
        <ErrorState />
      ) : list.items.length === 0 ? (
        <EmptyState title={t('list.empty')} />
      ) : (
        <ul className="bg-card divide-y rounded-lg border">
          {list.items.map((n) => (
            <li key={n.id} data-key={n.id}>
              <form action={openNotification.bind(null, area, slug, n.id)}>
                <Button
                  type="submit"
                  variant="ghost"
                  className={cn(
                    'h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left whitespace-normal',
                    !n.readAt && 'bg-accent/40',
                  )}
                  data-ui-key="notification-open"
                >
                  {!n.readAt ? (
                    <BellDot aria-hidden className="text-primary mt-0.5 size-4 shrink-0" />
                  ) : (
                    <span aria-hidden className="size-4 shrink-0" />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn('text-sm', !n.readAt && 'font-semibold')}>
                      {t(`type.${n.type}` as 'type.item_published')}
                      {!n.readAt ? <span className="sr-only"> ({t('label.unread')})</span> : null}
                    </span>
                    <span className="text-muted-foreground text-meta truncate">
                      {n.projectName && n.projectName !== n.targetTitle
                        ? `${n.projectName} · `
                        : null}
                      {n.targetTitle ?? t('target.unavailable')}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-meta shrink-0">
                    <DateText value={n.createdAt} />
                  </span>
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <LoadMore href={list.nextCursor ? withQuery(listHref, { cursor: list.nextCursor }) : null} />
    </main>
  );
}
