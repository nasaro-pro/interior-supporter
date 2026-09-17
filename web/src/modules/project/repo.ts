import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { cursorCondition, cursorTs, decodeCursor, paginate } from "@/lib/cursor";
import { projects } from "@/modules/project/schema";
import { customers } from "@/modules/customer/schema";
import { memberships } from "@/modules/membership/schema";
import { users } from "@/modules/membership/auth-tables";
import {
  assertSameProject,
  assertSameTenant,
  scoped,
  type CompanyRole,
  type DataContext,
} from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function findProjectById(ctx: DataContext, projectId: string) {
  const [row] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        scoped(ctx, projects),
        // projects 의 프로젝트 축은 id 컬럼이다 (I11)
        ctx.kind === "customer" ? eq(projects.id, ctx.projectId) : undefined,
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  assertSameTenant(ctx, row);
  assertSameProject(ctx, { projectId: row.id });
  return row;
}

export async function findProjectStaff(
  userId: string,
  projectId: string,
): Promise<{
  companyId: string;
  managerId: string;
  roles: CompanyRole[];
} | null> {
  const rows = await db
    .select({
      companyId: projects.companyId,
      managerId: projects.managerId,
      role: memberships.role,
    })
    .from(projects)
    .innerJoin(
      memberships,
      and(
        eq(memberships.companyId, projects.companyId),
        eq(memberships.userId, userId),
        eq(memberships.isActive, true),
      ),
    )
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
  if (rows.length === 0) return null;
  return {
    companyId: rows[0].companyId,
    managerId: rows[0].managerId,
    roles: rows.map((r) => r.role),
  };
}

export async function insertProject(
  ctx: DataContext,
  values: typeof projects.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(projects).values(values).returning();
  if (!row) throw new Error("프로젝트 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function updateProjectRow(
  ctx: DataContext,
  projectId: string,
  patch: Partial<typeof projects.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(projects.id, projectId),
        scoped(ctx, projects),
        isNull(projects.deletedAt),
      ),
    )
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function listProjects(
  ctx: DataContext,
  filter: { cursor?: string; limit?: number; managerId?: string } = {},
) {
  const limit = filter.limit ?? 20;
  const rows = await db
    .select({
      project: projects,
      customerName: customers.name,
      managerName: users.name,
      cursorTs: cursorTs(projects.createdAt),
    })
    .from(projects)
    .innerJoin(customers, eq(customers.id, projects.customerId))
    .innerJoin(users, eq(users.id, projects.managerId))
    .where(
      and(
        scoped(ctx, projects),
        isNull(projects.deletedAt),
        filter.managerId ? eq(projects.managerId, filter.managerId) : undefined,
        cursorCondition(projects.createdAt, projects.id, decodeCursor(filter.cursor)),
      ),
    )
    .orderBy(desc(projects.createdAt), desc(projects.id))
    .limit(limit + 1);
  for (const row of rows) assertSameTenant(ctx, row.project);
  return paginate(rows, limit, (row) => ({
    createdAtRaw: row.cursorTs,
    id: row.project.id,
  }));
}

export async function countProjectsByStatus(ctx: DataContext) {
  const rows = await db
    .select({ status: projects.status, n: count() })
    .from(projects)
    .where(and(scoped(ctx, projects), isNull(projects.deletedAt)))
    .groupBy(projects.status);
  return rows;
}

export async function countActiveProjects(ctx: DataContext) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projects)
    .where(
      and(
        scoped(ctx, projects),
        isNull(projects.deletedAt),
        eq(projects.status, "active"),
      ),
    );
  return row?.n ?? 0;
}
