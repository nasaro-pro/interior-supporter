import { z } from "zod";
import { db } from "@/lib/db/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";
import { recordAudit } from "@/modules/audit";
import { assertStaffOwnsProject } from "@/lib/authz";
import {
  assertVisibilityTransition,
  type Visibility,
} from "@/lib/visibility";
import {
  findScheduleById,
  insertSchedule,
  listDueScheduledSchedules,
  updateScheduleRow,
} from "@/modules/schedule/repo";
import { emit } from "@/lib/notify";
import { parseSeoulInput, parseSeoulInputOptional } from "@/lib/datetime";

function assertEditor(ctx: DataContext) {
  if (ctx.kind === "system") return;
  if (!isStaff(ctx) || !staffPolicy.editProjectContent(ctx.roles)) {
    throw new ForbiddenError();
  }
}

export const scheduleInput = z.object({
  projectId: z.string().uuid(),
  type: z.enum(["process", "visit", "confirmed", "meeting"]),
  title: z.string().trim().min(1).max(200),
  startAt: z.string().min(1),
  endAt: z.string().optional(),
  isAllDay: z.boolean().optional(),
  note: z.string().max(2000).optional(),
  processCategory: z
    .enum([
      "demolition",
      "electrical",
      "carpentry",
      "tile",
      "film",
      "flooring",
      "fixture_setting",
      "wallpaper",
      "furniture_install",
      "lighting_install",
      "finishing",
    ])
    .optional(),
});

export async function createSchedule(
  ctx: DataContext,
  raw: z.infer<typeof scheduleInput>,
) {
  assertEditor(ctx);
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = scheduleInput.parse(raw);
  await assertStaffOwnsProject(ctx, input.projectId);
  return db.transaction(async (tx) => {
    const row = await insertSchedule(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: input.projectId,
        type: input.type,
        title: input.title,
        startAt: parseSeoulInput(input.startAt),
        endAt: parseSeoulInputOptional(input.endAt) ?? null,
        isAllDay: Boolean(input.isAllDay),
        note: input.note || null,
        processCategory: input.processCategory,
        createdBy: ctx.userId,
        visibilityStatus: "draft",
      },
      tx,
    );
    await recordAudit(
      {
        action: "project_update",
        targetType: "schedule",
        targetId: row.id,
        projectId: input.projectId,
        after: { type: input.type, title: input.title },
      },
      ctx,
      tx,
    );
    return row;
  });
}

export async function updateSchedule(
  ctx: DataContext,
  id: string,
  raw: z.infer<typeof scheduleInput>,
) {
  assertEditor(ctx);
  const input = scheduleInput.parse(raw);
  const existing = await findScheduleById(ctx, id);
  if (!existing) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, existing.projectId);
  const updated = await db.transaction(async (tx) => {
    const next = await updateScheduleRow(
      ctx,
      id,
      {
        type: input.type,
        title: input.title,
        startAt: parseSeoulInput(input.startAt),
        endAt: parseSeoulInputOptional(input.endAt) ?? null,
        isAllDay: Boolean(input.isAllDay),
        note: input.note || null,
        processCategory: input.processCategory,
      },
      tx,
    );
    // 12.2 — 일정 변경은 고객에게 공지되는 사건이므로 기록을 남긴다.
    await recordAudit(
      {
        action: "project_update",
        targetType: "schedule",
        targetId: id,
        projectId: existing.projectId,
        before: { title: existing.title, startAt: existing.startAt.toISOString() },
        after: { title: input.title, startAt: input.startAt },
      },
      ctx,
      tx,
    );
    return next;
  });
  if (existing.visibilityStatus === "published") {
    await emit("schedule.changed", {
      companyId: existing.companyId,
      projectId: existing.projectId,
      targetId: id,
      actorUserId: "userId" in ctx ? ctx.userId : undefined,
    });
  }
  return updated;
}

export async function changeScheduleVisibility(
  ctx: DataContext,
  id: string,
  to: Visibility,
  publishAt?: Date,
) {
  assertEditor(ctx);
  const row = await findScheduleById(ctx, id);
  if (!row) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  assertVisibilityTransition(row.visibilityStatus, to);
  if (to === "scheduled" && !publishAt) throw new ForbiddenError();
  const updated = await db.transaction(async (tx) => {
    const next = await updateScheduleRow(
      ctx,
      id,
      { visibilityStatus: to, publishAt: to === "scheduled" ? publishAt : null },
      tx,
    );
    await recordAudit(
      {
        action: "visibility_change",
        targetType: "schedule",
        targetId: id,
        projectId: row.projectId,
        before: { visibilityStatus: row.visibilityStatus },
        after: { visibilityStatus: to },
      },
      ctx,
      tx,
    );
    return next;
  });
  if (to === "published") {
    await emit("schedule.published", {
      companyId: row.companyId,
      projectId: row.projectId,
      targetId: id,
      actorUserId: "userId" in ctx ? ctx.userId : undefined,
    });
  }
  return updated;
}

export async function publishDueSchedules(ctx: DataContext, now: Date) {
  if (ctx.kind !== "system") throw new ForbiddenError();
  const rows = await listDueScheduledSchedules(ctx, now);
  for (const row of rows) {
    await changeScheduleVisibility(ctx, row.id, "published");
  }
  return rows.length;
}
