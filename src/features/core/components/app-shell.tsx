// src/features/core/components/app-shell.tsx (A · TASK-003) — 영역 공통 셸: 상단바(로고·D1 메뉴·알림·설정·계정) + 모바일 하단 탭
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell, Settings } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { buttonVariants } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { AccountMenu } from './account-menu';
import { BottomTabs, TopNav, type NavItem } from './nav-links';

export async function AppShell({
  homeHref,
  brand,
  navItems,
  tabItems,
  notificationsHref,
  unread,
  settingsHref,
  displayName,
  canSwitchArea,
  brandExtra,
  children,
}: {
  homeHref: string;
  brand: string;
  navItems: NavItem[];
  tabItems: NavItem[];
  /** 없으면 알림 종을 그리지 않는다 (사이트 관리 영역은 앱 알림이 없다) */
  notificationsHref?: string;
  unread: number;
  settingsHref?: string;
  displayName: string;
  canSwitchArea: boolean;
  brandExtra?: ReactNode;
  children: ReactNode;
}) {
  const t = await getTranslations();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('common.nav.skipToContent')}
      </a>
      <header className="bg-card sticky top-0 z-40 border-b">
        <div className="page-container flex h-14 items-center gap-3">
          <Link
            href={homeHref}
            className="flex min-w-0 items-center gap-2 font-semibold"
            data-ui-key="shell-home-link"
          >
            <span
              aria-hidden
              className="bg-primary text-primary-foreground grid size-7 shrink-0 place-items-center rounded-md text-xs"
            >
              IS
            </span>
            <span className="truncate">{brand}</span>
          </Link>
          {brandExtra}
          <div className="ms-2 flex-1">
            <TopNav items={navItems} label={t('common.nav.mainNav')} />
          </div>
          <div className="flex items-center gap-1">
            {notificationsHref ? (
              <Link
                href={notificationsHref}
                data-ui-key="shell-notifications-link"
                aria-label={t('notifications.label.bell', { count: unread })}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'relative hidden md:inline-flex',
                )}
              >
                <Bell aria-hidden className="size-5" />
                {unread > 0 ? (
                  <span className="bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 tabular-nums">
                    {unread > 99 ? '99+' : unread}
                  </span>
                ) : null}
              </Link>
            ) : null}
            {settingsHref ? (
              <Link
                href={settingsHref}
                data-ui-key="shell-settings-link"
                aria-label={t('common.nav.settings')}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'hidden md:inline-flex',
                )}
              >
                <Settings aria-hidden className="size-5" />
              </Link>
            ) : null}
            <AccountMenu displayName={displayName} canSwitchArea={canSwitchArea} />
          </div>
        </div>
      </header>
      <div id="main" className="page-container min-w-0 flex-1 py-6 pb-24 md:pb-10">
        {children}
      </div>
      <BottomTabs items={tabItems} label={t('common.nav.menu')} />
    </div>
  );
}
