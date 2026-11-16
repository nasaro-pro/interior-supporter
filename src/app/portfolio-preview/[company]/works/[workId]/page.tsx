// PM-65 미리보기 · 사례 상세 — 공개 상세(PUB-11)와 같은 모양 (비공개 사례도)
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireCompanyStaff } from '@/features/core';
import { PortfolioContactBand } from '@/features/portfolio/components/PortfolioContact';
import { PortfolioGallery } from '@/features/portfolio/components/PortfolioGallery';
import { PortfolioWorkHead } from '@/features/portfolio/components/PortfolioHeads';
import { portfolioRoutes } from '@/features/portfolio/routes';
import { getPortfolioPreviewWork } from '@/features/portfolio/server/preview-queries';

export const metadata = { robots: { index: false, follow: false } };

export default async function PortfolioPreviewWorkPage({
  params,
}: {
  params: Promise<{ company: string; workId: string }>;
}) {
  const { company, workId } = await params;
  const staff = await requireCompanyStaff(company);
  if (!z.guid().safeParse(workId).success) notFound();
  const work = await getPortfolioPreviewWork(staff.companyId, workId);
  if (!work) notFound();
  return (
    <main data-screen-id="PM-65" data-state="preview">
      <PortfolioWorkHead work={work} backHref={portfolioRoutes.preview(work.company.slug)} />
      <PortfolioGallery title={work.title} images={work.images} />
      <div className="mt-24 md:mt-32">
        <PortfolioContactBand company={work.company} />
      </div>
    </main>
  );
}
