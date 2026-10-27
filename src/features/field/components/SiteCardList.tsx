// FW-00 내 현장 카드 (F1) — 현장 이름·업체·주소·배정 기간·오늘 일정, 카드에서 현장 탭과 사진으로 바로 간다
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarDays, Camera, MapPin } from 'lucide-react';
import { routes } from '@/shared/contracts/routes';
import { ButtonLink } from '@/shared/ui/button-link';
import { PeriodText } from '@/shared/ui/date-text';
import type { FieldSiteCard } from '../types';

export function SiteCardList({ sites }: { sites: FieldSiteCard[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sites.map((s) => (
        <li key={s.projectId} data-key={s.projectId}>
          <SiteCard site={s} />
        </li>
      ))}
    </ul>
  );
}

function SiteCard({ site }: { site: FieldSiteCard }) {
  const t = useTranslations('field');
  return (
    <article className="bg-card flex h-full flex-col gap-3 rounded-lg border p-4">
      <div className="min-w-0">
        <p className="text-muted-foreground text-meta truncate">{site.companyName}</p>
        <h2 className="text-lg font-semibold wrap-anywhere">
          <Link
            href={routes.field.siteHome(site.projectId)}
            className="underline-offset-4 hover:underline"
            data-ui-key="field-site-open"
          >
            {site.name}
          </Link>
        </h2>
        {site.siteAddress ? (
          <p className="text-muted-foreground text-meta mt-1 flex items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="wrap-anywhere">{site.siteAddress}</span>
          </p>
        ) : null}
      </div>
      <p className="text-meta">
        <span className="text-muted-foreground">{t('card.period')} </span>
        <PeriodText from={site.validFrom} until={site.validUntil} emptyLabel={t('card.noLimit')} />
      </p>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-meta flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          {t('card.today')}
        </p>
        {site.todayEvents.length > 0 ? (
          <ul className="flex flex-wrap gap-1">
            {site.todayEvents.map((title, i) => (
              <li key={`${i}-${title}`} className="bg-muted rounded px-2 py-0.5 text-sm">
                {title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">{t('card.noToday')}</p>
        )}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <ButtonLink
          href={routes.field.photos(site.projectId)}
          variant="outline"
          size="sm"
          data-ui-key="field-site-photos"
        >
          <Camera className="size-4" aria-hidden />
          {t('card.photos')}
        </ButtonLink>
      </div>
    </article>
  );
}
