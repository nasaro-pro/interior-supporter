// FW-04 현장 일정 (F2, 보기만) — 날짜·시간·내용
import { DateText } from '@/shared/ui/date-text';
import { timeRange } from '../lib/time';
import type { FieldScheduleItem } from '../types';

export function FieldScheduleList({ items }: { items: FieldScheduleItem[] }) {
  return (
    <ol className="bg-card divide-y rounded-lg border">
      {items.map((e) => {
        const time = timeRange(e.startTime, e.endTime);
        return (
          <li
            key={e.id}
            data-key={e.id}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4"
          >
            <p className="text-meta text-muted-foreground shrink-0 tabular-nums sm:w-48">
              <DateText value={e.startDate} kind="calendar" />
              {e.endDate && e.endDate !== e.startDate ? (
                <>
                  {' ~ '}
                  <DateText value={e.endDate} kind="calendar" />
                </>
              ) : null}
              {time ? ` · ${time}` : null}
            </p>
            <div className="min-w-0">
              <p className="font-medium wrap-anywhere">{e.title}</p>
              {e.description ? (
                <p className="text-muted-foreground text-sm wrap-anywhere whitespace-pre-line">
                  {e.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
