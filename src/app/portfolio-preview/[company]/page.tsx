// PM-65 미리보기 · 목록 — 공개 목록(PUB-10)과 같은 컴포넌트(슬라이드 + 업체가 고른 사례 배열), 링크만 미리보기 주소, 비공개 카드에 배지
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireCompanyStaff } from '@/features/core';
import { PortfolioGrid } from '@/features/portfolio/components/PortfolioGrid';
import { PortfolioIntro } from '@/features/portfolio/components/PortfolioHeads';
import { PortfolioSampleSlideshow } from '@/features/portfolio/components/PortfolioSampleSlideshow';
import { PortfolioSlideshow } from '@/features/portfolio/components/PortfolioSlideshow';
import { slideshowWorks, type PublicWorkCard } from '@/features/portfolio/lib/grid';
import { portfolioRoutes } from '@/features/portfolio/routes';
import { getPortfolioPreview } from '@/features/portfolio/server/preview-queries';

export const metadata = { robots: { index: false, follow: false } };

export default async function PortfolioPreviewPage({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company } = await params;
  const staff = await requireCompanyStaff(company);
  const data = await getPortfolioPreview(staff.companyId);
  if (!data) notFound();
  const slug = data.company.slug;
  const drafts = new Set(data.works.filter((w) => w.status === 'draft').map((w) => w.id));
  // 사례가 하나도 없으면 같은 틀에 견본 칸을 깔아, 처음 들어온 업체도 완성 모습(배열·색·글꼴)을 바로 본다. 미리보기 전용
  const empty = data.works.length === 0;
  const t = await getTranslations('portfolio.preview.sample');
  const sampleWorks: PublicWorkCard[] = SAMPLE_SPACES.map((spaces, i) => ({
    id: `sample-${i + 1}`,
    title: t('title', { n: i + 1 }),
    areaLabel: t('area'),
    sizePyeong: SAMPLE_PY[i] ?? null,
    spaces,
    completedOn: null,
    durationWeeks: SAMPLE_WEEKS[i] ?? null,
    isFeatured: false,
    cover: null,
  }));
  return (
    <main data-screen-id="PM-65" data-state="preview" className="flex flex-col gap-16 md:gap-24">
      {empty ? (
        <p
          role="status"
          className="bg-card -mb-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-4 py-3 text-sm md:-mb-16"
          data-ui-key="portfolio-preview-sample-notice"
        >
          <span>{t('notice')}</span>
          <Link
            href={portfolioRoutes.settings(slug)}
            className="font-medium underline underline-offset-4"
          >
            {t('addWork')}
          </Link>
        </p>
      ) : null}
      <div>
        <PortfolioIntro company={data.company} />
        {empty ? <PortfolioSampleSlideshow /> : null}
        <PortfolioSlideshow
          slides={slideshowWorks(data.works, data.company.featuredLimit).map((w) => ({
            id: w.id,
            title: w.title,
            href: portfolioRoutes.previewWork(slug, w.id),
            image: w.cover,
          }))}
        />
      </div>
      <PortfolioGrid
        slug={slug}
        works={empty ? sampleWorks : data.works}
        sample={empty}
        preview
        draftIds={[...drafts]}
        layout={data.company.worksLayout}
        galleryFilter={data.company.galleryFilter}
        carouselPer={data.company.carouselPer}
        mobileLayout={data.company.mobileWorksLayout}
        mobileCols={data.company.mobileGalleryCols}
        labels={data.company.labels}
      />
    </main>
  );
}

/** 견본 칸 6개 — 공간 필터·평형|기간 줄까지 실제와 같은 모양이 나오게 값만 채운다 */
const SAMPLE_SPACES: PublicWorkCard['spaces'][] = [
  ['living', 'kitchen'],
  ['bedroom'],
  ['bathroom'],
  ['living'],
  ['kitchen', 'bathroom'],
  ['bedroom', 'living'],
];
const SAMPLE_PY = [32, 24, 45, 33, 29, 38];
const SAMPLE_WEEKS = [8, 6, 10, 7, 5, 9];
