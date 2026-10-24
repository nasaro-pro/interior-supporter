// src/app/portal/layout.tsx (A · TASK-003) — 고객 영역 셸 (02 문서 2.1: 로고·내 프로젝트·알림·계정)
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { AppShell } from '@/features/core/components/app-shell';
import { unreadCount } from '@/features/core/server/notification-queries';
import { routes } from '@/shared/contracts/routes';

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const ctx = await getAccessContext();
  if (!ctx.areas.includes('portal')) notFound(); // REQ-007: 역할 없는 영역 직접 URL → 404
  const [unread, t] = await Promise.all([unreadCount('portal'), getTranslations('common')]);
  return (
    <AppShell
      homeHref={routes.portal.projects()}
      brand={t('appName')}
      navItems={[
        {
          key: 'myProjects',
          label: t('nav.myProjects'),
          href: routes.portal.projects(),
          icon: 'projects',
        },
      ]}
      tabItems={[
        {
          key: 'myProjects',
          label: t('nav.myProjects'),
          href: routes.portal.projects(),
          icon: 'projects',
        },
        {
          key: 'notifications',
          label: t('nav.notifications'),
          href: routes.portal.notifications(),
          icon: 'notifications',
          badge: unread,
        },
      ]}
      notificationsHref={routes.portal.notifications()}
      unread={unread}
      displayName={ctx.displayName}
      canSwitchArea={ctx.areas.length > 1}
    >
      {children}
    </AppShell>
  );
}
