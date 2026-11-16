// PUB-10·11 공통 틀 — 공개 포트폴리오 (로그인 없이). 공개가 꺼졌거나 없는 업체는 404 (존재 숨김)
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { PortfolioAccountLink } from '@/features/portfolio/components/PortfolioAccountLink';
import { PortfolioShell } from '@/features/portfolio/components/PortfolioShell';
import { brandFontClass } from '@/features/portfolio/font';
import { portfolioRoutes } from '@/features/portfolio/routes';
import { getPublicPortfolio } from '@/features/portfolio/server/public-queries';

export default async function PublicPortfolioLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicPortfolio(slug);
  if (!data) notFound();
  return (
    <PortfolioShell
      company={data.company}
      homeHref={portfolioRoutes.home(data.company.slug)}
      fontClassName={brandFontClass}
      account={<PortfolioAccountLink slug={data.company.slug} />}
    >
      {children}
    </PortfolioShell>
  );
}
