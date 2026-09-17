import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { notificationPreferences, notifications } from "@/modules/notification/schema";
import { assertSameTenant, scoped, type DataContext } from "@/lib/tenancy/context";

export const DEFAULT_EVENTS = [
  "design.published",
  "design.approval_requested",
  "design.approved",
  "design.rejected",
  "material.approval_requested",
  "material.approved",
  "comment.created",
  "comment.binding_created",
  "schedule.published",
  "schedule.changed",
  "photo.published",
  "project.created",
  "project.access_granted",
  "verification.code_issued",
  "template.promotion_requested",
  "company.status_changed",
  "assignment.changed",
  "request.created",
  "estimate.published",
  "meeting.published",
] as const;

/**
 * 수신 설정은 계정 단위다(company_id 가 없다). 한 계정이 업체를 여러 개 만들 수
 * 있으므로(ADR-10) 두 번째 개설에서 유니크 충돌로 트랜잭션이 통째로 깨지지 않게
 * onConflictDoNothing 을 건다.
 */
export async function insertDefaultPreferences(
  ctx: DataContext,
  userId: string,
  tx: typeof db | DbTx = db,
) {
  void ctx;
  await tx
    .insert(notificationPreferences)
    .values(
      DEFAULT_EVENTS.map((eventType) => ({
        userId,
        eventType,
        inappEnabled: true,
        emailEnabled: eventType !== "photo.published",
      })),
    )
    .onConflictDoNothing({
      target: [notificationPreferences.userId, notificationPreferences.eventType],
    });
}

export async function listPreferences(ctx: DataContext, userId: string) {
  void ctx;
  return db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
}

export async function upsertPreference(
  ctx: DataContext,
  input: { userId: string; eventType: string; inappEnabled: boolean; emailEnabled: boolean },
  tx: typeof db | DbTx = db,
) {
  void ctx;
  await tx
    .insert(notificationPreferences)
    .values(input)
    .onConflictDoUpdate({
      target: [
        notificationPreferences.userId,
        notificationPreferences.eventType,
      ],
      set: {
        inappEnabled: input.inappEnabled,
        emailEnabled: input.emailEnabled,
      },
    });
}

export async function insertOutbound(
  ctx: DataContext,
  values: typeof notifications.$inferInsert,
) {
  const [row] = await db
    .insert(notifications)
    .values(values)
    .onConflictDoNothing({
      target: [notifications.dedupeKey, notifications.channel],
    })
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function markOutbound(
  ctx: DataContext,
  id: string,
  status: string,
  failureReason?: string,
) {
  const [row] = await db
    .update(notifications)
    .set({
      status,
      failureReason: failureReason ?? null,
      ...(status === "sent" ? { sentAt: new Date() } : {}),
    })
    .where(and(eq(notifications.id, id), scoped(ctx, notifications)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row;
}

export async function listInbox(userId: string, limit = 20) {
  return db
    .select()
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.channel, "inapp")),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markRead(userId: string, id: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );
}

export async function listFailedNotifications(ctx: DataContext) {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.status, "failed"), lt(notifications.retryCount, 3)));
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function bumpRetry(ctx: DataContext, id: string) {
  const [row] = await db
    .update(notifications)
    .set({ retryCount: sql`${notifications.retryCount} + 1`, status: "queued" })
    .where(and(eq(notifications.id, id), scoped(ctx, notifications)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row;
}


