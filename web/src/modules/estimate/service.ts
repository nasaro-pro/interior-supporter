import { z } from "zod";
import { tenantTransaction } from "@/lib/db/rls";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";
import { recordAudit } from "@/modules/audit";
import { assertStaffOwnsProject } from "@/lib/authz";
import { emit } from "@/lib/notify";
import {
  assertVisibilityTransition,
  type Visibility,
} from "@/lib/visibility";
import {
  findEstimateById,
  insertEstimate,
  nextEstimateNo,
  updateEstimateRow,
} from "@/modules/estimate/repo";

function assertEditor(ctx: DataContext) {
  if (!isStaff(ctx) || !staffPolicy.editProjectContent(ctx.roles)) {
    throw new ForbiddenError();
  }
}

export const createEstimateInput = z.object({
  projectId: z.string().uuid(),
  versionName: z.string().trim().min(1).max(50),
  changeNote: z.string().max(2000).optional(),
  pdfFileId: z.string().uuid(),
});

export async function createEstimate(
  ctx: DataContext,
  raw: z.infer<typeof createEstimateInput>,
) {
  assertEditor(ctx);
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = createEstimateInput.parse(raw);
  await assertStaffOwnsProject(ctx, input.projectId);
  return tenantTransaction(ctx, async (tx) => {
    const versionNo = await nextEstimateNo(ctx, input.projectId, tx);
    return insertEstimate(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: input.projectId,
        versionNo,
        versionName: input.versionName,
        changeNote: input.changeNote,
        pdfFileId: input.pdfFileId,
        authorId: ctx.userId,
        visibilityStatus: "draft",
      },
      tx,
    );
  });
}

export async function changeEstimateVisibility(
  ctx: DataContext,
  id: string,
  to: Visibility,
  publishAt?: Date,
) {
  assertEditor(ctx);
  const row = await findEstimateById(ctx, id);
  if (!row) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  assertVisibilityTransition(row.visibilityStatus as Visibility, to);
  const updated = await tenantTransaction(ctx, async (tx) => {
    const next = await updateEstimateRow(
      ctx,
      id,
      { visibilityStatus: to, publishAt: publishAt ?? null },
      tx,
    );
    await recordAudit(
      {
        action: to === "published" ? "estimate_publish" : "visibility_change",
        targetType: "estimate_version",
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
    await emit("estimate.published", {
      companyId: row.companyId,
      projectId: row.projectId,
      targetId: id,
    });
  }
  return updated;
}
