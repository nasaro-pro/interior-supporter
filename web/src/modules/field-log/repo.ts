import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { fieldWorkLogs } from "@/modules/field-log/schema";
import {
  assertSameProject,
  assertSameTenant,
  projectScoped,
  scoped,
  type DataContext,
} from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listFieldLogs(
  ctx: DataContext,
  projectId: string,
  workDate?: string,
) {
  const rows = await db
    .select()
    .from(fieldWorkLogs)
    .where(
      and(
        scoped(ctx, fieldWorkLogs),
        projectScoped(ctx, fieldWorkLogs),
        eq(fieldWorkLogs.projectId, projectId),
        isNull(fieldWorkLogs.deletedAt),
        workDate ? eq(fieldWorkLogs.workDate, workDate) : undefined,
      ),
    )
    .orderBy(desc(fieldWorkLogs.createdAt));
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function listFieldLogsByProjects(
  ctx: DataContext,
  projectIds: string[],
  workDate?: string,
) {
  if (projectIds.length === 0) return [];
  const rows = await db
    .select()
    .from(fieldWorkLogs)
    .where(
      and(
        scoped(ctx, fieldWorkLogs),
        projectScoped(ctx, fieldWorkLogs),
        inArray(fieldWorkLogs.projectId, projectIds),
        isNull(fieldWorkLogs.deletedAt),
        workDate ? eq(fieldWorkLogs.workDate, workDate) : undefined,
      ),
    )
    .orderBy(desc(fieldWorkLogs.createdAt));
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function findFieldLogById(ctx: DataContext, id: string) {
  const [row] = await db
    .select()
    .from(fieldWorkLogs)
    .where(
      and(
        eq(fieldWorkLogs.id, id),
        scoped(ctx, fieldWorkLogs),
        projectScoped(ctx, fieldWorkLogs),
        isNull(fieldWorkLogs.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function insertFieldLog(
  ctx: DataContext,
  values: typeof fieldWorkLogs.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(fieldWorkLogs).values(values).returning();
  if (!row) throw new Error("작업일지 저장에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function updateFieldLogRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof fieldWorkLogs.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(fieldWorkLogs)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(fieldWorkLogs.id, id),
        scoped(ctx, fieldWorkLogs),
        isNull(fieldWorkLogs.deletedAt),
      ),
    )
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}
