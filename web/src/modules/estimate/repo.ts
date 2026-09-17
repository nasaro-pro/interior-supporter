import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { estimateVersions } from "@/modules/estimate/schema";
import {
  assertSameProject,
  assertSameTenant,
  projectScoped,
  scoped,
  type DataContext,
} from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listEstimates(
  ctx: DataContext,
  projectId: string,
  opts?: { publishedOnly?: boolean },
) {
  const rows = await db
    .select()
    .from(estimateVersions)
    .where(
      and(
        scoped(ctx, estimateVersions),
        projectScoped(ctx, estimateVersions),
        eq(estimateVersions.projectId, projectId),
        isNull(estimateVersions.deletedAt),
        opts?.publishedOnly
          ? eq(estimateVersions.visibilityStatus, "published")
          : undefined,
      ),
    )
    .orderBy(desc(estimateVersions.versionNo));
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function findEstimateById(ctx: DataContext, id: string) {
  const [row] = await db
    .select()
    .from(estimateVersions)
    .where(
      and(
        eq(estimateVersions.id, id),
        scoped(ctx, estimateVersions),
        projectScoped(ctx, estimateVersions),
        isNull(estimateVersions.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function nextEstimateNo(
  ctx: DataContext,
  projectId: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select({
      n: sql<number>`coalesce(max(${estimateVersions.versionNo}), 0)`,
    })
    .from(estimateVersions)
    .where(
      and(
        scoped(ctx, estimateVersions),
        eq(estimateVersions.projectId, projectId),
      ),
    );
  return Number(row?.n ?? 0) + 1;
}

export async function insertEstimate(
  ctx: DataContext,
  values: typeof estimateVersions.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(estimateVersions).values(values).returning();
  if (!row) throw new Error("견적 등록에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function updateEstimateRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof estimateVersions.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(estimateVersions)
    .set(patch)
    .where(
      and(eq(estimateVersions.id, id), scoped(ctx, estimateVersions)),
    )
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}
