// src/app/app/[company]/layout.tsx (A · TASK-003) — PM 영역 셸 (02 문서 2.1). 업체 구성원이 아니면 404 (존재 숨김)
// 25번 시안: 왼쪽 메뉴 + 흰 바탕 · 차콜 · 노토 산스 (CompanyShell). 휴대폰은 위 얇은 줄 + 아래 탭
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { getAccessContext, requireCompanyStaff } from '@/features/core';
import { CompanyShell } from '@/features/core/components/company-shell';
import { getCreatePermission } from '@/features/core/server/create-permission-queries';
import { unreadCount } from '@/features/core/server/notification-queries';
import { getCompanyBasics, listProjects } from '@/features/core/server/project-queries';
import { portfolioRoutes } from '@/features/portfolio/routes';
import { getPortfolioPublicState } from '@/features/portfolio/server/preview-queries';
import { countUnansweredRequests } from '@/features/requests/server/summary';
import { routes } from '@/shared/contracts/routes';

/** 왼쪽 메뉴 '진행 중 프로젝트' 바로가기 최대 개수 */
const SIDEBAR_PROJECTS = 8;

export default async function PmLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const ctx = await getAccessContext();
  const [basics, unread, t, tp, portfolioPublic, unanswered, active, permission] =
    await Promise.all([
      getCompanyBasics(staff.companyId),
      unreadCount('app', staff.companyId),
      getTranslations('common.nav'),
      getTranslations('portfolio.nav'),
      getPortfolioPublicState(staff.companyId),
      countUnansweredRequests(staff.companyId),
      listProjects(staff.companyId, { status: 'active' }),
      getCreatePermission(staff.companyId, staff.role, ctx.userId),
    ]);
  const slug = basics?.slug ?? decodeURIComponent(company);
  // 홈페이지: 공개 중이면 손님이 보는 주소, 아니면 관리자 미리보기 (새 탭)
  const homepageHref = portfolioPublic ? portfolioRoutes.home(slug) : portfolioRoutes.preview(slug);
  return (
    <CompanyShell
      sidebar={{
        slug,
        brand: basics?.name ?? slug,
        displayName: ctx.displayName,
        canSwitchArea: ctx.areas.length > 1 || ctx.memberships.length > 1,
        unread,
        unanswered,
        activeProjects: active.items
          .slice(0, SIDEBAR_PROJECTS)
          .map((p) => ({ id: p.id, name: p.name })),
        canCreate: permission.allowed,
        homepage: { href: homepageHref, isPublic: portfolioPublic },
      }}
      tabItems={[
        {
          key: 'dashboard',
          label: t('dashboard'),
          href: routes.app.home(slug),
          icon: 'dashboard',
          exact: true,
        },
        {
          key: 'projects',
          label: t('projects'),
          href: routes.app.projects(slug),
          icon: 'projects',
        },
        {
          key: 'notifications',
          label: t('notifications'),
          href: routes.app.notifications(slug),
          icon: 'notifications',
          badge: unread,
        },
        {
          key: 'more',
          label: t('more'),
          href: routes.app.settings(slug),
          icon: 'more',
          children: [
            { key: 'calendar', label: t('calendar'), href: routes.app.calendar(slug) },
            { key: 'clients', label: t('clients'), href: routes.app.clients(slug) },
            { key: 'history', label: t('history'), href: routes.app.history(slug) },
            { key: 'settings', label: t('settings'), href: routes.app.settings(slug) },
            {
              key: 'homepage',
              label: portfolioPublic ? tp('homepage') : tp('homepageNotPublic'),
              href: homepageHref,
              external: true,
            },
          ],
        },
      ]}
    >
      {children}
    </CompanyShell>
  );
}
