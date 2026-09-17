import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";
import { recordAudit } from "@/modules/audit";
import { requireFeature } from "@/modules/billing/gate";
import { assertFieldAssigned, assertStaffOwnsProject } from "@/lib/authz";
import {
  assertVisibilityTransition,
  type Visibility,
} from "@/lib/visibility";
import {
  findPhotoById,
  insertPhoto,
  listDueScheduledPhotos,
  updatePhotoRow,
} from "@/modules/photo/repo";
import { findFieldLogById } from "@/modules/field-log/repo";
import { emit } from "@/lib/notify";

const processes = [
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
] as const;

function assertEditor(ctx: DataContext) {
  if (ctx.kind === "system") return;
  if (!isStaff(ctx) || !staffPolicy.editProjectContent(ctx.roles)) {
    throw new ForbiddenError();
  }
}

async function assertPhotoWriter(ctx: DataContext, projectId: string) {
  if (ctx.kind === "system") return;
  if (!isStaff(ctx)) throw new ForbiddenError();
  if (staffPolicy.editProjectContent(ctx.roles) || ctx.roles.includes("company_admin")) {
    await assertStaffOwnsProject(ctx, projectId);
    return;
  }
  if (staffPolicy.recordFieldWork(ctx.roles)) {
    await assertFieldAssigned(ctx, projectId);
    return;
  }
  throw new ForbiddenError();
}

export const createPhotosInput = z.object({
  projectId: z.string().uuid(),
  processCategory: z.enum(processes),
  objectIds: z.array(z.string().uuid()).min(1).max(30),
  shotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(2000).optional(),
  fieldWorkLogId: z.string().uuid().optional(),
});

export async function createPhotos(
  ctx: DataContext,
  raw: z.infer<typeof createPhotosInput>,
) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = createPhotosInput.parse(raw);
  await assertPhotoWriter(ctx, input.projectId);
  if (input.fieldWorkLogId) {
    const log = await findFieldLogById(ctx, input.fieldWorkLogId);
    if (!log || log.projectId !== input.projectId) throw new NotFoundError();
  }
  const rows = [];
  for (const storageObjectId of input.objectIds) {
    rows.push(
      await insertPhoto(ctx, {
        companyId: ctx.companyId,
        projectId: input.projectId,
        processCategory: input.processCategory,
        fieldWorkLogId: input.fieldWorkLogId,
        storageObjectId,
        shotDate: input.shotDate,
        description: input.description || null,
        uploaderId: ctx.userId,
        visibilityStatus: "draft",
      }),
    );
  }
  return rows;
}

export async function changePhotoVisibility(
  ctx: DataContext,
  id: string,
  to: Visibility,
  publishAt?: Date,
  opts?: { silent?: boolean },
) {
  assertEditor(ctx);
  const row = await findPhotoById(ctx, id);
  if (!row) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  assertVisibilityTransition(row.visibilityStatus, to);
  if (to === "scheduled" && !publishAt) throw new ForbiddenError();
  const updated = await db.transaction(async (tx) => {
    const next = await updatePhotoRow(
      ctx,
      id,
      { visibilityStatus: to, publishAt: to === "scheduled" ? publishAt : null },
      tx,
    );
    await recordAudit(
      {
        action: "visibility_change",
        targetType: "progress_photo",
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
  if (to === "published" && !opts?.silent) {
    await emit("photo.published", {
      companyId: row.companyId,
      projectId: row.projectId,
      targetId: row.projectId,
      actorUserId: "userId" in ctx ? ctx.userId : undefined,
    });
  }
  return updated;
}

export async function bulkChangePhotoVisibility(
  ctx: DataContext,
  ids: string[],
  to: Visibility,
) {
  let projectId: string | undefined;
  let companyId: string | undefined;
  for (const id of ids) {
    const row = await changePhotoVisibility(ctx, id, to, undefined, {
      silent: true,
    });
    if (row) {
      projectId = row.projectId;
      companyId = row.companyId;
    }
  }
  if (to === "published" && projectId && companyId) {
    await emit("photo.published", {
      companyId,
      projectId,
      targetId: projectId,
      actorUserId: "userId" in ctx ? ctx.userId : undefined,
    });
  }
}

export async function publishDuePhotos(ctx: DataContext, now: Date) {
  if (ctx.kind !== "system") throw new ForbiddenError();
  const rows = await listDueScheduledPhotos(ctx, now);
  const projects = new Map<string, { companyId: string; projectId: string }>();
  for (const row of rows) {
    await changePhotoVisibility(ctx, row.id, "published", undefined, {
      silent: true,
    });
    projects.set(row.projectId, {
      companyId: row.companyId,
      projectId: row.projectId,
    });
  }
  for (const item of projects.values()) {
    await emit("photo.published", {
      ...item,
      targetId: item.projectId,
    });
  }
  return rows.length;
}

export async function pairPhotos(
  ctx: DataContext,
  input: { beforeId: string; afterId: string; pairGroupId?: string },
) {
  assertEditor(ctx);
  if (isStaff(ctx)) await requireFeature(ctx.companyId, "before_after");
  const before = await findPhotoById(ctx, input.beforeId);
  const after = await findPhotoById(ctx, input.afterId);
  if (!before || !after) throw new NotFoundError();
  const pairGroupId = input.pairGroupId ?? randomUUID();
  await updatePhotoRow(ctx, before.id, { pairGroupId, pairRole: "before" });
  await updatePhotoRow(ctx, after.id, { pairGroupId, pairRole: "after" });
}
