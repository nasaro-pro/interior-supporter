// src/features/core/components/portal-shell.tsx (A) — 고객 영역 셸 (2026-11 새 디자인: 메인페이지와 같은 머리)
// 왼쪽: 업체 이름 (공개 홈페이지가 있으면 메인페이지로) · 오른쪽: 알림 · 계정(로그아웃 포함)
// 색·글꼴은 업체 관리 셸과 같은 변수(COMPANY_THEME_CSS)를 이 셸이 있을 때만 건다
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { brandFontClass } from '@/features/portfolio/font';
import { cn } from '@/shared/lib/utils';
import { AccountMenu } from './account-menu';
import { COMPANY_THEME_CSS } from './company-shell';
import { PortalTabs } from './portal-tabs';

/**
 * 고객 화면의 검색 · 필터 줄 — 밑줄형 (2026-11 시안 B: 메인페이지와 같은 잡지 느낌)
 * 테두리 없이 아래 선만, 이름표는 작은 자간 넓은 글씨, 고른 값은 진하게 · 안내 글씨는 연하게, 화살표 · 돋보기는 얇은 선 아이콘.
 * 자재(B) · 현장 사진(C) · 메모 목록(C) 화면 파일은 그대로 두고 고객 셸에서만 모양을 바꾼다. 입력줄(대화창)은 GET · search 폼이 아니라 영향 없음
 */
const FORM = '[data-portal-shell] main form:is([role="search"], [method="get"])';
const FIELD = `${FORM} :is(select, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]))`;
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238A847A' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";
const SEARCH =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238A847A' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E\")";
const PORTAL_FIELDS_CSS = `
${FORM} {
  column-gap: 2rem;
  row-gap: 1.25rem;
}
${FORM} :is(label, label > span:not(.sr-only)):has(+ :is(select, input)),
${FORM} label > span:first-child:not(.sr-only) {
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
}
${FIELD} {
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-bottom: 1px solid #c9c3b8;
  border-radius: 0;
  background-color: transparent;
  box-shadow: none;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--foreground);
}
${FIELD}::placeholder {
  color: #a39e95;
  font-weight: 400;
}
${FIELD}:hover {
  border-bottom-color: #8a847a;
}
${FIELD}:focus-visible {
  border-bottom-color: var(--foreground);
  box-shadow: 0 1px 0 0 var(--foreground);
  outline: none;
}
${FIELD}:is(select) {
  appearance: none;
  padding-right: 1.5rem;
  background: ${CHEVRON} no-repeat right center;
}
${FIELD}[type="search"] {
  padding-left: 1.625rem;
  background: ${SEARCH} no-repeat left center;
}
${FORM} input[type="date"]::-webkit-calendar-picker-indicator {
  opacity: 0.5;
}
${FORM} button {
  height: 2.75rem;
  padding: 0 0.25rem;
  border: 0;
  border-bottom: 1px solid var(--foreground);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--foreground);
}
${FORM} button:hover {
  background: transparent;
  opacity: 0.7;
}
@media (min-width: 640px) {
  ${FORM} label:has(select) {
    width: 11rem;
  }
}`;

export async function PortalShell({
  brand,
  brandHref,
  projectsHref,
  notificationsHref,
  unread,
  displayName,
  canSwitchArea,
  children,
}: {
  /** 업체 이름 (여러 업체와 공사 중이면 서비스 이름) */
  brand: string;
  /** 공개 홈페이지(메인페이지) — 없으면 내 프로젝트 */
  brandHref: string;
  projectsHref: string;
  notificationsHref: string;
  unread: number;
  displayName: string;
  canSwitchArea: boolean;
  children: ReactNode;
}) {
  const t = await getTranslations('common.nav');
  const tp = await getTranslations('projects');
  const tn = await getTranslations('notifications');
  return (
    <div data-portal-shell className={cn(brandFontClass, 'flex min-h-dvh flex-col')}>
      <style>{COMPANY_THEME_CSS}</style>
      <style>{PORTAL_FIELDS_CSS}</style>
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t('skipToContent')}
      </a>
      <header className="bg-background sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-2 px-5 md:h-[72px] md:px-10">
          <Link
            href={brandHref}
            className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-2.5 rounded-sm outline-none focus-visible:ring-3"
            data-ui-key="shell-home-link"
          >
            <span
              aria-hidden
              className="bg-foreground text-background grid size-8 shrink-0 place-items-center rounded-md text-sm font-semibold"
            >
              {brand.trim().slice(0, 1)}
            </span>
            <span className="truncate font-semibold">{brand}</span>
          </Link>
          <Link
            href={notificationsHref}
            data-ui-key="shell-notifications-link"
            aria-label={tn('label.bell', { count: unread })}
            className="text-muted-foreground hover:text-foreground relative grid size-9 place-items-center rounded-md"
          >
            <Bell aria-hidden className="size-5" />
            {unread > 0 ? (
              <span className="bg-destructive absolute top-1.5 right-1.5 size-2 rounded-full" />
            ) : null}
          </Link>
          <AccountMenu displayName={displayName} canSwitchArea={canSwitchArea} />
        </div>
      </header>
      <div
        id="main"
        className="mx-auto w-full max-w-[1120px] min-w-0 flex-1 px-5 pb-24 md:px-10 md:pb-16"
      >
        {children}
      </div>
      <PortalTabs
        projectsHref={projectsHref}
        unread={unread}
        labels={{
          home: t('ourHome'),
          memo: tp('tab.memos'),
          projects: t('myProjects'),
          notifications: t('notifications'),
          menu: t('menu'),
        }}
      />
    </div>
  );
}
