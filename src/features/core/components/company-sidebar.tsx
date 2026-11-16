'use client';
// src/features/core/components/company-sidebar.tsx (A) — 업체 영역 왼쪽 메뉴 (PC·태블릿 ≥768px, 25번 시안)
// 위: 알림·답할 요청 / 가운데: 대시보드·프로젝트·고객·캘린더·변경이력 / 진행 중 프로젝트 바로가기 / 아래: 홈페이지·설정·계정
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  History,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { routes } from '@/shared/contracts/routes';
import type { ProjectTab } from '@/shared/contracts/screens';
import { cn } from '@/shared/lib/utils';
import { withQuery } from '../url';
import { AccountMenu } from './account-menu';

/** 바로가기에 펼치는 프로젝트 탭 (개요·설정은 프로젝트 이름을 누르면 열린다) */
const SHORTCUT_TABS = [
  'designs',
  'materials',
  'estimates',
  'requests',
  'photos',
  'schedule',
] as const satisfies readonly ProjectTab[];

export interface SidebarProps {
  slug: string;
  brand: string;
  displayName: string;
  canSwitchArea: boolean;
  unread: number;
  unanswered: number | null;
  activeProjects: { id: string; name: string }[];
  canCreate: boolean;
  homepage: { href: string; isPublic: boolean };
}

const under = (pathname: string, href: string) => {
  const base = href.split('?')[0] ?? href;
  return pathname === base || pathname.startsWith(`${base}/`);
};

function Item({
  href,
  icon: Icon,
  label,
  active,
  extra,
  uiKey,
  external = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  extra?: React.ReactNode;
  uiKey: string;
  external?: boolean;
}) {
  const cls = cn(
    'flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
    active
      ? 'bg-accent text-foreground font-medium'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );
  const body = (
    <>
      <Icon aria-hidden className="size-4 shrink-0 stroke-[1.75]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {extra}
    </>
  );
  return (
    <li>
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
          data-ui-key={uiKey}
        >
          {body}
        </a>
      ) : (
        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cls}
          data-ui-key={uiKey}
        >
          {body}
        </Link>
      )}
    </li>
  );
}

