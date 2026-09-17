import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import {
  meetingAcks,
  meetingParticipants,
  meetingRecords,
} from "@/modules/meeting/schema";
import {
  assertSameProject,
  assertSameTenant,
  projectScoped,
  scoped,
  type DataContext,
} from "@/lib/tenancy/context";

type Executor = typeof db | DbTx;

export async function listMeetings(
  ctx: DataContext,
  projectId: string,
  opts?: { publishedOnly?: boolean },
) {
  const rows = await db
    .select()
    .from(meetingRecords)
    .where(
      and(
        scoped(ctx, meetingRecords),
        projectScoped(ctx, meetingRecords),
        eq(meetingRecords.projectId, projectId),
        isNull(meetingRecords.deletedAt),
        opts?.publishedOnly
          ? eq(meetingRecords.visibilityStatus, "published")
          : undefined,
      ),
    )
    .orderBy(desc(meetingRecords.meetingAt));
  for (const row of rows) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return rows;
}

export async function findMeetingById(ctx: DataContext, id: string) {
  const [row] = await db
    .select()
    .from(meetingRecords)
    .where(
      and(
        eq(meetingRecords.id, id),
        scoped(ctx, meetingRecords),
        projectScoped(ctx, meetingRecords),
        isNull(meetingRecords.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  assertSameTenant(ctx, row);
  assertSameProject(ctx, row);
  return row;
}

export async function insertMeeting(
  ctx: DataContext,
  values: typeof meetingRecords.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(meetingRecords).values(values).returning();
  if (!row) throw new Error("미팅 기록 저장에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function updateMeetingRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof meetingRecords.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(meetingRecords)
    .set(patch)
    .where(and(eq(meetingRecords.id, id), scoped(ctx, meetingRecords)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function insertMeetingAck(
  ctx: DataContext,
  values: typeof meetingAcks.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(meetingAcks).values(values).returning();
  if (!row) throw new Error("확인 의견 저장에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function listMeetingAcks(ctx: DataContext, meetingId: string) {
  const rows = await db
    .select()
    .from(meetingAcks)
    .where(
      and(scoped(ctx, meetingAcks), eq(meetingAcks.meetingId, meetingId)),
    )
    .orderBy(desc(meetingAcks.createdAt));
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function listMeetingAcksForProject(ctx: DataContext, projectId: string) {
  const rows = await db
    .select()
    .from(meetingAcks)
    .where(
      and(
        scoped(ctx, meetingAcks),
        projectScoped(ctx, meetingAcks),
        eq(meetingAcks.projectId, projectId),
      ),
    )
    .orderBy(desc(meetingAcks.createdAt));
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function insertParticipant(
  ctx: DataContext,
  values: typeof meetingParticipants.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(meetingParticipants).values(values).returning();
  if (row) assertSameTenant(ctx, row);
  return row;
}

export async function listParticipantsForProject(
  ctx: DataContext,
  projectId: string,
) {
  const rows = await db
    .select()
    .from(meetingParticipants)
    .where(
      and(
        scoped(ctx, meetingParticipants),
        projectScoped(ctx, meetingParticipants),
        eq(meetingParticipants.projectId, projectId),
      ),
    );
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}
