import { and, desc, eq, getTableColumns, inArray, isNull, lte } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { cursorCondition, cursorTs, decodeCursor, omitCursorTs, paginate } from "@/lib/cursor";
import { materials, materialStatusHistory } from "@/modules/material/schema";
import { assertSameProject, assertSameTenant, projectScoped, scoped, type DataContext } from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listMaterials(
  ctx: DataContext,
  projectId: string,
  spaceCategory: (typeof materials.$inferSelect)["spaceCategory"],
  opts?: { publishedOnly?: boolean; limit?: number; cursor?: string },
) {
  const limit = opts?.limit ?? 20;
  const rows = await db
    .select({
      ...getTableColumns(materials),
      cursorTs: cursorTs(materials.createdAt),
    })
    .from(materials)
    .where(
      and(
        scoped(ctx, materials),
        projectScoped(ctx, materials),
        eq(materials.projectId, projectId),
        eq(materials.spaceCategory, spaceCategory),
        isNull(materials.deletedAt),
        opts?.publishedOnly ? eq(materials.visibilityStatus, "published") : undefined,
        cursorCondition(materials.createdAt, materials.id, decodeCursor(opts?.cursor)),
      ),
    )
    .orderBy(desc(materials.createdAt), desc(materials.id))
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

export async function listMaterialsByIds(ctx: DataContext, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(materials)
    .where(
      and(
        scoped(ctx, materials),
        projectScoped(ctx, materials),
        inArray(materials.id, ids),
        isNull(materials.deletedAt),
      ),
    );
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function findMaterialById(
  ctx: DataContext,
  id: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select()
    .from(materials)
    .where(
      and(eq(materials.id, id), scoped(ctx, materials), projectScoped(ctx, materials), isNull(materials.deletedAt)),
    )
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function insertMaterial(
  ctx: DataContext,
  values: typeof materials.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(materials).values(values).returning();
  if (!row) throw new Error("자재 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function updateMaterialRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof materials.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(materials)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(materials.id, id), scoped(ctx, materials), projectScoped(ctx, materials)))
    .returning();
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function insertMaterialHistory(
  ctx: DataContext,
  values: typeof materialStatusHistory.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(materialStatusHistory).values(values).returning();
  if (!row) throw new Error("자재 이력 기록에 실패했습니다.");
  // material_status_history 에는 project_id 가 없다. 상위 material 이 이미 두 축으로 검증된다.
  assertSameTenant(ctx, row);
  return row;
}

export async function listMaterialHistoryByProject(
  ctx: DataContext,
  projectId: string,
  opts?: { materialIds?: string[] },
) {
  if (opts?.materialIds && opts.materialIds.length === 0) return [];
  const rows = await db
    .select({ history: materialStatusHistory, materialId: materials.id })
    .from(materialStatusHistory)
    .innerJoin(materials, eq(materials.id, materialStatusHistory.materialId))
    .where(
      and(
        scoped(ctx, materialStatusHistory),
        eq(materials.projectId, projectId),
        isNull(materials.deletedAt),
        opts?.materialIds ? inArray(materials.id, opts.materialIds) : undefined,
      ),
    )
    .orderBy(desc(materialStatusHistory.changedAt));
  for (const row of rows) assertSameTenant(ctx, row.history);
  return rows;
}

export async function listMaterialsByProject(
  ctx: DataContext,
  projectId: string,
  opts?: { publishedOnly?: boolean; limit?: number; cursor?: string },
) {
  const limit = opts?.limit ?? 20;
  const rows = await db
    .select({
      ...getTableColumns(materials),
      cursorTs: cursorTs(materials.createdAt),
    })
    .from(materials)
    .where(
      and(
        scoped(ctx, materials),
        projectScoped(ctx, materials),
        eq(materials.projectId, projectId),
        isNull(materials.deletedAt),
        opts?.publishedOnly ? eq(materials.visibilityStatus, "published") : undefined,
        cursorCondition(materials.createdAt, materials.id, decodeCursor(opts?.cursor)),
      ),
    )
    .orderBy(desc(materials.createdAt), desc(materials.id))
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

export async function listDueScheduledMaterials(ctx: DataContext, now: Date) {
  const rows = await db
    .select()
    .from(materials)
    .where(
      and(
        scoped(ctx, materials),
        projectScoped(ctx, materials),
        eq(materials.visibilityStatus, "scheduled"),
        lte(materials.publishAt, now),
        isNull(materials.deletedAt),
      ),
    );
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

