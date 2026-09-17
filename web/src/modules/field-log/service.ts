import { z } from "zod";
import { tenantTransaction } from "@/lib/db/rls";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";
import { recordAudit } from "@/modules/audit";
import { assertFieldAssigned } from "@/lib/authz";
import {
  findFieldLogById,
  insertFieldLog,
  updateFieldLogRow,
} from "@/modules/field-log/repo";
import { findActiveAssignment } from "@/modules/assignment/repo";
import { seoulDayValue } from "@/lib/datetime";

const processEnum = z.enum([
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
]);

export const fieldLogInput = z.object({
  projectId: z.string().uuid(),
  processCategory: processEnum,
  body: z.string().trim().min(1).max(8000),
  issue: z.string().max(2000).optional(),
  status: z.enum(["started", "in_progress", "done"]).default("started"),
  workDate: z.string().optional(),
});

export async function createFieldLog(
  ctx: DataContext,
  raw: z.infer<typeof fieldLogInput>,
) {
  if (!isStaff(ctx) || !staffPolicy.recordFieldWork(ctx.roles)) {
    throw new ForbiddenError();
  }
  const input = fieldLogInput.parse(raw);
  await assertFieldAssigned(ctx, input.projectId);
  const assignment = await findActiveAssignment(
    ctx,
    input.projectId,
    ctx.userId,
    ctx.roles.includes("field_worker") ? "field_worker" : undefined,
  );
  return tenantTransaction(ctx, async (tx) => {
    const row = await insertFieldLog(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: input.projectId,
        assignmentId: assignment?.id ?? null,
        workDate: input.workDate || seoulDayValue(),
        processCategory: input.processCategory,
        body: input.body,
        issue: input.issue || null,
        issueStatus: input.issue ? "open" : null,
        status: input.status,
        authorId: ctx.userId,
      },
      tx,
    );
    if (input.status === "done") {
      await recordAudit(
        {
          action: "field_log_complete",
          targetType: "field_work_log",
          targetId: row.id,
          projectId: input.projectId,
        },
        ctx,
        tx,
      );
    }
    return row;
  });
}

type History = { at: string; by: string; before: unknown; after: unknown };

export async function updateFieldLog(
  ctx: DataContext,
  id: string,
  raw: z.infer<typeof fieldLogInput>,
) {
  if (!isStaff(ctx) || !staffPolicy.recordFieldWork(ctx.roles)) {
    throw new ForbiddenError();
  }
  const input = fieldLogInput.parse(raw);
  const existing = await findFieldLogById(ctx, id);
  if (!existing) throw new NotFoundError();
  await assertFieldAssigned(ctx, existing.projectId);
  const history = Array.isArray(existing.revisionHistory)
    ? (existing.revisionHistory as History[])
    : [];
  const after = {
    body: input.body,
    issue: input.issue || null,
    status: input.status,
    processCategory: input.processCategory,
  };
  return tenantTransaction(ctx, async (tx) => {
    const updated = await updateFieldLogRow(
      ctx,
      id,
      {
        ...after,
        revisionHistory: [
          ...history,
          {
            at: new Date().toISOString(),
            by: ctx.userId,
            before: {
              body: existing.body,
              issue: existing.issue,
              status: existing.status,
              processCategory: existing.processCategory,
            },
            after,
          },
        ],
      },
      tx,
    );
    if (input.status === "done" && existing.status !== "done") {
      await recordAudit(
        {
          action: "field_log_complete",
          targetType: "field_work_log",
          targetId: id,
          projectId: existing.projectId,
        },
        ctx,
        tx,
      );
    }
    return updated;
  });
}
