// src/app/app/[company]/notifications/page.tsx (A · TASK-010) — PM-50 알림
import { requireCompanyStaff } from '@/features/core';
import { NotificationsView } from '@/features/core/components/notifications-view';
import { routes } from '@/shared/contracts/routes';

export default async function PmNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ company: string }>;
  searchParams: Promise<{ cursor?: string; unavailable?: string }>;
}) {
  const { company } = await params;
  await requireCompanyStaff(company);
  const sp = await searchParams;
  const slug = decodeURIComponent(company);
  return (
    <NotificationsView
      area="app"
      slug={slug}
      screenId="PM-50"
      listHref={routes.app.notifications(slug)}
      cursor={sp.cursor}
      unavailable={sp.unavailable === '1'}
    />
  );
}
