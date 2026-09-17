import { and, asc, desc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { schedules } from "@/modules/schedule/schema";
import { assertSameProject, assertSameTenant, projectScoped, scoped, type DataContext } from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listSchedules(
  ctx: DataContext,
  projectId: string,
  range?: { from: Date; to: Date },
  opts?: { publishedOnly?: boolean },
) {
  const rows = await db
    .select()
    .from(schedules)
    .where(
      and(
        scoped(ctx, schedules),
        projectScoped(ctx, schedules),
        eq(schedules.projectId, projectId),
        isNull(schedules.deletedAt),
        range ? gte(schedules.startAt, range.from) : undefined,
        range ? lt(schedules.startAt, range.to) : undefined,
        opts?.publishedOnly ? eq(schedules.visibilityStatus, "published") : undefined,
      ),
    )
    .orderBy(asc(schedules.startAt));
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function findNextSchedule(
  ctx: DataContext,
  projectId: string,
  opts?: { publishedOnly?: boolean },
) {
  const [row] = await db
    .select()
    .from(schedules)
    .where(
      and(
        scoped(ctx, schedules),
        projectScoped(ctx, schedules),
        eq(schedules.projectId, projectId),
        isNull(schedules.deletedAt),
        gte(schedules.startAt, new Date()),
        opts?.publishedOnly ? eq(schedules.visibilityStatus, "published") : undefined,
      ),
    )
    .orderBy(asc(schedules.startAt))
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function findScheduleById(
  ctx: DataContext,
  id: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select()
    .from(schedules)
    .where(
      and(eq(schedules.id, id), scoped(ctx, schedules), projectScoped(ctx, schedules), isNull(schedules.deletedAt)),
    )
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function insertSchedule(
  ctx: DataContext,
  values: typeof schedules.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(schedules).values(values).returning();
  if (!row) throw new Error("일정 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function updateScheduleRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof schedules.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(schedules)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(schedules.id, id), scoped(ctx, schedules), projectScoped(ctx, schedules)))
    .returning();
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

export async function listRecentSchedules(
  ctx: DataContext,
  projectId: string,
  opts?: { publishedOnly?: boolean },
) {
  const rows = await db
    .select()
    .from(schedules)
    .where(
      and(
        scoped(ctx, schedules),
        projectScoped(ctx, schedules),
        eq(schedules.projectId, projectId),
        isNull(schedules.deletedAt),
        opts?.publishedOnly ? eq(schedules.visibilityStatus, "published") : undefined,
      ),
    )
    .orderBy(desc(schedules.updatedAt))
    .limit(5);
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function listDueScheduledSchedules(ctx: DataContext, now: Date) {
  const rows = await db
    .select()
    .from(schedules)
    .where(
      and(
        scoped(ctx, schedules),
        projectScoped(ctx, schedules),
        eq(schedules.visibilityStatus, "scheduled"),
        lte(schedules.publishAt, now),
        isNull(schedules.deletedAt),
      ),
    );
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}
