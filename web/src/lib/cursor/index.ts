import { and, eq, lt, or, sql, type Column, type SQL } from "drizzle-orm";

/**
 * ARCHITECTURE.md 16.2 — 커서는 (created_at, id) 복합이어야 한다.
 *
 * 왜 복합인가: created_at 단독 커서는 같은 시각의 행을 통째로 건너뛴다.
 * PostgreSQL 의 now()(= defaultNow())는 '트랜잭션 시작 시각'을 돌려주므로,
 * 한 트랜잭션에서 기록한 감사 로그 여러 건은 타임스탬프가 완전히 같다.
 *
 * 왜 JS Date 를 커서에 쓰지 않는가: timestamptz 는 마이크로초까지 저장하는데
 * JS Date 는 밀리초까지만 담는다(2026-09-12T19:11:07.968159Z -> .968Z).
 * 절삭된 값으로 `=` 비교를 하면 아무 행도 맞지 않아 결국 행을 잃는다.
 * 그래서 커서에는 **DB 가 만든 마이크로초 문자열을 그대로** 담고,
 * 비교할 때 ::timestamptz 로 되돌린다.
 */
export type Cursor = { createdAtRaw: string; id: string };

/** SELECT 에 함께 넣어 커서용 원본 타임스탬프 문자열을 받는다. */
export function cursorTs(createdAtCol: Column) {
  return sql<string>`to_char(${createdAtCol} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.createdAtRaw}|${c.id}`, "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.indexOf("|");
    if (sep < 1) return null;
    const createdAtRaw = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    if (!id || Number.isNaN(new Date(createdAtRaw).getTime())) return null;
    return { createdAtRaw, id };
  } catch {
    return null;
  }
}

/**
 * `ORDER BY created_at DESC, id DESC` 와 짝을 이루는 조건:
 *   created_at < c OR (created_at = c AND id < c.id)
 */
export function cursorCondition(
  createdAtCol: Column,
  idCol: Column,
  cursor: Cursor | null,
): SQL | undefined {
  if (!cursor) return undefined;
  const ts = sql`${cursor.createdAtRaw}::timestamptz`;
  return or(
    lt(createdAtCol, ts),
    and(eq(createdAtCol, ts), lt(idCol, cursor.id)),
  );
}

/** limit+1 로 조회한 결과를 잘라 다음 커서를 만든다. */
export function paginate<T>(
  rows: T[],
  limit: number,
  pick: (row: T) => Cursor,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(pick(last)) : null,
  };
}

export function omitCursorTs<T extends { cursorTs: string }>(
  row: T,
): Omit<T, "cursorTs"> {
  const { cursorTs: _cursorTs, ...rest } = row;
  void _cursorTs;
  return rest;
}
