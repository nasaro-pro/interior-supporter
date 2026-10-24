// src/shared/lib/dates.ts (A · 스타터 고정) — 날짜·시각 계산과 표시는 이 파일로만 한다 (00 헌법 10.6, ADR-002)
// 규칙: timestamptz(ISO 문자열)는 KST 로 바꿔 표시한다. date('YYYY-MM-DD')·time('HH:MM')은 달력 값이므로 시간대를 바꾸지 않는다.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { enUS, ko } from 'date-fns/locale';

export const KST = 'Asia/Seoul';
export type DateLocale = 'ko' | 'en';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const HM = /^(\d{2}):(\d{2})(?::\d{2})?$/;

function kst(value: string | Date | number): TZDate {
  return new TZDate(new Date(value).getTime(), KST);
}

function calendar(ymd: string): TZDate {
  const m = YMD.exec(ymd);
  if (!m) throw new Error(`YYYY-MM-DD 형식이 아닙니다: ${ymd}`);
  return new TZDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]), KST);
}

/** timestamptz → 'YYYY-MM-DD' (KST 기준 날짜) */
export function toKstDate(value: string | Date | number): string {
  return format(kst(value), 'yyyy-MM-dd');
}

/** 오늘 (KST) 'YYYY-MM-DD' */
export function todayKst(now: Date | number = Date.now()): string {
  return toKstDate(now);
}

/** timestamptz → ko '2026. 10. 7.(수) 14:20' / en 'Oct 7, 2026, 2:20 PM' */
export function formatDateTime(value: string | Date | number, locale: DateLocale): string {
  const d = kst(value);
  return locale === 'ko'
    ? format(d, 'yyyy. M. d.(EEE) HH:mm', { locale: ko })
    : format(d, 'MMM d, yyyy, h:mm a', { locale: enUS });
}

/** timestamptz → ko '2026. 10. 7.(수)' / en 'Oct 7, 2026' */
export function formatDate(value: string | Date | number, locale: DateLocale): string {
  const d = kst(value);
  return locale === 'ko'
    ? format(d, 'yyyy. M. d.(EEE)', { locale: ko })
    : format(d, 'MMM d, yyyy', { locale: enUS });
}

/** date('YYYY-MM-DD') 달력 값 → ko '2026. 10. 7.(수)' / en 'Oct 7, 2026' (시간대 변환 없음) */
export function formatCalendarDate(ymd: string, locale: DateLocale): string {
  const d = calendar(ymd);
  return locale === 'ko'
    ? format(d, 'yyyy. M. d.(EEE)', { locale: ko })
    : format(d, 'MMM d, yyyy', { locale: enUS });
}

/** time('HH:MM[:SS]') 달력 값 → ko '14:20' / en '2:20 PM' */
export function formatCalendarTime(hm: string, locale: DateLocale): string {
  const m = HM.exec(hm);
  if (!m) throw new Error(`HH:MM 형식이 아닙니다: ${hm}`);
  const h = Number(m[1]);
  const min = m[2];
  if (locale === 'ko') return `${m[1]}:${min}`;
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${min} ${suffix}`;
}

/** 'YYYY-MM-DD' 의 요일 (0=일 … 6=토) — 캘린더 그리드(일요일 시작)용 */
export function weekdayOf(ymd: string): number {
  return calendar(ymd).getDay();
}

/** 기간 포함 판정 (양 끝 포함, POL-006·POL-023) — 모두 'YYYY-MM-DD' 문자열 */
export function isWithin(ymd: string, from: string | null, until: string | null): boolean {
  return (from === null || ymd >= from) && (until === null || ymd <= until);
}
