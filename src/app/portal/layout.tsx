// src/app/portal/layout.tsx (A · TASK-003) — 고객 영역 셸 (02 문서 2.1 → 2026-11 새 디자인: 업체 이름 · 알림 · 계정)
// 업체 이름: 고객이 공사 중인 업체가 하나면 그 업체 (공개 홈페이지가 있으면 누르면 메인페이지로), 여러 곳이면 서비스 이름
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/features/core';
import { PortalShell } from '@/features/core/components/portal-shell';
import { unreadCount } from '@/features/core/server/notification-queries';
import { previewProjectId } from '@/features/core/server/customer-preview';
import { getCompanyBasics, getProject } from '@/features/core/server/project-queries';
import { portfolioRoutes } from '@/features/portfolio/routes';
import { getPublicPortfolio } from '@/features/portfolio/server/public-queries';
import { routes } from '@/shared/contracts/routes';

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const ctx = await getAccessContext();
  // 담당자의 고객 화면 미리보기: 고객 역할이 없어도 셸은 연다 (프로젝트 권한은 하위 layout 이 다시 확인)
  const preview = ctx.areas.includes('portal') ? null : await previewProjectId();
  if (!ctx.areas.includes('portal') && !preview) notFound(); // REQ-007: 역할 없는 영역 직접 URL → 404
  const companyIds = preview
    ? [(await getProject(preview))?.companyId].filter((x): x is string => !!x)
    : [...new Set(ctx.participations.filter((p) => p.role === 'customer').map((p) => p.companyId))];
  const [unread, t, company] = await Promise.all([
    preview ? Promise.resolve(0) : unreadCount('portal'),
    getTranslations('common'),
    companyIds.length === 1 && companyIds[0]
      ? getCompanyBasics(companyIds[0])
      : Promise.resolve(null),
  ]);
  const home = preview ? routes.portal.project(preview, 'home') : routes.portal.projects();
  // 공개 홈페이지가 있을 때만 메인페이지로 (없으면 404 가 보이지 않게 내 프로젝트로)
  const publicSite = company && !preview ? await getPublicPortfolio(company.slug) : null;
  return (
    <PortalShell
      brand={company?.name ?? t('appName')}
      brandHref={publicSite && company ? portfolioRoutes.home(company.slug) : home}
      projectsHref={home}
      notificationsHref={routes.portal.notifications()}
      unread={unread}
      displayName={ctx.displayName}
      canSwitchArea={ctx.areas.length > 1}
    >
      {children}
    </PortalShell>
  );
}
