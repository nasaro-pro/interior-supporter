// src/app/field/layout.tsx (A · TASK-003) — 시공팀 영역 셸 (02 문서 2.1: 로고·내 현장·현장 사진·알림·계정). 화면 내용(FW-00~06)은 C
// CR-11(통합본 F1): 홈을 내 현장(FW-00)으로, 메뉴에 '내 현장' 추가
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { AppShell } from '@/features/core/components/app-shell';
import { unreadCount } from '@/features/core/server/notification-queries';
import { routes } from '@/shared/contracts/routes';

export default async function FieldLayout({ children }: { children: ReactNode }) {
  const ctx = await getAccessContext();
  if (!ctx.areas.includes('field')) notFound();
  const [unread, t, tf] = await Promise.all([
    unreadCount('field'),
    getTranslations('common'),
    getTranslations('field'),
  ]);
  const sites = {
    key: 'sites',
    label: tf('nav.sites'),
    href: routes.field.home(),
    icon: 'projects',
  } as const;
  return (
    <AppShell
      homeHref={routes.field.home()}
      brand={t('appName')}
      navItems={[
        sites,
        { key: 'photos', label: t('nav.photos'), href: routes.field.photos(), icon: 'photos' },
      ]}
      tabItems={[
        sites,
        { key: 'photos', label: t('nav.photos'), href: routes.field.photos(), icon: 'photos' },
        {
          key: 'notifications',
          label: t('nav.notifications'),
          href: routes.field.notifications(),
          icon: 'notifications',
          badge: unread,
        },
      ]}
      notificationsHref={routes.field.notifications()}
      unread={unread}
      displayName={ctx.displayName}
      canSwitchArea={ctx.areas.length > 1}
    >
      {children}
    </AppShell>
  );
}
