import { z } from "zod";
import { db } from "@/lib/db/client";
import { ForbiddenError, NotFoundError, VerificationRequiredError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";
import { recordAudit } from "@/modules/audit";
import { requireFeature } from "@/modules/billing/gate";
import { assertStaffOwnsProject } from "@/lib/authz";
import {
  assertVisibilityTransition,
  type Visibility,
} from "@/lib/visibility";
import { emit } from "@/lib/notify";
import { isCadMime } from "@/lib/storage/magic";
import { findStorageObjectById } from "@/modules/storage-quota/repo";
import {
  findDesignById,
  insertDesign,
  listDueScheduledDesigns,
  nextVersionNo,
  updateDesignRow,
} from "@/modules/design/repo";

function assertEditor(ctx: DataContext) {
  if (ctx.kind === "system") return;
  if (!isStaff(ctx) || !staffPolicy.editProjectContent(ctx.roles)) {
    throw new ForbiddenError();
  }
}

export const createDesignInput = z.object({
  projectId: z.string().uuid(),
  versionName: z.string().trim().min(1).max(50),
  changeNote: z.string().max(2000).optional(),
  storageObjectId: z.string().uuid(),
  previewObjectId: z.string().uuid().optional(),
});

export async function createDesignVersion(
  ctx: DataContext,
  raw: z.infer<typeof createDesignInput>,
) {
  assertEditor(ctx);
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = createDesignInput.parse(raw);
  const file = await findStorageObjectById(ctx, input.storageObjectId);
  if (!file) throw new NotFoundError();
  let previewObjectId = input.previewObjectId ?? null;
  if (previewObjectId) {
    const preview = await findStorageObjectById(ctx, previewObjectId);
    if (!preview || !preview.mimeType.startsWith("image/")) throw new NotFoundError();
  } else if (file.mimeType.startsWith("image/")) {
    previewObjectId = file.id;
  }
  if (isCadMime(file.mimeType) && previewObjectId === file.id) {
    previewObjectId = null;
  }
  return db.transaction(async (tx) => {
    const versionNo = await nextVersionNo(ctx, input.projectId, tx);
    return insertDesign(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: input.projectId,
        versionNo,
        versionName: input.versionName,
        changeNote: input.changeNote,
        storageObjectId: input.storageObjectId,
        previewObjectId,
        authorId: ctx.userId,
        visibilityStatus: "draft",
      },
      tx,
    );
  });
}

export async function changeDesignVisibility(
  ctx: DataContext,
  id: string,
  to: Visibility,
  publishAt?: Date,
) {
  assertEditor(ctx);
  const row = await findDesignById(ctx, id);
  if (!row) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  assertVisibilityTransition(row.visibilityStatus, to);
  if (to === "scheduled" && !publishAt) throw new ForbiddenError();
  const updated = await db.transaction(async (tx) => {
    const next = await updateDesignRow(
      ctx,
      id,
      { visibilityStatus: to, publishAt: to === "scheduled" ? publishAt : null },
      tx,
    );
    await recordAudit(
      {
        action: "visibility_change",
        targetType: "design_version",
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
    const payload = {
      companyId: row.companyId,
      projectId: row.projectId,
      targetId: id,
      actorUserId: "userId" in ctx ? ctx.userId : undefined,
    };
    await emit("design.published", payload);
    if (row.approvalStatus === "pending") {
      await emit("design.approval_requested", payload);
    }
  }
  return updated;
}

export async function setDesignApproval(
  ctx: DataContext,
  id: string,
  status: "approved" | "rejected",
  note?: string,
) {
  if (ctx.kind !== "customer") throw new ForbiddenError();
  if (!ctx.verified) {
    await recordAudit({
      action: "verification_failed",
      targetType: "project",
      targetId: ctx.projectId,
      projectId: ctx.projectId,
    }, ctx);
    throw new VerificationRequiredError();
  }
  await requireFeature(ctx.companyId, "approval_workflow");
  const row = await findDesignById(ctx, id);
  if (!row || row.visibilityStatus !== "published") throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  const updated = await db.transaction(async (tx) => {
    const next = await updateDesignRow(
      ctx,
      id,
      {
        approvalStatus: status,
        approvedBy: ctx.userId,
        approvedAt: new Date(),
        approvalNote: note || null,
      },
      tx,
    );
    await recordAudit(
      {
        action: "approval",
        targetType: "design_version",
        targetId: id,
        projectId: row.projectId,
        before: { approvalStatus: row.approvalStatus },
        after: { approvalStatus: status },
      },
      ctx,
      tx,
    );
    return next;
  });
  await emit(status === "approved" ? "design.approved" : "design.rejected", {
    companyId: row.companyId,
    projectId: row.projectId,
    targetId: id,
    actorUserId: ctx.userId,
  });
  return updated;
}

export async function publishDueDesigns(ctx: DataContext, now: Date) {
  if (ctx.kind !== "system") throw new ForbiddenError();
  const rows = await listDueScheduledDesigns(ctx, now);
  for (const row of rows) {
    await changeDesignVisibility(ctx, row.id, "published");
  }
  return rows.length;
}
