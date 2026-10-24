// 요청 스레드 — 원문 → 정정 → 답변 서버 시각순, 작성자·시각 표시 (REQ-202, POL-019). 원문 수정 UI 없음
// 항목마다 카드: 머리(구분 배지·작성자·시각) → 본문. 원문은 강조 테두리
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

export function RequestThread({ entries }: { entries: RequestThreadEntry[] }) {
  const t = useTranslations('requests');
  const locale = useLocale() as DateLocale;
  return (
    <ol aria-label={t('thread.label')} className="flex flex-col gap-3">
      {entries.map((e) => {
        const k = KIND[e.kind];
        const fallback = e.kind === 'reply' ? t('author.staff') : t('author.unknown');
        return (
          <li
            key={`${e.kind}-${e.id}`}
            data-key={e.id}
            data-kind={e.kind}
            className={cn(
              'bg-card flex flex-col gap-2 rounded-lg border p-4',
              e.kind === 'original' && 'border-primary/40',
            )}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ToneBadge tone={k.tone} icon={k.icon}>
                {t(`thread.${e.kind}`)}
              </ToneBadge>
              <span className="text-sm font-medium">{e.authorName ?? fallback}</span>
              <time dateTime={e.createdAt} className="text-muted-foreground text-meta" data-numeric>
                {formatDateTime(e.createdAt, locale)}
              </time>
            </div>
            <p
              className={cn(
                'leading-relaxed break-words whitespace-pre-wrap',
                e.kind === 'original' ? 'text-base' : 'text-sm',
              )}
            >
              {e.body}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
