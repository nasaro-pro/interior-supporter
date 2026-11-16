'use client';
// src/features/core/components/nav-links.tsx (A · TASK-003) — 상단 D1 메뉴·모바일 하단 탭 (현재 위치 aria-current)
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Building2,
  CalendarDays,
  Camera,
  Eraser,
  FolderKanban,
  History,
  House,
  LayoutDashboard,
  MessageSquare,
  Menu,
  Settings,
  Users,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';

const ICONS = {
  projects: FolderKanban,
  clients: Users,
  calendar: CalendarDays,
  history: History,
  notifications: Bell,
  settings: Settings,
  photos: Camera,
  more: Menu,
  // 고객 프로젝트 안 (우리 집 · 메모)
  home: House,
  memo: MessageSquare,
  // 사이트 관리 (CR-3)
  dashboard: LayoutDashboard,
  companies: Building2,
  cleanup: Eraser,
} as const;

export type NavIcon = keyof typeof ICONS;
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: NavIcon;
  badge?: number;
  /** 하위 경로에서는 켜지 않는다 (업체 첫 화면 '대시보드' 처럼 다른 메뉴의 부모 경로일 때) */
  exact?: boolean;
  /** 모바일 '더보기' 처럼 하위 메뉴를 여는 탭 */
  children?: { key: string; label: string; href: string; external?: boolean }[];
}

const isActive = (pathname: string, href: string, exact = false) => {
  const base = href.split('?')[0] ?? href;
  return pathname === base || (!exact && pathname.startsWith(`${base}/`));
};

export function TopNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((it) => {
          const active = isActive(pathname, it.href, it.exact);
          return (
            <li key={it.key}>
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                data-ui-key={`nav-${it.key}-link`}
                className={cn(
                  'text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-9 items-center rounded-md px-3 text-sm font-medium',
                  active && 'bg-accent text-accent-foreground',
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 모바일(<768px) 하단 탭 — 02 문서 2.1 */
export function BottomTabs({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="bg-card fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          const active = isActive(pathname, it.href, it.exact);
          if (it.children?.length) {
            return (
              <li key={it.key}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    data-ui-key={`tab-${it.key}-open`}
                    className={cn(
                      'text-muted-foreground flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs',
                      it.children.some((c) => isActive(pathname, c.href)) &&
                        'text-primary font-medium',
                    )}
                  >
                    <Icon aria-hidden className="size-5" />
                    {it.label}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="end">
                    {it.children.map((c) => (
                      <DropdownMenuItem
                        key={c.key}
                        render={
                          c.external ? (
                            // 새 탭으로 여는 외부 화면 (업체 공개 홈페이지 등)
                            <a
                              href={c.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-ui-key={`tab-more-${c.key}-link`}
                            />
                          ) : (
                            <Link href={c.href} data-ui-key={`tab-more-${c.key}-link`} />
                          )
                        }
                      >
                        {c.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          }
          return (
            <li key={it.key}>
              <Link
                href={it.href}
                aria-current={active ? 'page' : undefined}
                data-ui-key={`tab-${it.key}-link`}
                className={cn(
                  'text-muted-foreground flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs',
                  active && 'text-primary font-medium',
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-5" />
                  {it.badge ? (
                    <span className="bg-destructive text-destructive-foreground absolute -top-1.5 -right-2.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 tabular-nums">
                      {it.badge > 99 ? '99+' : it.badge}
                    </span>
                  ) : null}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
