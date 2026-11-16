// PUB-11 공개 사례 상세 — 머리(평·주·완공) → 비포·애프터 → 공간 탭 사진(크게 보기) → 상담 띠
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PortfolioContactBand } from '@/features/portfolio/components/PortfolioContact';
import { PortfolioGallery } from '@/features/portfolio/components/PortfolioGallery';
import { PortfolioWorkHead } from '@/features/portfolio/components/PortfolioHeads';
import { portfolioRoutes, publicImageUrl } from '@/features/portfolio/routes';
import { getPublicWork } from '@/features/portfolio/server/public-queries';

type Props = { params: Promise<{ slug: string; workId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, workId } = await params;
  const work = await getPublicWork(slug, workId);
  if (!work) return {};
  const t = await getTranslations('portfolio');
  const title = `${work.title} · ${t('screen.public', { company: work.company.name })}`;
  const cover =
    work.images.find((i) => i.role === 'after') ?? work.images.find((i) => i.role !== 'before');
  return {
    title: { absolute: title },
    description: work.summary.slice(0, 120) || undefined,
    openGraph: {
      type: 'article',
      locale: 'ko_KR',
      siteName: work.company.name,
      title,
      images: cover
        ? [{ url: publicImageUrl(cover.path), width: cover.width, height: cover.height }]
        : undefined,
    },
  };
}

export default async function PublicWorkPage({ params }: Props) {
  const { slug, workId } = await params;
  const work = await getPublicWork(slug, workId);
  if (!work) notFound();
  return (
    <main data-screen-id="PUB-11">
      <PortfolioWorkHead work={work} backHref={portfolioRoutes.home(work.company.slug)} />
      <PortfolioGallery title={work.title} images={work.images} />
      <div className="mt-24 md:mt-32">
        <PortfolioContactBand company={work.company} />
      </div>
    </main>
  );
}
