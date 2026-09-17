import { z } from "zod";
import { tenantTransaction } from "@/lib/db/rls";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { recordAudit } from "@/modules/audit";
import { emit } from "@/lib/notify";
import { assertStaffOwnsProject } from "@/lib/authz";
import {
  findRequestById,
  insertCorrection,
  insertRequest,
  updateRequestRow,
} from "@/modules/request/repo";

const bodySchema = z.string().trim().min(1).max(8000);

export async function createCustomerRequest(ctx: DataContext, projectId: string, body: string) {
  if (ctx.kind !== "customer") throw new ForbiddenError();
  const originalBody = bodySchema.parse(body);
  const row = await tenantTransaction(ctx, async (tx) => {
    const created = await insertRequest(
      ctx,
      {
        companyId: ctx.companyId,
        projectId,
        authorId: ctx.userId,
        originalBody,
        processStatus: "open",
      },
      tx,
    );
    await recordAudit(
      {
        action: "request_create",
        targetType: "customer_request",
        targetId: created.id,
        projectId,
      },
      ctx,
      tx,
    );
    return created;
  });
  await emit("request.created", {
    companyId: ctx.companyId,
    projectId,
    targetId: row.id,
    actorUserId: ctx.userId,
  });
  return row;
}

export async function addRequestCorrection(
  ctx: DataContext,
  requestId: string,
  body: string,
) {
  if (ctx.kind !== "customer") throw new ForbiddenError();
  const request = await findRequestById(ctx, requestId);
  if (!request) throw new NotFoundError();
  if (request.authorId !== ctx.userId) throw new ForbiddenError();
  return insertCorrection(ctx, {
    companyId: ctx.companyId,
    projectId: request.projectId,
    requestId,
    body: bodySchema.parse(body),
    correctedBy: ctx.userId,
  });
}

export async function respondToRequest(
  ctx: DataContext,
  requestId: string,
  response: string,
  processStatus: "open" | "in_progress" | "done",
) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  const request = await findRequestById(ctx, requestId);
  if (!request) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, request.projectId);
  return updateRequestRow(ctx, requestId, {
    response: bodySchema.parse(response),
    processStatus,
  });
}
