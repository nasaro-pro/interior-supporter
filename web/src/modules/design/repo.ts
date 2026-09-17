import { and, desc, eq, getTableColumns, inArray, isNull, lte, sql } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { cursorCondition, cursorTs, decodeCursor, omitCursorTs, paginate } from "@/lib/cursor";
import { designVersions } from "@/modules/design/schema";
import { assertSameProject, assertSameTenant, projectScoped, scoped, type DataContext } from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listDesigns(
  ctx: DataContext,
  projectId: string,
  opts?: { publishedOnly?: boolean; limit?: number; cursor?: string },
) {
  const limit = opts?.limit ?? 20;
  const rows = await db
    .select({
      ...getTableColumns(designVersions),
      cursorTs: cursorTs(designVersions.createdAt),
    })
    .from(designVersions)
    .where(
      and(
        scoped(ctx, designVersions),
        projectScoped(ctx, designVersions),
        eq(designVersions.projectId, projectId),
        isNull(designVersions.deletedAt),
        opts?.publishedOnly
          ? eq(designVersions.visibilityStatus, "published")
          : undefined,
        cursorCondition(designVersions.createdAt, designVersions.id, decodeCursor(opts?.cursor)),
      ),
    )
    .orderBy(desc(designVersions.createdAt), desc(designVersions.id))
    .limit(limit + 1);
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  const page = paginate(rows, limit, (row) => ({
    createdAtRaw: row.cursorTs,
    id: row.id,
  }));
  return { items: page.items.map(omitCursorTs), nextCursor: page.nextCursor };
}

export async function listDesignsByIds(ctx: DataContext, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(designVersions)
    .where(
      and(
        scoped(ctx, designVersions),
        projectScoped(ctx, designVersions),
        inArray(designVersions.id, ids),
        isNull(designVersions.deletedAt),
      ),
    );
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function findDesignById(
  ctx: DataContext,
  id: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select()
    .from(designVersions)
    .where(
      and(
        eq(designVersions.id, id),
        scoped(ctx, designVersions),
        projectScoped(ctx, designVersions),
        isNull(designVersions.deletedAt),
      ),
    )
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function nextVersionNo(
  ctx: DataContext,
  projectId: string,
  tx: Executor,
) {
  const [row] = await tx
    .select({
      max: sql<number>`coalesce(max(${designVersions.versionNo}), 0)`,
    })
    .from(designVersions)
    .where(
      and(
        scoped(ctx, designVersions),
        projectScoped(ctx, designVersions),
        eq(designVersions.projectId, projectId),
        isNull(designVersions.deletedAt),
      ),
    );
  return Number(row?.max ?? 0) + 1;
}

export async function insertDesign(
  ctx: DataContext,
  values: typeof designVersions.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(designVersions).values(values).returning();
  if (!row) throw new Error("디자인 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function updateDesignRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof designVersions.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(designVersions)
    .set(patch)
    .where(and(eq(designVersions.id, id), scoped(ctx, designVersions), projectScoped(ctx, designVersions)))
    .returning();
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function listDueScheduledDesigns(ctx: DataContext, now: Date) {
  const rows = await db
    .select()
    .from(designVersions)
    .where(
      and(
        scoped(ctx, designVersions),
        projectScoped(ctx, designVersions),
        eq(designVersions.visibilityStatus, "scheduled"),
        lte(designVersions.publishAt, now),
        isNull(designVersions.deletedAt),
      ),
    );
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}
