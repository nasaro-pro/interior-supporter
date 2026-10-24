// 요청 상세 헤더 (D4: 제목·상태 배지 → 메타, 02 문서 5장) — PM-16·CL-16 공통
// 프로젝트 헤더(h1)가 위에 있으므로 상세 제목은 h2(20px)
import { useLocale, useTranslations } from 'next-intl';
import { Archive, ArrowLeft } from 'lucide-react';
import { formatDateTime, type DateLocale } from '@/shared/lib/dates';
import { ButtonLink } from '@/shared/ui/button-link';
import { Notice } from '@/shared/ui/notice';
import { ToneBadge } from '@/shared/ui/tone-badge';
import type { RequestDetail } from '../types';
import { RequestStatusBadge } from './RequestStatusBadge';

export function RequestDetailHeader({
  detail,
  listHref,
}: {
  detail: RequestDetail;
  listHref: string;
}) {
  const t = useTranslations('requests');
  const tc = useTranslations('common');
  const locale = useLocale() as DateLocale;
  return (
    <header className="flex flex-col gap-3">
      <div>
        <ButtonLink href={listHref} variant="ghost" size="sm" data-ui-key="request-detail-back">
          <ArrowLeft aria-hidden />
          {t('screen.list')}
        </ButtonLink>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 text-xl font-semibold tracking-tight break-words">{detail.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {detail.archivedAt ? (
            <ToneBadge tone="neutral" icon={Archive}>
              {tc('filter.archived')}
            </ToneBadge>
          ) : null}
          <RequestStatusBadge status={detail.status} />
        </div>
      </div>
      <dl className="text-muted-foreground text-meta flex flex-wrap gap-x-6 gap-y-1">
        <div className="flex gap-2">
          <dt>{t('field.author')}</dt>
          <dd className="text-foreground">{detail.authorName ?? t('author.unknown')}</dd>
        </div>
        <div className="flex gap-2">
          <dt>{t('field.createdAt')}</dt>
          <dd data-numeric>
            <time dateTime={detail.createdAt}>{formatDateTime(detail.createdAt, locale)}</time>
          </dd>
        </div>
      </dl>
      {detail.archivedAt ? <Notice tone="neutral">{tc('state.archivedItem')}</Notice> : null}
    </header>
  );
}
