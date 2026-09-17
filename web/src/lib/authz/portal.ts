import { forbidden } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { systemJob } from "@/lib/tenancy/system";
import { ForbiddenError, VerificationRequiredError } from "@/lib/errors";
import { recordAudit } from "@/modules/audit";
import { findActiveAccess, isVerified } from "@/modules/access/repo";
import { findCompanyById } from "@/modules/company/repo";
import type { DataContext } from "@/lib/tenancy/context";

export async function requireCustomerSession() {
  return requireSession();
}

export async function loadProjectAccess(
  userId: string,
  projectId: string,
): Promise<Extract<DataContext, { kind: "customer" }>> {
  const access = await findActiveAccess(
    systemJob("portal-access"),
    projectId,
    userId,
  );
  if (!access) {
    throw new ForbiddenError("이 프로젝트에 접근 권한이 없습니다");
  }
  const company = await findCompanyById(systemJob("portal-access"), access.companyId);
  if (!company || company.status === "suspended") {
    throw new ForbiddenError("이 프로젝트에 접근 권한이 없습니다");
  }
  const verified = await isVerified(
    systemJob("portal-access"),
    projectId,
    userId,
  );
  return {
    kind: "customer",
    companyId: access.companyId,
    projectId,
    userId,
    verified,
  };
}

export async function requireProjectAccess(
  projectId: string,
): Promise<Extract<DataContext, { kind: "customer" }>> {
  const session = await requireSession();
  try {
    return await loadProjectAccess(session.userId, projectId);
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}

export async function requireProjectVerified(
  projectId: string,
): Promise<Extract<DataContext, { kind: "customer" }>> {
  const ctx = await requireProjectAccess(projectId);
  if (!ctx.verified) {
    await recordAudit({
      action: "verification_failed",
      targetType: "project",
      targetId: projectId,
      projectId,
    }, ctx);
    throw new VerificationRequiredError();
  }
  return ctx;
}
