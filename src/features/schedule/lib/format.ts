// 일정 일시 표시 — date/time 달력 값은 시간대 변환 없이 dates.ts 로 (POL-023, 헌법 10.6)
import { formatCalendarDate, formatCalendarTime, type DateLocale } from '@/shared/lib/dates';

export function formatEventWhen(
  e: {
    startDate: string;
    startTime: string | null;
    endDate: string | null;
    endTime: string | null;
  },
  locale: DateLocale,
  labels: { allDay: string },
): string {
  const start = formatCalendarDate(e.startDate, locale);
  const startTime = e.startTime ? ` ${formatCalendarTime(e.startTime, locale)}` : '';
  const multiDay = e.endDate !== null && e.endDate !== e.startDate;
  let text = `${start}${startTime}`;
  if (multiDay) {
    const endTime = e.endTime ? ` ${formatCalendarTime(e.endTime, locale)}` : '';
    text += ` ~ ${formatCalendarDate(e.endDate!, locale)}${endTime}`;
  } else if (e.endTime) {
    text += ` ~ ${formatCalendarTime(e.endTime, locale)}`;
  }
  return e.startTime ? text : `${text} · ${labels.allDay}`;
}

/** 칩에 쓰는 짧은 시각 (종일이면 라벨) */
export function chipTime(startTime: string | null, locale: DateLocale, allDay: string): string {
  return startTime ? formatCalendarTime(startTime, locale) : allDay;
}
