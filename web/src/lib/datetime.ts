import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const SEOUL = "Asia/Seoul";

export function formatSeoul(
  value: Date | string | null | undefined,
  pattern = "yyyy-MM-dd HH:mm",
) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return formatInTimeZone(date, SEOUL, pattern);
}

export function seoulYearMonth(date = new Date()) {
  return formatInTimeZone(date, SEOUL, "yyyyMM");
}

/**
 * ARCHITECTURE.md 5.1 — 저장은 UTC, 표시·입력은 Asia/Seoul.
 *
 * `<input type="datetime-local">` 과 `<input type="date">` 는 타임존이 없는
 * 문자열을 보낸다. 이를 `new Date(...)` 로 바로 파싱하면 **서버의 로컬 타임존**
 * 으로 해석된다. 운영(Vercel=UTC)에서는 9시간이 밀린다.
 * 개발 환경이 KST 라 로컬에서는 절대 드러나지 않으므로 반드시 이 함수를 쓴다.
 *
 *   parseSeoulInput("2026-09-13T10:00") -> 2026-09-13T01:00:00.000Z
 *   parseSeoulInput("2026-09-13")       -> 2026-09-12T15:00:00.000Z
 */
export function parseSeoulInput(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("빈 날짜 입력입니다.");
  const normalized = trimmed.length === 10 ? `${trimmed}T00:00:00` : trimmed;
  const parsed = fromZonedTime(normalized, SEOUL);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${trimmed}`);
  }
  return parsed;
}

/** 값이 없으면 undefined 를 돌려주는 편의 함수 */
export function parseSeoulInputOptional(
  value: string | null | undefined,
): Date | undefined {
  if (!value || !value.trim()) return undefined;
  return parseSeoulInput(value);
}

/** 기간 필터의 끝 경계 — KST 그날 23:59:59.999 */
export function parseSeoulDayEnd(value: string): Date {
  const day = value.trim().slice(0, 10);
  return fromZonedTime(`${day}T23:59:59.999`, SEOUL);
}

/** Date -> `<input type="datetime-local">` 의 value (KST 기준) */
export function toSeoulInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return formatInTimeZone(date, SEOUL, "yyyy-MM-dd'T'HH:mm");
}

/** Date -> `<input type="date">` 의 value (KST 기준) */
export function toSeoulDateValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return formatInTimeZone(date, SEOUL, "yyyy-MM-dd");
}

/** 지금이 속한 달 (KST). `<input type="month">` 형식 */
export function seoulMonthValue(date = new Date()) {
  return formatInTimeZone(date, SEOUL, "yyyy-MM");
}

export function seoulDayValue(date = new Date()) {
  return formatInTimeZone(date, SEOUL, "yyyy-MM-dd");
}

/** "2026-09" -> KST 9월 1일 00:00 ~ 10월 1일 00:00 을 UTC 로 */
export function seoulMonthRange(monthValue: string): { from: Date; to: Date } {
  const [y, m] = monthValue.split("-").map(Number);
  const from = fromZonedTime(
    `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01T00:00:00`,
    SEOUL,
  );
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  const to = fromZonedTime(
    `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`,
    SEOUL,
  );
  return { from, to };
}

/**
 * 일요일 시작 월간 그리드 (2차 설계). 항상 6주(42칸).
 * date 는 KST `yyyy-MM-dd`.
 */
export function sundayMonthCells(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const first = fromZonedTime(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01T12:00:00`,
    SEOUL,
  );
  const isoDow = Number(formatInTimeZone(first, SEOUL, "i"));
  const offset = isoDow % 7;
  const cells: Array<{ date: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i += 1) {
    const utc = new Date(first.getTime() + (i - offset) * 86_400_000);
    const date = formatInTimeZone(utc, SEOUL, "yyyy-MM-dd");
    cells.push({ date, inMonth: date.startsWith(monthValue) });
  }
  return cells;
}
