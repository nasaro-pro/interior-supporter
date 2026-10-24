// src/app/portal/notifications/page.tsx (A · TASK-010) — CL-50 알림
import { NotificationsView } from '@/features/core/components/notifications-view';
import { routes } from '@/shared/contracts/routes';

export default async function PortalNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; unavailable?: string }>;
}) {
  const sp = await searchParams;
  return (
    <NotificationsView
      area="portal"
      slug=""
      screenId="CL-50"
      listHref={routes.portal.notifications()}
      cursor={sp.cursor}
      unavailable={sp.unavailable === '1'}
    />
  );
}
