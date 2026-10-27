// src/app/admin/(console)/layout.tsx — 사이트 관리 영역 셸 (A2). 비로그인 → 관리자 로그인, 관리자가 아니면 404
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { AppShell } from '@/features/core/components/app-shell';
import { requirePlatformAdmin } from '@/features/admin/server/guard';
import { routes } from '@/shared/contracts/routes';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePlatformAdmin();
  const [ctx, t] = await Promise.all([getAccessContext(), getTranslations('admin.nav')]);
  const items = [
    {
      key: 'dashboard',
      label: t('dashboard'),
      href: routes.admin.dashboard(),
      icon: 'dashboard' as const,
    },
    {
      key: 'companies',
      label: t('companies'),
      href: routes.admin.companies(),
      icon: 'companies' as const,
    },
    { key: 'users', label: t('users'), href: routes.admin.users(), icon: 'clients' as const },
    {
      key: 'settings',
      label: t('settings'),
      href: routes.admin.settings(),
      icon: 'settings' as const,
    },
    { key: 'cleanup', label: t('cleanup'), href: routes.admin.cleanup(), icon: 'cleanup' as const },
    { key: 'audit', label: t('audit'), href: routes.admin.audit(), icon: 'history' as const },
  ];
  return (
    <AppShell
      homeHref={routes.admin.dashboard()}
      brand={t('brand')}
      navItems={items}
      tabItems={items.slice(0, 4)}
      unread={0}
      displayName={ctx.displayName}
      canSwitchArea={ctx.areas.length > 0}
    >
      {children}
    </AppShell>
  );
}
