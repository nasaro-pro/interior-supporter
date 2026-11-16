'use client';
// src/features/core/components/portal-tabs.tsx (A) — 고객 휴대폰 아래 탭. 프로젝트 안이면 '우리 집 · 메모 · 알림', 밖이면 '내 프로젝트 · 알림'
import { usePathname } from 'next/navigation';
import { routes } from '@/shared/contracts/routes';
import { BottomTabs, type NavItem } from './nav-links';

const IN_PROJECT = /^\/portal\/projects\/([^/]+)(?:\/|$)/;

export function PortalTabs({
  projectsHref,
  unread,
  labels,
}: {
  projectsHref: string;
  unread: number;
  labels: { home: string; memo: string; projects: string; notifications: string; menu: string };
}) {
  const pathname = usePathname();
  const m = IN_PROJECT.exec(pathname);
  const projectId = m?.[1] ? decodeURIComponent(m[1]) : null;
  const notifications: NavItem = {
    key: 'notifications',
    label: labels.notifications,
    href: routes.portal.notifications(),
    icon: 'notifications',
    badge: unread,
  };
  const items: NavItem[] = projectId
    ? [
        {
          key: 'home',
          label: labels.home,
          href: routes.portal.project(projectId, 'home'),
          icon: 'home',
        },
        {
          key: 'memo',
          label: labels.memo,
          href: routes.portal.project(projectId, 'requests'),
          icon: 'memo',
        },
        notifications,
      ]
    : [
        { key: 'projects', label: labels.projects, href: projectsHref, icon: 'projects' },
        notifications,
      ];
  return <BottomTabs items={items} label={labels.menu} />;
}
