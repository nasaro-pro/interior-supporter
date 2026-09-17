import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { customerRequests, requestCorrections } from "@/modules/request/schema";
import { users } from "@/modules/membership/auth-tables";
import {
  assertSameProject,
  assertSameTenant,
  projectScoped,
  scoped,
  type DataContext,
} from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listRequests(
  ctx: DataContext,
  projectId: string,
) {
  const rows = await db
    .select({
      request: customerRequests,
      authorName: users.name,
    })
    .from(customerRequests)
    .innerJoin(users, eq(users.id, customerRequests.authorId))
    .where(
      and(
        scoped(ctx, customerRequests),
        projectScoped(ctx, customerRequests),
        eq(customerRequests.projectId, projectId),
        isNull(customerRequests.deletedAt),
      ),
    )
    .orderBy(desc(customerRequests.createdAt));
  for (const row of rows) {
    assertSameTenant(ctx, row.request);
    assertSameProject(ctx, row.request);
  }
  return rows;
}

export async function findRequestById(ctx: DataContext, id: string) {
  const [row] = await db
    .select()
    .from(customerRequests)
    .where(
      and(
        eq(customerRequests.id, id),
        scoped(ctx, customerRequests),
        projectScoped(ctx, customerRequests),
        isNull(customerRequests.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function listCorrectionsForProject(ctx: DataContext, projectId: string) {
  const rows = await db
    .select()
    .from(requestCorrections)
    .where(
      and(
        scoped(ctx, requestCorrections),
        projectScoped(ctx, requestCorrections),
        eq(requestCorrections.projectId, projectId),
      ),
    )
    .orderBy(asc(requestCorrections.createdAt));
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function listCorrections(ctx: DataContext, requestId: string) {
  const rows = await db
    .select()
    .from(requestCorrections)
    .where(
      and(
        scoped(ctx, requestCorrections),
        eq(requestCorrections.requestId, requestId),
      ),
    )
    .orderBy(asc(requestCorrections.createdAt));
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function insertRequest(
  ctx: DataContext,
  values: typeof customerRequests.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(customerRequests).values(values).returning();
  if (!row) throw new Error("요청 등록에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function insertCorrection(
  ctx: DataContext,
  values: typeof requestCorrections.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(requestCorrections).values(values).returning();
  if (!row) throw new Error("정정 기록 저장에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function updateRequestRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof customerRequests.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(customerRequests)
    .set(patch)
    .where(and(eq(customerRequests.id, id), scoped(ctx, customerRequests)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}
