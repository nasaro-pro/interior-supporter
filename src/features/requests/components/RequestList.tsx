// 요청 목록 PM-06 / CL-06 — 제목·작성자·처리 상태·답변 여부·최근 활동 (REQ-200)
// 카드 면 위 행 목록. 행 전체가 상세 링크(제목 링크가 행을 덮는다), 키보드 포커스는 제목 링크
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, Link2, MessageSquareReply, MessageSquareDashed } from 'lucide-react';
import { formatDateTime, type DateLocale } from '@/shared/lib/dates';
import { ToneBadge } from '@/shared/ui/tone-badge';
import type { RequestListItem } from '../types';
import { RequestStatusBadge } from './RequestStatusBadge';

export function RequestList({
  items,
  detailHref,
  showAuthor,
}: {
  items: RequestListItem[];
  detailHref: (id: string) => string;
  /** 고객 화면은 본인 요청뿐이므로 작성자 열을 생략 */
  showAuthor: boolean;
}) {
  const t = useTranslations('requests');
  const tc = useTranslations('common');
  const locale = useLocale() as DateLocale;
  return (
    <ul aria-label={t('list.label')} className="bg-card divide-y rounded-lg border">
      {items.map((r) => (
        <li
          key={r.id}
          data-key={r.id}
          className="hover:bg-accent/60 focus-within:bg-accent/60 relative flex flex-col gap-2 px-4 py-3 motion-safe:transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={detailHref(r.id)}
              className="focus-visible:ring-ring/50 block truncate rounded-sm font-medium outline-none after:absolute after:inset-0 focus-visible:ring-3"
              data-ui-key="request-list-open"
            >
              {r.title}
            </Link>
            <p className="text-muted-foreground text-meta mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {showAuthor ? <span>{r.authorName ?? t('author.unknown')}</span> : null}
              {/* D-33: 항목에 연결된 메모는 "도안: 거실" 처럼 */}
              {r.target ? (
                <span className="inline-flex items-center gap-1" data-ui-key="request-target">
                  <Link2 aria-hidden className="size-3" />
                  {t(`target.${r.target.type}`, { label: r.target.label ?? t('target.unknown') })}
                </span>
              ) : null}
              <span>
                {t('list.lastActivity')}{' '}
                <time dateTime={r.lastActivityAt} data-numeric>
                  {formatDateTime(r.lastActivityAt, locale)}
                </time>
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {r.archived ? (
              <ToneBadge tone="neutral" icon={Archive}>
                {tc('filter.archived')}
              </ToneBadge>
            ) : null}
            <ToneBadge
              tone={r.hasReply ? 'brand' : 'neutral'}
              icon={r.hasReply ? MessageSquareReply : MessageSquareDashed}
            >
              {r.hasReply ? t('list.replied') : t('list.notReplied')}
            </ToneBadge>
            <RequestStatusBadge status={r.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
