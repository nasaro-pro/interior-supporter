import { z } from "zod";
import { db } from "@/lib/db/client";
import { ForbiddenError, NotFoundError, VerificationRequiredError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { recordAudit } from "@/modules/audit";
import { messages } from "@/lib/messages";
import { assertStaffOwnsProject } from "@/lib/authz";
import { emit } from "@/lib/notify";
import {
  findCommentById,
  insertComment,
  updateCommentRow,
} from "@/modules/comment/repo";

type EditEntry = { body: string; editedAt: string };

export const commentBody = z.string().trim().min(1).max(8000);

export const commentInput = z.object({
  projectId: z.string().uuid(),
  body: commentBody,
  parentId: z.string().uuid().optional(),
  binding: z.boolean().optional(),
});

export async function createComment(
  ctx: DataContext,
  raw: z.infer<typeof commentInput>,
) {
  const input = commentInput.parse(raw);
  const binding = Boolean(input.binding);
  if (binding) {
    if (ctx.kind !== "customer") throw new ForbiddenError();
    if (!ctx.verified) throw new VerificationRequiredError();
  } else if (ctx.kind !== "staff" && ctx.kind !== "customer") {
    throw new ForbiddenError();
  }
  const kind = binding ? "binding" : "normal";
  const row = await db.transaction(async (tx) => {
    const created = await insertComment(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: input.projectId,
        parentId: input.parentId,
        authorId: ctx.userId,
        kind,
        body: input.body,
      },
      tx,
    );
    if (kind === "binding") {
      await recordAudit(
        {
          action: "binding_comment",
          targetType: "comment",
          targetId: created.id,
          projectId: input.projectId,
          after: { body: input.body },
        },
        ctx,
        tx,
      );
    }
    return created;
  });
  await emit(kind === "binding" ? "comment.binding_created" : "comment.created", {
    companyId: ctx.companyId,
    projectId: input.projectId,
    targetId: row.id,
    actorUserId: ctx.userId,
  });
  return row;
}

/**
 * 2차 설계 — 고객 요청 원문은 수정하지 않는다. 일반 댓글의 고객 수정도 막는다.
 * 확정 지시(kind='binding')는 작성자 본인도 수정할 수 없다.
 */
export async function editComment(
  ctx: DataContext,
  id: string,
  body: string,
) {
  if (ctx.kind !== "staff") throw new ForbiddenError(messages.originalImmutable);
  const parsed = commentBody.parse(body);
  const row = await findCommentById(ctx, id);
  if (!row || row.deletedAt) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  if (row.kind === "binding") throw new ForbiddenError(messages.bindingLocked);
  if (row.authorId !== ctx.userId) throw new ForbiddenError();
  const history = Array.isArray(row.editHistory)
    ? (row.editHistory as EditEntry[])
    : [];
  return db.transaction(async (tx) => {
    const updated = await updateCommentRow(
      ctx,
      id,
      {
        body: parsed,
        editHistory: [...history, { body: row.body, editedAt: new Date().toISOString() }],
        editedAt: new Date(),
      },
      tx,
    );
    await recordAudit(
      {
        action: "comment_edit",
        targetType: "comment",
        targetId: id,
        projectId: row.projectId,
      },
      ctx,
      tx,
    );
    return updated;
  });
}

export async function deleteComment(ctx: DataContext, id: string) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  const canDelete =
    ctx.roles.includes("company_admin") || ctx.roles.includes("project_manager");
  if (!canDelete) throw new ForbiddenError();
  const row = await findCommentById(ctx, id);
  if (!row || row.deletedAt) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  if (row.kind === "binding") throw new ForbiddenError(messages.bindingLocked);
  return db.transaction(async (tx) => {
    const updated = await updateCommentRow(
      ctx,
      id,
      { deletedAt: new Date(), deletedBy: ctx.userId },
      tx,
    );
    await recordAudit(
      {
        action: "comment_delete",
        targetType: "comment",
        targetId: id,
        projectId: row.projectId,
      },
      ctx,
      tx,
    );
    return updated;
  });
}
