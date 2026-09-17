import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { cursorCondition, cursorTs, decodeCursor, paginate } from "@/lib/cursor";
import { comments } from "@/modules/comment/schema";
import { users } from "@/modules/membership/auth-tables";
import { assertSameProject, assertSameTenant, projectScoped, scoped, type DataContext } from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

/**
 * 댓글 목록.
 *
 * R12 예외: `isNull(deletedAt)` 을 넣지 않는다. 문서② 4.5 가 삭제된 댓글을
 * "삭제된 댓글입니다"로 표시하고 이력을 보존하라고 정했기 때문이다.
 * 본문은 렌더 시점에 가린다.
 *
 * R11: (created_at, id) 복합 커서. 한 페이지는 시간순으로 돌려준다.
 */
export async function listComments(
  ctx: DataContext,
  projectId: string,
  opts: { limit?: number; cursor?: string } = {},
) {
  const limit = opts.limit ?? 20;
  const rows = await db
    .select({
      comment: comments,
      authorName: users.name,
      cursorTs: cursorTs(comments.createdAt),
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.authorId))
    .where(
      and(
        scoped(ctx, comments),
        projectScoped(ctx, comments),
        eq(comments.projectId, projectId),
        cursorCondition(comments.createdAt, comments.id, decodeCursor(opts.cursor)),
      ),
    )
    .orderBy(desc(comments.createdAt), desc(comments.id))
    .limit(limit + 1);
  for (const row of rows) {
    assertSameTenant(ctx, row.comment);
    assertSameProject(ctx, row.comment);
  }
  const page = paginate(rows, limit, (row) => ({
    createdAtRaw: row.cursorTs,
    id: row.comment.id,
  }));
  return {
    items: page.items
      .map(({ comment, authorName }) => ({ comment, authorName }))
      .reverse(),
    nextCursor: page.nextCursor,
  };
}

export async function findCommentById(
  ctx: DataContext,
  id: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), scoped(ctx, comments), projectScoped(ctx, comments)))
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function insertComment(
  ctx: DataContext,
  values: typeof comments.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(comments).values(values).returning();
  if (!row) throw new Error("댓글 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function updateCommentRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof comments.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(comments)
    .set(patch)
    .where(
      and(eq(comments.id, id), scoped(ctx, comments), projectScoped(ctx, comments), isNull(comments.deletedAt)),
    )
    .returning();
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}
