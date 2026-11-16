// PM-65 미리보기(화면 상태) — 직원만. 공개 꺼짐·비공개 사례도 공개 화면과 같은 모양으로 확인한다
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { requireCompanyStaff } from '@/features/core';
import { PortfolioPreviewBanner } from '@/features/portfolio/components/PortfolioPreviewBanner';
import { PortfolioShell } from '@/features/portfolio/components/PortfolioShell';
import { brandFontClass } from '@/features/portfolio/font';
import { portfolioRoutes } from '@/features/portfolio/routes';
import { getPortfolioPreview } from '@/features/portfolio/server/preview-queries';

export default async function PortfolioPreviewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const data = await getPortfolioPreview(staff.companyId);
  if (!data) notFound();
  const slug = data.company.slug;
  return (
    <PortfolioShell
      company={data.company}
      homeHref={portfolioRoutes.preview(slug)}
      fontClassName={brandFontClass}
      contactBar={false}
      banner={
        <PortfolioPreviewBanner
          isPublic={data.isPublic}
          draftCount={data.works.filter((w) => w.status === 'draft').length}
          settingsHref={portfolioRoutes.settings(slug)}
          publicHref={portfolioRoutes.home(slug)}
        />
      }
    >
      {children}
    </PortfolioShell>
  );
}
