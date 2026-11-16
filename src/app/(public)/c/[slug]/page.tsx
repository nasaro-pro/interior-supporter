// PUB-10 공개 포트폴리오 목록 — 단순하게: 머리(업체·소개) → 사진 슬라이드(대표 사례, 천천히 넘김) → 사례 목록(사진+이름)
// 자세한 정보(평·주·공간별 사진·비포/애프터)는 사례 상세(PUB-11)에서. 데이터는 공개 RPC 만
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PortfolioGrid } from '@/features/portfolio/components/PortfolioGrid';
import { PortfolioIntro } from '@/features/portfolio/components/PortfolioHeads';
import { PortfolioSlideshow } from '@/features/portfolio/components/PortfolioSlideshow';
import { slideshowWorks } from '@/features/portfolio/lib/grid';
import { shareCover } from '@/features/portfolio/lib/parse';
import { portfolioRoutes, publicImageUrl } from '@/features/portfolio/routes';
import { getPublicPortfolio } from '@/features/portfolio/server/public-queries';

type Props = { params: Promise<{ slug: string }>; searchParams?: Promise<{ my?: string }> };

/** 카카오톡·문자로 주소를 보내면 대표 사진·업체명·소개가 카드로 보인다 (Open Graph) */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicPortfolio(slug);
  if (!data) return {};
  const t = await getTranslations('portfolio');
  const title = t('screen.public', { company: data.company.name });
  const cover = shareCover(data.works);
  return {
    title: { absolute: title },
    description: data.company.intro || undefined,
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: data.company.name,
      title,
      description: data.company.intro || undefined,
      images: cover
        ? [{ url: publicImageUrl(cover.path), width: cover.width, height: cover.height }]
        : undefined,
    },
  };
}

export default async function PublicPortfolioPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const t = await getTranslations('portfolio.account');
  const data = await getPublicPortfolio(slug); // layout 과 같은 요청이라 cache 로 한 번만 조회
  if (!data) notFound();
  return (
    <main data-screen-id="PUB-10" className="flex flex-col gap-16 md:gap-24">
      {sp.my === 'none' ? (
        // 로그인은 했지만 이 업체와 연결된 집도, 직원 자리도 없는 계정 (마이홈 갈림길이 돌려보낸 경우)
        <p
          role="status"
          className="bg-card mt-6 rounded-md border px-4 py-3 text-sm"
          data-ui-key="portfolio-account-none"
        >
          {t('notLinked')}
        </p>
      ) : null}
      <div>
        <PortfolioIntro company={data.company} />
        <PortfolioSlideshow
          slides={slideshowWorks(data.works, data.company.featuredLimit).map((w) => ({
            id: w.id,
            title: w.title,
            href: portfolioRoutes.work(data.company.slug, w.id),
            image: w.cover,
          }))}
        />
      </div>
      <PortfolioGrid
        slug={data.company.slug}
        works={data.works}
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
