// src/app/portal/layout.tsx (A · TASK-003) — 고객 영역 셸 (02 문서 2.1: 로고·내 프로젝트·알림·계정)
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { AppShell } from '@/features/core/components/app-shell';
import { unreadCount } from '@/features/core/server/notification-queries';
import { previewProjectId } from '@/features/core/server/customer-preview';
import { routes } from '@/shared/contracts/routes';

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const ctx = await getAccessContext();
  // 담당자의 고객 화면 미리보기: 고객 역할이 없어도 셸은 연다 (프로젝트 권한은 하위 layout 이 다시 확인)
  const preview = ctx.areas.includes('portal') ? null : await previewProjectId();
  if (!ctx.areas.includes('portal') && !preview) notFound(); // REQ-007: 역할 없는 영역 직접 URL → 404
  const [unread, t] = await Promise.all([
    preview ? Promise.resolve(0) : unreadCount('portal'),
    getTranslations('common'),
  ]);
  const home = preview ? routes.portal.project(preview, 'home') : routes.portal.projects();
  return (
    <AppShell
      homeHref={home}
      brand={t('appName')}
      navItems={[
        {
          key: 'myProjects',
          label: t('nav.myProjects'),
          href: home,
          icon: 'projects',
        },
      ]}
      tabItems={[
        {
          key: 'myProjects',
          label: t('nav.myProjects'),
          href: home,
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
