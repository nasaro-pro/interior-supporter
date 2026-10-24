// src/app/field/notifications/page.tsx (A · TASK-010) — FW-50 알림 (화면 배치는 C 와 연결, 조회·읽음·이동 공통부는 A)
import { NotificationsView } from '@/features/core/components/notifications-view';
import { routes } from '@/shared/contracts/routes';

export default async function FieldNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; unavailable?: string }>;
}) {
  const sp = await searchParams;
  return (
    <NotificationsView
      area="field"
      slug=""
      screenId="FW-50"
      listHref={routes.field.notifications()}
      cursor={sp.cursor}
      unavailable={sp.unavailable === '1'}
    />
  );
}
