import { z } from "zod";
import { tenantTransaction } from "@/lib/db/rls";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";
import { recordAudit } from "@/modules/audit";
import { assertStaffOwnsProject } from "@/lib/authz";
import { emit } from "@/lib/notify";
import { parseSeoulInput } from "@/lib/datetime";
import {
  assertVisibilityTransition,
  type Visibility,
} from "@/lib/visibility";
import {
  findMeetingById,
  insertMeeting,
  insertMeetingAck,
  insertParticipant,
  updateMeetingRow,
} from "@/modules/meeting/repo";
import { insertSchedule, updateScheduleRow } from "@/modules/schedule/repo";
import { findStorageObjectById } from "@/modules/storage-quota/repo";

function assertEditor(ctx: DataContext) {
  if (!isStaff(ctx) || !staffPolicy.editProjectContent(ctx.roles)) {
    throw new ForbiddenError();
  }
}

export const createMeetingInput = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  meetingAt: z.string().min(1),
  minutes: z.string().max(20_000).optional(),
  decisions: z.string().max(8000).optional(),
  participants: z.string().max(1000).optional(),
  attachmentId: z.string().uuid().optional(),
});

export async function createMeeting(
  ctx: DataContext,
  raw: z.infer<typeof createMeetingInput>,
) {
  assertEditor(ctx);
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = createMeetingInput.parse(raw);
  await assertStaffOwnsProject(ctx, input.projectId);
  if (input.attachmentId) {
    const file = await findStorageObjectById(ctx, input.attachmentId);
    if (!file) throw new NotFoundError();
  }
  const names = (input.participants ?? "")
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 20);
  return tenantTransaction(ctx, async (tx) => {
    const meetingAt = parseSeoulInput(input.meetingAt);
    const schedule = await insertSchedule(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: input.projectId,
        type: "meeting",
        title: input.title,
        startAt: meetingAt,
        createdBy: ctx.userId,
        visibilityStatus: "draft",
      },
      tx,
    );
    const meeting = await insertMeeting(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: input.projectId,
        title: input.title,
        meetingAt,
        minutes: input.minutes || null,
        decisions: input.decisions || null,
        attachmentId: input.attachmentId ?? null,
        scheduleId: schedule.id,
        authorId: ctx.userId,
        visibilityStatus: "draft",
      },
      tx,
    );
    for (const name of names) {
      await insertParticipant(
        ctx,
        {
          companyId: ctx.companyId,
          projectId: input.projectId,
          meetingId: meeting.id,
          externalName: name,
        },
        tx,
      );
    }
    return meeting;
  });
}

export async function changeMeetingVisibility(
  ctx: DataContext,
  id: string,
  to: Visibility,
  publishAt?: Date,
) {
  assertEditor(ctx);
  const row = await findMeetingById(ctx, id);
  if (!row) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  assertVisibilityTransition(row.visibilityStatus as Visibility, to);
  const updated = await tenantTransaction(ctx, async (tx) => {
    const next = await updateMeetingRow(
      ctx,
      id,
      { visibilityStatus: to, publishAt: publishAt ?? null },
      tx,
    );
    if (row.scheduleId) {
      await updateScheduleRow(
        ctx,
        row.scheduleId,
        { visibilityStatus: to, publishAt: publishAt ?? null },
        tx,
      );
    }
    await recordAudit(
      {
        action: to === "published" ? "meeting_publish" : "visibility_change",
        targetType: "meeting_record",
        targetId: id,
        projectId: row.projectId,
        after: { visibilityStatus: to },
      },
      ctx,
      tx,
    );
    return next;
  });
  if (to === "published") {
    await emit("meeting.published", {
      companyId: row.companyId,
      projectId: row.projectId,
      targetId: id,
    });
  }
  return updated;
}

export async function ackMeeting(ctx: DataContext, meetingId: string, body: string) {
  if (ctx.kind !== "customer") throw new ForbiddenError();
  const meeting = await findMeetingById(ctx, meetingId);
  if (!meeting || meeting.visibilityStatus !== "published") {
    throw new NotFoundError();
  }
  const text = z.string().trim().min(1).max(2000).parse(body);
  return insertMeetingAck(ctx, {
    companyId: ctx.companyId,
    projectId: meeting.projectId,
    meetingId,
    userId: ctx.userId,
    body: text,
  });
}
