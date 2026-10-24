// src/app/app/[company]/layout.tsx (A · TASK-003) — PM 영역 셸 (02 문서 2.1). 업체 구성원이 아니면 404 (존재 숨김)
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireCompanyStaff } from '@/features/core';
import { AppShell } from '@/features/core/components/app-shell';
import { unreadCount } from '@/features/core/server/notification-queries';
import { getCompanyBasics } from '@/features/core/server/project-queries';
import { routes } from '@/shared/contracts/routes';

export default async function PmLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const [ctx, basics, unread, t] = await Promise.all([
    getAccessContext(),
    getCompanyBasics(staff.companyId),
    unreadCount('app', staff.companyId),
    getTranslations('common.nav'),
  ]);
  const slug = basics?.slug ?? decodeURIComponent(company);
  return (
    <AppShell
      homeHref={routes.app.projects(slug)}
      brand={basics?.name ?? slug}
      navItems={[
        {
          key: 'projects',
          label: t('projects'),
          href: routes.app.projects(slug),
          icon: 'projects',
        },
        { key: 'clients', label: t('clients'), href: routes.app.clients(slug), icon: 'clients' },
        {
          key: 'calendar',
          label: t('calendar'),
          href: routes.app.calendar(slug),
          icon: 'calendar',
        },
        { key: 'history', label: t('history'), href: routes.app.history(slug), icon: 'history' },
      ]}
      tabItems={[
        {
          key: 'projects',
          label: t('projects'),
          href: routes.app.projects(slug),
          icon: 'projects',
        },
        {
          key: 'calendar',
          label: t('calendar'),
          href: routes.app.calendar(slug),
          icon: 'calendar',
        },
        {
          key: 'notifications',
          label: t('notifications'),
          href: routes.app.notifications(slug),
          icon: 'notifications',
          badge: unread,
        },
        {
          key: 'more',
          label: t('more'),
          href: routes.app.settings(slug),
          icon: 'more',
          children: [
            { key: 'clients', label: t('clients'), href: routes.app.clients(slug) },
            { key: 'history', label: t('history'), href: routes.app.history(slug) },
            { key: 'settings', label: t('settings'), href: routes.app.settings(slug) },
          ],
        },
      ]}
      notificationsHref={routes.app.notifications(slug)}
      unread={unread}
      settingsHref={routes.app.settings(slug)}
      displayName={ctx.displayName}
      canSwitchArea={ctx.areas.length > 1 || ctx.memberships.length > 1}
    >
      {children}
    </AppShell>
  );
}
