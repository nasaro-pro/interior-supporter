import { and, desc, eq, getTableColumns, inArray, isNull, lte } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { cursorCondition, cursorTs, decodeCursor, omitCursorTs, paginate } from "@/lib/cursor";
import { progressPhotos } from "@/modules/photo/schema";
import { assertSameProject, assertSameTenant, projectScoped, scoped, type DataContext } from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listPhotos(
  ctx: DataContext,
  projectId: string,
  processCategory: (typeof progressPhotos.$inferSelect)["processCategory"],
  opts?: { publishedOnly?: boolean; limit?: number; cursor?: string },
) {
  const limit = opts?.limit ?? 20;
  const rows = await db
    .select({
      ...getTableColumns(progressPhotos),
      cursorTs: cursorTs(progressPhotos.createdAt),
    })
    .from(progressPhotos)
    .where(
      and(
        scoped(ctx, progressPhotos),
        projectScoped(ctx, progressPhotos),
        eq(progressPhotos.projectId, projectId),
        eq(progressPhotos.processCategory, processCategory),
        isNull(progressPhotos.deletedAt),
        opts?.publishedOnly
          ? eq(progressPhotos.visibilityStatus, "published")
          : undefined,
        cursorCondition(progressPhotos.createdAt, progressPhotos.id, decodeCursor(opts?.cursor)),
      ),
    )
    .orderBy(desc(progressPhotos.createdAt), desc(progressPhotos.id))
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

export async function findPhotoById(
  ctx: DataContext,
  id: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select()
    .from(progressPhotos)
    .where(
      and(
        eq(progressPhotos.id, id),
        scoped(ctx, progressPhotos),
        projectScoped(ctx, progressPhotos),
        isNull(progressPhotos.deletedAt),
      ),
    )
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function insertPhoto(
  ctx: DataContext,
  values: typeof progressPhotos.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(progressPhotos).values(values).returning();
  if (!row) throw new Error("사진 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function updatePhotoRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof progressPhotos.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(progressPhotos)
    .set(patch)
    .where(and(eq(progressPhotos.id, id), scoped(ctx, progressPhotos), projectScoped(ctx, progressPhotos)))
    .returning();
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function listPhotosByProject(
  ctx: DataContext,
  projectId: string,
  opts?: { publishedOnly?: boolean; limit?: number; cursor?: string },
) {
  const limit = opts?.limit ?? 20;
  const rows = await db
    .select({
      ...getTableColumns(progressPhotos),
      cursorTs: cursorTs(progressPhotos.createdAt),
    })
    .from(progressPhotos)
    .where(
      and(
        scoped(ctx, progressPhotos),
        projectScoped(ctx, progressPhotos),
        eq(progressPhotos.projectId, projectId),
        isNull(progressPhotos.deletedAt),
        opts?.publishedOnly
          ? eq(progressPhotos.visibilityStatus, "published")
          : undefined,
        cursorCondition(progressPhotos.createdAt, progressPhotos.id, decodeCursor(opts?.cursor)),
      ),
    )
    .orderBy(desc(progressPhotos.createdAt), desc(progressPhotos.id))
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

export async function listPhotosByProjects(
  ctx: DataContext,
  projectIds: string[],
  opts?: { shotDate?: string },
) {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select()
    .from(progressPhotos)
    .where(
      and(
        scoped(ctx, progressPhotos),
        projectScoped(ctx, progressPhotos),
        inArray(progressPhotos.projectId, projectIds),
        isNull(progressPhotos.deletedAt),
        opts?.shotDate ? eq(progressPhotos.shotDate, opts.shotDate) : undefined,
      ),
    )
    .orderBy(desc(progressPhotos.createdAt));
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function listPhotosByPairGroupIds(
  ctx: DataContext,
  projectId: string,
  pairGroupIds: string[],
) {
  if (pairGroupIds.length === 0) return [];
  const rows = await db
    .select()
    .from(progressPhotos)
    .where(
      and(
        scoped(ctx, progressPhotos),
        projectScoped(ctx, progressPhotos),
        eq(progressPhotos.projectId, projectId),
        inArray(progressPhotos.pairGroupId, pairGroupIds),
        isNull(progressPhotos.deletedAt),
      ),
    );
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function listDueScheduledPhotos(ctx: DataContext, now: Date) {
  const rows = await db
    .select()
    .from(progressPhotos)
    .where(
      and(
        scoped(ctx, progressPhotos),
        projectScoped(ctx, progressPhotos),
        eq(progressPhotos.visibilityStatus, "scheduled"),
        lte(progressPhotos.publishAt, now),
        isNull(progressPhotos.deletedAt),
      ),
    );
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}
