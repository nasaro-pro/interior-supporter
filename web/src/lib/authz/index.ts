import { cookies, headers } from "next/headers";
import { forbidden, notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { hasValidPlatformMfa } from "@/lib/auth/platform-mfa";
import { createPlatformContext } from "@/lib/tenancy/platform";
import { systemJob } from "@/lib/tenancy/system";
import { hasRole, isFieldOnly, isOfficeStaff, type DataContext } from "@/lib/tenancy/context";
import { ForbiddenError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/ratelimit";
import {
  findInvitationByToken,
  firstMembershipSlug,
  isPlatformAdminUser,
  listStaffRolesForSlug,
} from "@/modules/membership/repo";
import { firstProjectAccess } from "@/modules/access/repo";
import { findProjectById, findProjectStaff } from "@/modules/project/repo";
import { findActiveAssignment } from "@/modules/assignment/repo";
import { acceptInvitationForUser } from "@/modules/membership/service";

export async function requestIp(h: Headers) {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "0.0.0.0"
  );
}

export async function requirePlatformIdentity() {
  const session = await requireSession();
  if (!session.isPlatformAdmin) forbidden();
  return session;
}

export async function requirePlatformAdmin(reason: string): Promise<DataContext> {
  const session = await requirePlatformIdentity();
  if (!(await hasValidPlatformMfa(session.userId))) {
    redirect("/platform/mfa");
  }
  return createPlatformContext(session.userId, reason);
}

export async function requirePublicContact(): Promise<void> {
  await enforceRateLimit("contact_ip", await requestIp(await headers()));
}

export async function requirePublicHealth(): Promise<void> {
  return;
}

export async function staffContextFor(
  userId: string,
  companySlug: string,
): Promise<Extract<DataContext, { kind: "staff" }>> {
  const { company, roles } = await listStaffRolesForSlug(userId, companySlug);
  if (!company) notFound();
  if (company.status === "suspended") throw new ForbiddenError();
  if (roles.length === 0) throw new ForbiddenError();
  return { kind: "staff", companyId: company.id, userId, roles };
}

export async function requireCompanyStaff(
  companySlug: string,
): Promise<Extract<DataContext, { kind: "staff" }>> {
  const session = await requireSession();
  try {
    return await staffContextFor(session.userId, companySlug);
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}

export async function requireCompanyAdmin(
  companySlug: string,
): Promise<Extract<DataContext, { kind: "staff" }>> {
  const ctx = await requireCompanyStaff(companySlug);
  if (!hasRole(ctx, "company_admin")) forbidden();
  return ctx;
}

export async function loadProjectStaff(
  userId: string,
  projectId: string,
): Promise<Extract<DataContext, { kind: "staff" }>> {
  const row = await findProjectStaff(userId, projectId);
  if (!row || row.roles.length === 0) throw new ForbiddenError();
  if (!isOfficeStaff(row.roles)) throw new ForbiddenError();
  if (row.roles.includes("company_admin")) {
    return {
      kind: "staff",
      companyId: row.companyId,
      userId,
      roles: row.roles,
    };
  }
  if (row.managerId === userId) {
    return {
      kind: "staff",
      companyId: row.companyId,
      userId,
      roles: row.roles,
    };
  }
  const assigned = await findActiveAssignment(
    { kind: "staff", companyId: row.companyId, userId, roles: row.roles },
    projectId,
    userId,
    "designer",
  );
  if (!assigned) throw new ForbiddenError();
  return {
    kind: "staff",
    companyId: row.companyId,
    userId,
    roles: row.roles,
  };
}

export async function requireProjectStaff(
  projectId: string,
): Promise<Extract<DataContext, { kind: "staff" }>> {
  const session = await requireSession();
  try {
    return await loadProjectStaff(session.userId, projectId);
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}

/**
 * 방어선 2-B (staff 쪽, I12).
 * 리소스 id 만 받는 서비스 함수는 행을 읽은 직후 이 함수를 호출한다.
 * company_admin 은 업체 전체를 다루므로 통과, project_manager 단독 권한자는
 * 본인이 담당(manager_id)인 프로젝트만 통과한다.
 */
export async function assertStaffOwnsProject(
  ctx: DataContext,
  projectId: string | null | undefined,
): Promise<void> {
  if (ctx.kind !== "staff") return;
  if (ctx.roles.includes("company_admin")) return;
  if (isFieldOnly(ctx.roles)) throw new ForbiddenError();
  if (!projectId) throw new ForbiddenError();
  const row = await findProjectStaff(ctx.userId, projectId);
  if (!row || row.companyId !== ctx.companyId) throw new ForbiddenError();
  if (row.managerId === ctx.userId) return;
  const assigned = await findActiveAssignment(ctx, projectId, ctx.userId, "designer");
  if (!assigned) throw new ForbiddenError();
}

export async function assertFieldAssigned(
  ctx: DataContext,
  projectId: string,
): Promise<void> {
  if (ctx.kind !== "staff") throw new ForbiddenError();
  if (ctx.roles.includes("company_admin") || ctx.roles.includes("project_manager")) {
    await assertStaffOwnsProject(ctx, projectId);
    return;
  }
  if (!ctx.roles.includes("field_worker")) throw new ForbiddenError();
  const assigned = await findActiveAssignment(
    ctx,
    projectId,
    ctx.userId,
    "field_worker",
  );
  if (!assigned) throw new ForbiddenError();
}

export async function requireFieldAssignment(
  companySlug: string,
  projectId: string,
): Promise<Extract<DataContext, { kind: "staff" }>> {
  const staff = await requireCompanyStaff(companySlug);
  try {
    await assertFieldAssigned(staff, projectId);
    const project = await findProjectById(staff, projectId);
    if (!project) forbidden();
    return staff;
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}

export async function loadFieldUploadStaff(
  userId: string,
  projectId: string,
): Promise<Extract<DataContext, { kind: "staff" }>> {
  try {
    return await loadProjectStaff(userId, projectId);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
  }
  const row = await findProjectStaff(userId, projectId);
  if (!row || !row.roles.includes("field_worker")) throw new ForbiddenError();
  const ctx: Extract<DataContext, { kind: "staff" }> = {
    kind: "staff",
    companyId: row.companyId,
    userId,
    roles: row.roles,
  };
  await assertFieldAssigned(ctx, projectId);
  return ctx;
}

/** 감사 로그에 실을 요청 메타 (12.1) */
export async function requestMeta(): Promise<{
  ip: string;
  userAgent: string | undefined;
}> {
  const h = await headers();
  return {
    ip: await requestIp(h),
    userAgent: h.get("user-agent") ?? undefined,
  };
}

export async function requireProjectInCompany(
  companySlug: string,
  projectId: string,
): Promise<Extract<DataContext, { kind: "staff" }>> {
  const staff = await requireCompanyStaff(companySlug);
  const project = await findProjectById(staff, projectId);
  if (!project) forbidden();
  try {
    return await loadProjectStaff(staff.userId, projectId);
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}

export async function postLoginPath(userId: string): Promise<string> {
  const token = (await cookies()).get("invite_token")?.value;
  if (token) return `/invite/${token}`;
  if (await isPlatformAdminUser(userId)) return "/platform";
  const slug = await firstMembershipSlug(userId);
  if (slug) return `/app/${slug}`;
  if (await firstProjectAccess(systemJob("post-login"), userId)) return "/portal";
  return "/onboarding/company";
}

/**
 * 초대 토큰을 해석한다. 만료·수락 여부 판정을 여기서 끝내 화면이 렌더 중
 * Date.now() 를 호출하지 않게 한다(react-hooks/purity).
 */
export async function lookupInvitation(token: string) {
  await enforceRateLimit("invite_ip", await requestIp(await headers()));
  const invite = await findInvitationByToken(systemJob("invite-token"), token);
  if (!invite) return null;
  const expired =
    invite.acceptedAt !== null || invite.expiresAt.getTime() < Date.now();
  return { ...invite, expired };
}

export async function acceptInvitation(userId: string, token: string) {
  const result = await acceptInvitationForUser(userId, token);
  if (result.ok) (await cookies()).delete("invite_token");
  return result;
}
