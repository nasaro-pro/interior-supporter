// src/features/core/components/company-shell.tsx (A) — 업체 관리 영역 셸 (25번 시안: 왼쪽 메뉴 + 흰 바탕 · 차콜 · 노토 산스)
// 색·글꼴은 이 영역 안에서만 바꾼다 (globals.css 는 스타터 고정 — 고객·시공팀·사이트 관리 화면은 그대로).
// 대화상자·메뉴는 body 아래로 그려지므로 변수를 html 에 건다: 이 셸이 화면에 있을 때만 (:has) 적용된다.
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { brandSans } from '@/features/portfolio/font';
import { routes } from '@/shared/contracts/routes';
import { AccountMenu } from './account-menu';
import { BottomTabs, type NavItem } from './nav-links';
import { CompanySidebar, type SidebarProps } from './company-sidebar';

// 업체 관리 셸과 고객 셸(portal-shell.tsx)이 같은 색·글꼴을 쓴다
const SCOPE = 'html:has([data-company-shell], [data-portal-shell])';

/** 흰 바탕 · 차콜 버튼 · 따뜻한 회색 선 (배지 7톤 중 brand 톤만 차콜로) · 고객 메모 내 말풍선은 진한 브라운 */
export const COMPANY_THEME_CSS = `
${SCOPE} {
  --font-pretendard: ${brandSans.style.fontFamily};
}
@media (prefers-color-scheme: light) {
  ${SCOPE} {
    --background: #ffffff;
    --primary: #2c2c2c;
    --primary-foreground: #ffffff;
    --ring: #2c2c2c;
    --accent: #f4f2ee;
    --accent-foreground: #2c2c2c;
    --muted: #f4f2ee;
    --secondary: #f4f2ee;
    --secondary-foreground: #2c2c2c;
    --border: #e7e3dc;
    --muted-foreground: #6b655c;
    --tone-brand-bg: #eeece7;
    --tone-brand-fg: #2c2c2c;
    --chat-mine: #4e3b2f;
    --chat-mine-foreground: #ffffff;
  }
}
@media (prefers-color-scheme: dark) {
  ${SCOPE} {
    --primary: #edeae6;
    --primary-foreground: #1c1917;
    --ring: #edeae6;
    --accent: #2a2724;
    --accent-foreground: #edeae6;
    --tone-brand-bg: #2e2a27;
    --tone-brand-fg: #edeae6;
    --chat-mine: #6b5040;
    --chat-mine-foreground: #ffffff;
  }
}`;

export async function CompanyShell({
  sidebar,
  tabItems,
  children,
}: {
  sidebar: SidebarProps;
  tabItems: NavItem[];
  children: ReactNode;
}) {
  const t = await getTranslations('common.nav');
  return (
    <div data-company-shell className="flex min-h-dvh">
      <style>{COMPANY_THEME_CSS}</style>
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('skipToContent')}
      </a>
      <CompanySidebar {...sidebar} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 휴대폰: 위 얇은 줄 (업체 이름 · 계정). 메뉴는 아래 탭 */}
        <header className="bg-card sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 md:hidden">
          <Link
            href={routes.app.home(sidebar.slug)}
            className="min-w-0 flex-1 truncate font-semibold"
            data-ui-key="shell-home-link-mobile"
          >
            {sidebar.brand}
          </Link>
          <AccountMenu displayName={sidebar.displayName} canSwitchArea={sidebar.canSwitchArea} />
        </header>
        <div
          id="main"
          className="mx-auto w-full max-w-[1240px] min-w-0 flex-1 px-4 py-5 pb-24 md:px-8 md:py-7 md:pb-10"
        >
          {children}
        </div>
      </div>
      <BottomTabs items={tabItems} label={t('menu')} />
    </div>
  );
}