export function CompanySidebar(p: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const home = routes.app.home(p.slug);
  const projectsBase = routes.app.projects(p.slug);
  // 지금 보고 있는 프로젝트는 저절로 펼친다. 사용자가 누르면 그 프로젝트를 펼친다
  const current = p.activeProjects.find((x) => under(pathname, `${projectsBase}/${x.id}`))?.id;
  const [opened, setOpened] = useState<string | null>(null);
  const openId = opened ?? current ?? null;

  return (
    <aside
      className="bg-card sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r px-3 py-4 md:flex"
      data-ui-key="company-sidebar"
    >
      <Link
        href={home}
        className="truncate px-2.5 pb-4 text-[15px] font-semibold"
        data-ui-key="shell-home-link"
      >
        {p.brand}
      </Link>

      <nav aria-label={t('common.nav.mainNav')} className="flex flex-col">
        <ul className="flex flex-col gap-0.5">
          <Item
            href={routes.app.notifications(p.slug)}
            icon={Bell}
            label={t('common.nav.notifications')}
            active={under(pathname, routes.app.notifications(p.slug))}
            uiKey="nav-notifications-link"
            extra={
              p.unread > 0 ? (
                <span className="bg-destructive text-destructive-foreground min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums">
                  {p.unread > 99 ? '99+' : p.unread}
                </span>
              ) : null
            }
          />
          <Item
            href={withQuery(home, { tab: 'requests' })}
            icon={MessageSquare}
            label={t('common.nav.unanswered')}
            uiKey="nav-unanswered-link"
            extra={
              p.unanswered ? (
                <span className="text-muted-foreground text-xs tabular-nums">{p.unanswered}</span>
              ) : null
            }
          />
        </ul>
        <div className="my-3 border-t" />
        <ul className="flex flex-col gap-0.5">
          <Item
            href={home}
            icon={LayoutDashboard}
            label={t('common.nav.dashboard')}
            active={pathname === home}
            uiKey="nav-dashboard-link"
          />
          <Item
            href={projectsBase}
            icon={FolderKanban}
            label={t('common.nav.projects')}
            active={under(pathname, projectsBase)}
            uiKey="nav-projects-link"
          />
          <Item
            href={routes.app.clients(p.slug)}
            icon={Users}
            label={t('common.nav.clients')}
            active={under(pathname, routes.app.clients(p.slug))}
            uiKey="nav-clients-link"
          />
          <Item
            href={routes.app.calendar(p.slug)}
            icon={CalendarDays}
            label={t('common.nav.calendar')}
            active={under(pathname, routes.app.calendar(p.slug))}
            uiKey="nav-calendar-link"
          />
          <Item
            href={routes.app.history(p.slug)}
            icon={History}
            label={t('common.nav.history')}
            active={under(pathname, routes.app.history(p.slug))}
            uiKey="nav-history-link"
          />
        </ul>
      </nav>

      {p.activeProjects.length > 0 || p.canCreate ? (
        <nav aria-label={t('common.nav.activeProjects')} className="mt-3 border-t pt-3">
          <div className="flex items-center justify-between px-2.5 pb-1.5">
            <p className="text-muted-foreground text-[11px] font-medium">
              {t('common.nav.activeProjects')}
            </p>
            {p.canCreate ? (
              <Link
                href={withQuery(projectsBase, { mode: 'new' })}
                aria-label={t('common.nav.newProject')}
                title={t('common.nav.newProject')}
                className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded"
                data-ui-key="nav-new-project-link"
              >
                <Plus aria-hidden className="size-3.5" />
              </Link>
            ) : null}
          </div>
          <ul className="flex flex-col gap-0.5">
            {p.activeProjects.map((x) => {
              const open = openId === x.id;
              return (
                <li key={x.id}>
                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={t('common.nav.toggleProject', { name: x.name })}
                      onClick={() => setOpened(open ? '' : x.id)}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-7 shrink-0 place-items-center rounded"
                      data-ui-key="nav-project-toggle"
                    >
                      <ChevronRight
                        aria-hidden
                        className={cn('size-3.5 transition-transform', open && 'rotate-90')}
                      />
                    </button>
                    <Link
                      href={routes.app.project(p.slug, x.id)}
                      className={cn(
                        'hover:bg-muted min-w-0 flex-1 truncate rounded-md px-1.5 py-2 text-[13.5px]',
                        current === x.id ? 'text-foreground font-medium' : 'text-foreground/85',
                      )}
                      data-ui-key="nav-project-link"
                    >
                      {x.name}
                    </Link>
                  </div>
                  {open ? (
                    <ul className="flex flex-col pb-1">
                      {SHORTCUT_TABS.map((tab) => {
                        const href = routes.app.project(p.slug, x.id, tab);
                        const active = under(pathname, href);
                        return (
                          <li key={tab}>
                            <Link
                              href={href}
                              aria-current={active ? 'page' : undefined}
                              className={cn(
                                'flex h-8 items-center rounded-md pl-9 text-[13px]',
                                active
                                  ? 'text-foreground font-medium'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                              data-ui-key={`nav-project-${tab}-link`}
                            >
                              {t(`projects.tab.${tab}`)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <div className="mt-auto border-t pt-3">
        <ul className="flex flex-col gap-0.5">
          <Item
            href={p.homepage.href}
            icon={ExternalLink}
            label={t('portfolio.nav.homepage')}
            uiKey="shell-portfolio-home-link"
            external
            extra={
              p.homepage.isPublic ? (
                <span className="sr-only">{t('portfolio.nav.newTab')}</span>
              ) : (
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-medium">
                  {t('portfolio.nav.notPublic')}
                </span>
              )
            }
          />
          <Item
            href={routes.app.settings(p.slug)}
            icon={Settings}
            label={t('common.nav.settings')}
            active={under(pathname, routes.app.settings(p.slug).replace(/\/[^/]+$/, ''))}
            uiKey="shell-settings-link"
          />
        </ul>
        <div className="mt-2">
          <AccountMenu
            displayName={p.displayName}
            canSwitchArea={p.canSwitchArea}
            variant="sidebar"
          />
        </div>
      </div>
    </aside>
  );
}
