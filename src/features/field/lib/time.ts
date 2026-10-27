// 일정 시간 표시 — 순수 함수

/** 'HH:MM' 또는 'HH:MM–HH:MM'. 시작 시간이 없으면(종일) 빈 문자열 */
export function timeRange(start: string | null, end: string | null): string {
  if (!start) return '';
  return end ? `${start}–${end}` : start;
}
