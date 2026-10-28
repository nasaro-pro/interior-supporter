// 사진 목록 — 촬영일 기준 묶음, 카드 → 상세 (PM-07 · CL-07 · FW-01)
// 촬영일 구획 머리 + 카드 격자(모바일 2열 · lg 3열). 카드 전체가 상세 링크
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, MessageSquare } from 'lucide-react';
import { formatCalendarDate, type DateLocale } from '@/shared/lib/dates';
import { Section } from '@/shared/ui/section';
import { ToneBadge } from '@/shared/ui/tone-badge';
import { groupPhotosByDate } from '../lib/group';
import { uploaderLabel } from '../lib/uploader-label';
import type { PhotoItem } from '../types';
import { PhotoImage } from './PhotoImage';
import { PhotoVisibilityBadge } from './PhotoVisibilityBadge';

export function PhotoGrid({
  items,
  detailHref,
  showVisibility,
  showUploader,
  commentCounts,
}: {
  items: PhotoItem[];
  detailHref: (photo: PhotoItem) => string;
  /** 고객 화면에는 공개 여부를 그리지 않는다 (공개분만 보이므로) */
  showVisibility: boolean;
  showUploader: boolean;
  /** D-34 · CU-07 사진별 댓글 수 — 시공팀 화면은 넘기지 않는다 (POL-005) */
  commentCounts?: Record<string, number>;
}) {
  const t = useTranslations('photos');
  const tc = useTranslations('common');
  const locale = useLocale() as DateLocale;
  const groups = groupPhotosByDate(items);
  return (
    <div aria-label={t('list.label')} role="group" className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.date ?? 'none'} data-key={g.date ?? 'none'}>
          <Section
            as="h3"
            label={g.date ?? t('list.noDate')}
            title={
              g.date ? (
                <time dateTime={g.date} data-numeric>
                  {formatCalendarDate(g.date, locale)}
                </time>
              ) : (
                t('list.noDate')
              )
            }
            meta={tc('list.count', { count: g.items.length })}
          >
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
              {g.items.map((p) => (
                <li
                  key={p.id}
                  data-key={p.id}
                  className="group bg-card hover:border-primary/40 focus-within:ring-ring/50 relative flex min-w-0 flex-col overflow-hidden rounded-lg border focus-within:ring-3 motion-safe:transition-colors"
                >
                  <Link
                    href={detailHref(p)}
                    className="block outline-none after:absolute after:inset-0"
                    data-ui-key="photo-card-open"
                  >
                    <PhotoImage
                      fileId={p.thumbFileId ?? p.fileId}
                      alt={t('detail.imageAlt', { phase: t(`phase.${p.phase}`) })}
                      className="aspect-[4/3] w-full"
                    />
                    <span className="sr-only">{p.description}</span>
                  </Link>
                  <div className="flex min-w-0 flex-col gap-1.5 p-3">
                    <p className="text-meta font-medium">{t(`phase.${p.phase}`)}</p>
                    {p.description ? (
                      <p className="line-clamp-2 text-sm break-words">{p.description}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {showVisibility ? <PhotoVisibilityBadge isPublic={p.isPublic} /> : null}
                      {p.archived ? (
                        <ToneBadge tone="neutral" icon={Archive}>
                          {tc('filter.archived')}
                        </ToneBadge>
                      ) : null}
                      {commentCounts?.[p.id] ? (
                        <ToneBadge
                          tone="neutral"
                          icon={MessageSquare}
                          data-ui-key="photo-comment-count"
                        >
                          {t('list.commentCount', { count: commentCounts[p.id]! })}
                        </ToneBadge>
                      ) : null}
                    </div>
                    {showUploader ? (
                      <p className="text-muted-foreground text-meta truncate">
                        {uploaderLabel(t, p)}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      ))}
    </div>
  );
}
