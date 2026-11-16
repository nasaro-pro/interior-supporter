// 관리자 미리보기 띠 — 공개 화면과 헷갈리지 않게 맨 위에 항상 보인다 (PM-65 화면 상태)
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';

export function PortfolioPreviewBanner({
  isPublic,
  draftCount,
  settingsHref,
  publicHref,
}: {
  isPublic: boolean;
  draftCount: number;
  settingsHref: string;
  publicHref: string;
}) {
  const t = useTranslations('portfolio');
  return (
    <div
      role="status"
      className="bg-foreground text-background"
      data-ui-key="portfolio-preview-banner"
    >
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm md:px-10">
        <span className="font-semibold">{t('preview.banner')}</span>
        <span className="inline-flex items-center gap-1.5 opacity-90">
          {isPublic ? (
            <Eye aria-hidden className="size-4" />
          ) : (
            <EyeOff aria-hidden className="size-4" />
          )}
          {isPublic ? t('preview.publicOn') : t('preview.publicOff')}
        </span>
        {draftCount > 0 ? (
          <span className="opacity-90">{t('preview.draftsIncluded', { n: draftCount })}</span>
        ) : null}
        <span className="ml-auto flex gap-4">
          {isPublic ? (
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
              data-ui-key="portfolio-preview-open-public"
            >
              {t('preview.openPublic')}
            </a>
          ) : null}
          <Link
            href={settingsHref}
            className="underline underline-offset-4"
            data-ui-key="portfolio-preview-settings"
          >
            {t('preview.toSettings')}
          </Link>
        </span>
      </div>
    </div>
  );
}

/** 미리보기 카드 위 '비공개' 배지 */
export function DraftBadge() {
  const t = useTranslations('portfolio');
  return (
    <span className="bg-background/95 text-foreground inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium">
      <EyeOff aria-hidden className="size-3.5" />
      {t('preview.draft')}
    </span>
  );
}
