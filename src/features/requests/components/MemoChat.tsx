// 메모 대화창 (CL-06 메모 탭 · 도안 · 자재 옆 메모 칸 공용, 2026-11 새 디자인)
// 메모(원문) · 정정 · 답변을 시간 순으로 한 대화처럼: 보는 사람 글은 오른쪽(진한 브라운), 상대 글은 왼쪽(연한 베이지)
// 원문 위에는 연결 항목 카드(도안 · 자재), 아래에는 처리 상태(누르면 메모 상세). 날짜가 바뀌면 구분선
import Link from 'next/link';
import { ChevronRight, FileImage, Package } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, formatDateTime, toKstDate, type DateLocale } from '@/shared/lib/dates';
import { cn } from '@/shared/lib/utils';
import type { RequestStatus } from '@/shared/contracts/domain';
import type { RequestTarget, RequestThreadEntry } from '../types';

export interface ChatMemo {
  id: string;
  status: RequestStatus;
  target?: RequestTarget | null;
  entries: RequestThreadEntry[];
}

type Line =
  | { type: 'day'; key: string; label: string }
  | {
      type: 'msg';
      key: string;
      entry: RequestThreadEntry;
      mine: boolean;
      memo: ChatMemo;
      first: boolean;
      last: boolean;
    };

function timeOf(iso: string, locale: DateLocale) {
  const full = formatDateTime(iso, locale);
  return locale === 'ko' ? full.slice(-5) : (full.split(', ').pop() ?? full);
}

export function MemoChat({
  memos,
  perspective = 'customer',
  memoHref,
  targetHref,
  compact = false,
}: {
  memos: ChatMemo[];
  perspective?: 'customer' | 'editor';
  /** 처리 상태를 누르면 여는 메모 상세 */
  memoHref: (id: string) => string;
  /** 연결 항목 카드를 누르면 여는 도안 · 자재 화면 (없으면 카드를 그리지 않는다) */
  targetHref?: (target: RequestTarget) => string;
  /** 옆 메모 칸처럼 좁은 곳 — 날짜 구분선 없이 */
  compact?: boolean;
}) {
  const t = useTranslations('requests');
  const locale = (useLocale() === 'en' ? 'en' : 'ko') as DateLocale;

  // 메모마다 마지막 내 글 아래에 상태를 붙이고, 전체는 시간 순으로 섞는다
  const flat = memos.flatMap((memo) => {
    const mineIds = memo.entries
      .filter((e) => (perspective === 'customer' ? e.kind !== 'reply' : e.kind === 'reply'))
      .map((e) => e.id);
    return memo.entries.map((entry) => ({
      entry,
      memo,
      mine: perspective === 'customer' ? entry.kind !== 'reply' : entry.kind === 'reply',
      first: entry.kind === 'original',
      last: entry.id === mineIds.at(-1),
    }));
  });
  flat.sort((a, b) => Date.parse(a.entry.createdAt) - Date.parse(b.entry.createdAt));
  const lines: Line[] = [];
  let day = '';
  for (const m of flat) {
    const d = toKstDate(m.entry.createdAt);
    if (!compact && d !== day) {
      day = d;
      lines.push({ type: 'day', key: `day-${d}`, label: formatDate(m.entry.createdAt, locale) });
    }
    lines.push({ type: 'msg', key: `${m.entry.kind}-${m.entry.id}`, ...m });
  }

  return (
    <ol
      aria-label={t('thread.label')}
      className={cn('flex flex-col', compact ? 'gap-4' : 'gap-6')}
      data-ui-key="memo-chat"
    >
      {lines.map((l) => {
        if (l.type === 'day') {
          return (
            <li
              key={l.key}
              className="text-muted-foreground flex items-center gap-3 text-xs"
              data-numeric
            >
              <span aria-hidden className="bg-border h-px flex-1" />
              {l.label}
              <span aria-hidden className="bg-border h-px flex-1" />
            </li>
          );
        }
        const { entry, mine, memo, first, last } = l;
        const time = (
          <time
            dateTime={entry.createdAt}
            className="text-muted-foreground shrink-0 text-[11px] whitespace-nowrap tabular-nums"
          >
            {timeOf(entry.createdAt, locale)}
          </time>
        );
        if (!mine) {
          const name = entry.authorName ?? t('author.staff');
          return (
            <li key={l.key} className="flex items-start gap-2.5" data-side="theirs">
              <span
                aria-hidden
                className="bg-tone-brand-bg grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold"
              >
                {name.trim().slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="text-muted-foreground mb-1 text-xs">{name}</p>
                <div className="flex items-end gap-2">
                  <p className="bg-muted max-w-[min(70vw,28rem)] rounded-[18px] rounded-tl-[6px] px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                    {entry.body}
                  </p>
                  {time}
                </div>
              </div>
            </li>
          );
        }
        return (
          <li key={l.key} className="flex flex-col items-end gap-1.5" data-side="mine">
            {first && memo.target && targetHref ? (
              <Link
                href={targetHref(memo.target)}
                className="bg-card hover:border-foreground/25 flex max-w-full items-center gap-2.5 rounded-lg border py-1.5 pr-3 pl-2 text-left"
                data-ui-key="memo-chat-target"
              >
                <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded">
                  {memo.target.type === 'designs' ? (
                    <FileImage aria-hidden className="size-4" />
                  ) : (
                    <Package aria-hidden className="size-4" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="text-muted-foreground block text-[11px]">
                    {t(`chat.targetKind.${memo.target.type}`)}
                  </span>
                  <span className="block truncate text-[13px] font-medium">
                    {memo.target.label ?? t('target.unknown')}
                  </span>
                </span>
                <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
              </Link>
            ) : null}
            <div className="flex items-end gap-2">
              {time}
              <p className="max-w-[min(78vw,28rem)] rounded-[18px] rounded-br-[6px] bg-(--chat-mine,var(--primary)) px-4 py-2.5 text-[15px] leading-relaxed break-words whitespace-pre-wrap text-(--chat-mine-foreground,var(--primary-foreground))">
                {entry.body}
              </p>
            </div>
            {last ? (
              <Link
                href={memoHref(memo.id)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px]"
                data-ui-key="memo-chat-status"
              >
                {t(`status.${memo.status}`)}
                <ChevronRight aria-hidden className="size-3" />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
