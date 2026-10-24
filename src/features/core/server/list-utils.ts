// src/features/core/server/list-utils.ts (A) — 목록 공통: 커서(03 문서 5.1: (created_at, id))·검색어 정리
/** (created_at, id) → base64url 커서 */
export function encodeCursor(at: string, id: string): string {
  return Buffer.from(JSON.stringify([at, id]), 'utf8').toString('base64url');
}

const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/;
const UUID = /^[0-9a-f-]{36}$/i;

export function decodeCursor(cursor: string | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  try {
    const v: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (Array.isArray(v) && typeof v[0] === 'string' && typeof v[1] === 'string') {
      if (ISO.test(v[0]) && UUID.test(v[1])) return { at: v[0], id: v[1] };
    }
    return null;
  } catch (e) {
    // 잘못된 커서는 첫 페이지로 (사용자 입력이므로 오류로 다루지 않음)
    void e;
    return null;
  }
}

/**
 * PostgREST or() 필터에 들어가는 검색어 정리 — 구분자·와일드카드 제거, 80자 제한.
 * (SQL 조립이 아니라 쿼리 빌더 필터 문자열이므로 구문 문자만 제거한다)
 */
export function sanitizeSearch(q: string | undefined): string {
  if (!q) return '';
  return q
    .replace(/[,()*%\\:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** 'YYYY-MM-DD'(KST 달력) 시작·끝 → timestamptz 경계 */
export const kstDayStart = (ymd: string) => `${ymd}T00:00:00+09:00`;
export const kstDayEnd = (ymd: string) => `${ymd}T23:59:59.999+09:00`;
