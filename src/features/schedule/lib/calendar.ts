// 일정 달력 계산 — 'YYYY-MM-DD' 달력 값끼리의 산술만 한다 (POL-023: 시간대 변환 없음). 순수 함수.
// Date.UTC 는 달력 칸 계산용 숫자 도구로만 쓰고, 표시는 dates.ts 로 한다.
import { weekdayOf } from '@/shared/lib/dates';

const DAY_MS = 86_400_000;
const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function parts(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return [y, m, d];
}
function toUtc(ymd: string): number {
  const [y, m, d] = parts(ymd);
  return Date.UTC(y, m - 1, d);
}
function fromUtc(ms: number): string {
  const t = new Date(ms);
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  return fromUtc(toUtc(ymd) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

const MONTH = /^(\d{4})-(\d{2})$/;

export function parseMonthParam(
  value: string | undefined,
  today: string,
): { month: string; invalid: boolean } {
  const fallback = today.slice(0, 7);
  if (value === undefined || value === '') return { month: fallback, invalid: false };
  const m = MONTH.exec(value);
  if (!m) return { month: fallback, invalid: true };
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (y < 1900 || y > 2999 || mo < 1 || mo > 12) return { month: fallback, invalid: true };
  return { month: value, invalid: false };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const t = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 월간 그리드 — 일요일 시작, 앞뒤 달 날짜로 주를 채운다 (REQ-230) */
export function buildMonthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const last = `${month}-${pad(daysInMonth(month))}`;
  const start = addDaysYmd(first, -weekdayOf(first));
  const end = addDaysYmd(last, 6 - weekdayOf(last));
  const weeks: string[][] = [];
  for (let day = start; day <= end; day = addDaysYmd(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysYmd(day, i)));
  }
  return weeks;
}

/** 기준일이 속한 주(일~토) — 모바일 주간 목록 */
export function weekDays(anchor: string): string[] {
  const start = addDaysYmd(anchor, -weekdayOf(anchor));
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
}

export function eventEnd(e: { startDate: string; endDate: string | null }): string {
  return e.endDate ?? e.startDate;
}

/** 그날 걸친 일정 (종료일 포함) — 종일 먼저, 그다음 시작 시각·제목·id 순 */
export function eventsOnDay<
  T extends {
    id: string;
    title: string;
    startDate: string;
    endDate: string | null;
    startTime: string | null;
  },
>(events: T[], day: string): T[] {
  return events
    .filter((e) => e.startDate <= day && day <= eventEnd(e))
    .sort((a, b) => {
      if ((a.startTime === null) !== (b.startTime === null)) return a.startTime === null ? -1 : 1;
      const t = (a.startTime ?? '').localeCompare(b.startTime ?? '');
      if (t !== 0) return t;
      const n = a.title.localeCompare(b.title);
      return n !== 0 ? n : a.id.localeCompare(b.id);
    });
}

/** 타임라인 범위 — 프로젝트 공사 기간과 일정 범위를 합친다 */
export function timelineRange(
  project: { startDate: string | null; endDate: string | null },
  events: { startDate: string; endDate: string | null }[],
): { from: string; to: string } | null {
  const starts = [project.startDate, ...events.map((e) => e.startDate)].filter(
    (v): v is string => v !== null,
  );
  const ends = [project.endDate, project.startDate, ...events.map(eventEnd)].filter(
    (v): v is string => v !== null,
  );
  if (starts.length === 0 || ends.length === 0) return null;
  const from = starts.reduce((a, b) => (b < a ? b : a));
  const to = ends.reduce((a, b) => (b > a ? b : a));
  return { from, to: to < from ? from : to };
}

/** 타임라인 막대 위치(%) — 종료일 포함 */
export function spanPercent(
  range: { from: string; to: string },
  start: string,
  end: string,
): { left: number; width: number } {
  const total = daysBetween(range.from, range.to) + 1;
  const s = Math.max(0, daysBetween(range.from, start));
  const e = Math.min(total - 1, daysBetween(range.from, end));
  const left = (s / total) * 100;
  const width = (Math.max(1, e - s + 1) / total) * 100;
  return { left: Math.round(left * 100) / 100, width: Math.round(width * 100) / 100 };
}
