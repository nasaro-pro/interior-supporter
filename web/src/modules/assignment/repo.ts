import { and, eq, isNull, lte, or, gte, desc } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { projectAssignments } from "@/modules/assignment/schema";
import { projects } from "@/modules/project/schema";
import { users } from "@/modules/membership/auth-tables";
import {
  assertSameProject,
  assertSameTenant,
  projectScoped,
  scoped,
  type DataContext,
} from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

function activeNow(now: Date) {
  return and(
    isNull(projectAssignments.revokedAt),
    lte(projectAssignments.startsAt, now),
    or(
      isNull(projectAssignments.endsAt),
      gte(projectAssignments.endsAt, now),
    ),
  );
}

export async function findActiveAssignment(
  ctx: DataContext,
  projectId: string,
  userId: string,
  role?: "designer" | "field_worker",
  now = new Date(),
) {
  const [row] = await db
    .select()
    .from(projectAssignments)
    .where(
      and(
        scoped(ctx, projectAssignments),
        projectScoped(ctx, projectAssignments),
        eq(projectAssignments.projectId, projectId),
        eq(projectAssignments.userId, userId),
        role ? eq(projectAssignments.assignmentRole, role) : undefined,
        activeNow(now),
      ),
    )
    .limit(1);
  if (!row) return null;
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function listAssignments(ctx: DataContext, projectId?: string) {
  const rows = await db
    .select({
      assignment: projectAssignments,
      userName: users.name,
      userEmail: users.email,
      projectTitle: projects.title,
    })
    .from(projectAssignments)
    .innerJoin(users, eq(users.id, projectAssignments.userId))
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(
      and(
        scoped(ctx, projectAssignments),
        projectId ? eq(projectAssignments.projectId, projectId) : undefined,
        isNull(projectAssignments.revokedAt),
      ),
    )
    .orderBy(desc(projectAssignments.createdAt));
  for (const row of rows) assertSameTenant(ctx, row.assignment);
  return rows;
}

export async function listMyAssignments(ctx: DataContext, userId: string) {
  const now = new Date();
  const rows = await db
    .select({
      assignment: projectAssignments,
      projectTitle: projects.title,
      projectId: projects.id,
    })
    .from(projectAssignments)
    .innerJoin(projects, eq(projects.id, projectAssignments.projectId))
    .where(
      and(
        scoped(ctx, projectAssignments),
        eq(projectAssignments.userId, userId),
        isNull(projects.deletedAt),
        activeNow(now),
      ),
    )
    .orderBy(desc(projectAssignments.startsAt));
  for (const row of rows) assertSameTenant(ctx, row.assignment);
  return rows;
}

export async function listTodayFieldProjects(ctx: DataContext, userId: string) {
  return listMyAssignments(ctx, userId);
}

export async function insertAssignment(
  ctx: DataContext,
  values: typeof projectAssignments.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(projectAssignments).values(values).returning();
  if (!row) throw new Error("배정에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function revokeAssignmentRow(
  ctx: DataContext,
  id: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(projectAssignments)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(projectAssignments.id, id),
        scoped(ctx, projectAssignments),
        isNull(projectAssignments.revokedAt),
      ),
    )
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function findAssignmentById(ctx: DataContext, id: string) {
  const [row] = await db
    .select()
    .from(projectAssignments)
    .where(
      and(eq(projectAssignments.id, id), scoped(ctx, projectAssignments)),
    )
    .limit(1);
  if (!row) return null;
  assertSameTenant(ctx, row);
  return row;
}
