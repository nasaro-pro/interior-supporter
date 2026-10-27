// 요청 스레드 — 원문 → 정정 → 답변 서버 시각순, 작성자·시각 표시 (REQ-202, POL-019). 원문 수정 UI 없음
// D-33 · CU-06: 대화형(말풍선) — 보는 사람의 글은 오른쪽, 상대 글은 왼쪽. 구분 배지(원문·정정·답변)는 그대로
import { useLocale, useTranslations } from 'next-intl';
import { FileText, MessageSquareReply, PencilLine, type LucideIcon } from 'lucide-react';
import { formatDateTime, type DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import { ToneBadge, type Tone } from '@/shared/ui/tone-badge';
import type { RequestThreadEntry, RequestThreadKind } from '../types';

const KIND: Record<RequestThreadKind, { tone: Tone; icon: LucideIcon }> = {
  original: { tone: 'brand', icon: FileText },
  correction: { tone: 'attention', icon: PencilLine },
  reply: { tone: 'neutral', icon: MessageSquareReply },
};

/** 보는 사람 기준 — editor: 답변이 내 글 / customer: 원문·정정이 내 글 */
export type ThreadPerspective = 'editor' | 'customer';

export function RequestThread({
  entries,
  perspective = 'editor',
  compact = false,
}: {
  entries: RequestThreadEntry[];
  perspective?: ThreadPerspective;
  /** 옆 메모 패널처럼 좁은 곳 */
  compact?: boolean;
}) {
  const t = useTranslations('requests');
  const locale = useLocale() as DateLocale;
  return (
    <ol aria-label={t('thread.label')} className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3')}>
      {entries.map((e) => {
        const k = KIND[e.kind];
        const fallback = e.kind === 'reply' ? t('author.staff') : t('author.unknown');
        const mine = perspective === 'editor' ? e.kind === 'reply' : e.kind !== 'reply';
        return (
          <li
            key={`${e.kind}-${e.id}`}
            data-key={e.id}
            data-kind={e.kind}
            data-side={mine ? 'mine' : 'theirs'}
            className={cn('flex', mine ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'flex max-w-[88%] min-w-0 flex-col gap-1.5 rounded-2xl border',
                compact ? 'px-3 py-2' : 'px-4 py-3',
                mine ? 'bg-primary/10 border-primary/30 rounded-br-sm' : 'bg-card rounded-bl-sm',
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <ToneBadge tone={k.tone} icon={k.icon} size="sm">
                  {t(`thread.${e.kind}`)}
                </ToneBadge>
                <span className="text-meta font-medium">{e.authorName ?? fallback}</span>
                <time
                  dateTime={e.createdAt}
                  className="text-muted-foreground text-meta"
                  data-numeric
                >
                  {formatDateTime(e.createdAt, locale)}
                </time>
              </div>
              <p
                className={cn(
                  'leading-relaxed break-words whitespace-pre-wrap',
                  compact ? 'text-sm' : e.kind === 'original' ? 'text-base' : 'text-sm',
                )}
              >
                {e.body}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
