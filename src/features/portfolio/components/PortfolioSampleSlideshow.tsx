// 관리자 미리보기 전용 — 사례가 하나도 없을 때 맨 위 사진 슬라이드 자리를 같은 크기의 견본 칸으로 보여 준다.
// 공개 페이지에서는 쓰지 않는다 (손님에게 빈 칸·견본이 보이지 않게)
import { useTranslations } from 'next-intl';
import { ImageIcon } from 'lucide-react';

export function PortfolioSampleSlideshow() {
  const t = useTranslations('portfolio.preview.sample');
  return (
    <section aria-label={t('slideLabel')} data-ui-key="portfolio-slideshow-sample">
      <div className="bg-muted text-muted-foreground relative flex aspect-[4/3] flex-col items-center justify-center gap-2 overflow-hidden rounded-[4px] px-6 text-center md:aspect-[21/9]">
        <ImageIcon aria-hidden className="size-8 stroke-[1.25] opacity-60" />
        <p className="text-sm font-medium">{t('slide')}</p>
        <p className="text-xs">{t('slideHint')}</p>
        <span className="bg-background/95 text-foreground absolute top-3 left-3 inline-flex h-6 items-center rounded-md px-2 text-xs font-medium">
          {t('badge')}
        </span>
      </div>
    </section>
  );
}
