// src/shared/ui/date-text.tsx (A) — KST 날짜·시각 표시 (dates.ts 만 사용, 00 헌법 10.6)
import { useLocale } from 'next-intl';
import {
  formatCalendarDate,
  formatDate,
  formatDateTime,
  type DateLocale,
} from '@/shared/lib/dates';

type Props =
  | { value: string; kind?: 'datetime' | 'date' }
  | { value: string; kind: 'calendar' /* date 컬럼 'YYYY-MM-DD' */ };

export function DateText({ value, kind = 'datetime' }: Props) {
  const locale = (useLocale() === 'en' ? 'en' : 'ko') as DateLocale;
  const text =
    kind === 'calendar'
      ? formatCalendarDate(value, locale)
      : kind === 'date'
        ? formatDate(value, locale)
        : formatDateTime(value, locale);
  return <time dateTime={value}>{text}</time>;
}

/** 'YYYY-MM-DD ~ YYYY-MM-DD' 기간 (달력 값, 양 끝 포함) */
export function PeriodText({
  from,
  until,
  emptyLabel,
}: {
  from: string | null;
  until: string | null;
  emptyLabel: string;
}) {
  if (!from && !until) return <span>{emptyLabel}</span>;
  return (
    <span className="tabular-nums">
      {from ? <DateText value={from} kind="calendar" /> : '…'}
      {' ~ '}
      {until ? <DateText value={until} kind="calendar" /> : '…'}
    </span>
  );
}
