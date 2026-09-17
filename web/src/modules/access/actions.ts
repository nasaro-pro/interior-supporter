"use server";

import { requireProjectInCompany } from "@/lib/authz";
import { requireProjectAccess } from "@/lib/authz/portal";
import { requestIp } from "@/lib/authz";
import { headers } from "next/headers";
import { RateLimitError } from "@/lib/errors";
import {
  createCustomerInvite,
  issueVerificationCode,
  revokeProjectAccess,
  setAccessLabel,
  verifyProjectCode,
} from "@/modules/access/service";

export async function createCustomerInviteAction(
  companySlug: string,
  projectId: string,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  return createCustomerInvite(ctx, projectId);
}

export async function revokeAccessAction(
  companySlug: string,
  projectId: string,
  accessId: string,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await revokeProjectAccess(ctx, accessId);
}

export async function updateAccessLabelAction(
  companySlug: string,
  projectId: string,
  accessId: string,
  formData: FormData,
) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  await setAccessLabel(ctx, accessId, String(formData.get("label") ?? ""));
}

export async function issueCodeAction(companySlug: string, projectId: string) {
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const code = await issueVerificationCode(ctx, projectId);
  const { emit } = await import("@/lib/notify");
  await emit("verification.code_issued", {
    companyId: ctx.companyId,
    projectId,
    targetId: projectId,
    actorUserId: ctx.userId,
  });
  return { code };
}

export async function verifyCodeAction(projectId: string, formData: FormData) {
  const ctx = await requireProjectAccess(projectId);
  try {
    return await verifyProjectCode(
      ctx,
      projectId,
      String(formData.get("code") ?? ""),
      await requestIp(await headers()),
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { ok: false as const, remaining: 0 };
    }
    throw error;
  }
}
