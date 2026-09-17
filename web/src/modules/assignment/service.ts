import { z } from "zod";
import { tenantTransaction } from "@/lib/db/rls";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { recordAudit } from "@/modules/audit";
import { emit } from "@/lib/notify";
import { parseSeoulInput, parseSeoulInputOptional } from "@/lib/datetime";
import { findProjectById } from "@/modules/project/repo";
import { assertStaffOwnsProject } from "@/lib/authz";
import {
  findAssignmentById,
  insertAssignment,
  revokeAssignmentRow,
} from "@/modules/assignment/repo";

export const assignmentInput = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  assignmentRole: z.enum(["designer", "field_worker"]),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
});

export async function grantAssignment(
  ctx: DataContext,
  raw: z.infer<typeof assignmentInput>,
) {
  if (!isStaff(ctx) || !ctx.roles.includes("company_admin")) {
    if (!isStaff(ctx) || !ctx.roles.includes("project_manager")) {
      throw new ForbiddenError();
    }
  }
  const input = assignmentInput.parse(raw);
  await assertStaffOwnsProject(ctx, input.projectId);
  const project = await findProjectById(ctx, input.projectId);
  if (!project) throw new NotFoundError();
  const row = await tenantTransaction(ctx, async (tx) => {
    const created = await insertAssignment(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: input.projectId,
        userId: input.userId,
        assignmentRole: input.assignmentRole,
        startsAt: parseSeoulInput(input.startsAt),
        endsAt: parseSeoulInputOptional(input.endsAt) ?? null,
        grantedBy: ctx.userId,
      },
      tx,
    );
    await recordAudit(
      {
        action: "assignment_grant",
        targetType: "project_assignment",
        targetId: created.id,
        projectId: input.projectId,
        after: { role: input.assignmentRole, userId: input.userId },
      },
      ctx,
      tx,
    );
    return created;
  });
  await emit("assignment.changed", {
    companyId: ctx.companyId,
    projectId: input.projectId,
    targetId: row.id,
    userIds: [input.userId],
  });
  return row;
}

export async function revokeAssignment(ctx: DataContext, id: string) {
  if (!isStaff(ctx) || !ctx.roles.includes("company_admin")) {
    if (!isStaff(ctx) || !ctx.roles.includes("project_manager")) {
      throw new ForbiddenError();
    }
  }
  const existing = await findAssignmentById(ctx, id);
  if (!existing) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, existing.projectId);
  const row = await tenantTransaction(ctx, async (tx) => {
    const updated = await revokeAssignmentRow(ctx, id, tx);
    await recordAudit(
      {
        action: "assignment_revoke",
        targetType: "project_assignment",
        targetId: id,
        projectId: existing.projectId,
      },
      ctx,
      tx,
    );
    return updated;
  });
  await emit("assignment.changed", {
    companyId: ctx.companyId,
    projectId: existing.projectId,
    targetId: id,
    userIds: [existing.userId],
  });
  return row;
}
