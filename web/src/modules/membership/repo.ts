import { and, eq, isNull, lt } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { companies } from "@/modules/company/schema";
import {
  invitations,
  memberships,
  users,
  verifications,
} from "@/modules/membership/schema";
import { sessions } from "@/modules/membership/auth-tables";
import {
  assertSameTenant,
  scoped,
  type CompanyRole,
  type DataContext,
} from "@/lib/tenancy/context";
import { TenantViolationError } from "@/lib/errors";

type Executor = typeof db | DbTx;

export async function listActiveMemberships(
  ctx: DataContext,
  userId: string,
  companyId: string,
  tx: Executor = db,
) {
  const rows = await tx
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId),
        eq(memberships.isActive, true),
        scoped(ctx, memberships),
      ),
    );
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function listStaffRolesForSlug(userId: string, slug: string) {
  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  if (!company) return { company: null, roles: [] as CompanyRole[] };
  const rows = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, company.id),
        eq(memberships.isActive, true),
      ),
    );
  return { company, roles: rows.map((r) => r.role) };
}

export async function isPlatformAdminUser(userId: string) {
  const [row] = await db
    .select({ isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.isPlatformAdmin);
}

export async function firstMembershipSlug(userId: string) {
  const [row] = await db
    .select({ slug: companies.slug })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.companyId))
    .where(and(eq(memberships.userId, userId), eq(memberships.isActive, true)))
    .limit(1);
  return row?.slug ?? null;
}

export async function insertMembership(
  ctx: DataContext,
  values: typeof memberships.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(memberships).values(values).returning();
  if (!row) throw new Error("멤버십 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function listCompanyMembers(ctx: DataContext) {
  const rows = await db
    .select({
      membership: memberships,
      user: users,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(scoped(ctx, memberships));
  for (const row of rows) assertSameTenant(ctx, row.membership);
  return rows;
}

/**
 * 업체 범위를 인자로 명시해 받는다. system 컨텍스트(알림 디스패치·배치)는
 * scoped() 가 필터를 만들지 않으므로 범위를 여기서 직접 좁혀야 한다.
 * staff/customer 가 자기 업체 밖을 요청하면 경계 위반이다.
 */
export async function listCompanyMembersFor(
  ctx: DataContext,
  companyId: string,
) {
  if (
    (ctx.kind === "staff" || ctx.kind === "customer") &&
    ctx.companyId !== companyId
  ) {
    throw new TenantViolationError({ ctxKind: ctx.kind, ctxCompanyId: ctx.companyId, rowCompanyId: companyId });
  }
  return db
    .select({ membership: memberships, user: users })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.companyId, companyId));
}

/**
 * 업체를 인자로 명시해 받는 멤버십 조회. 초대 수락처럼 아직 멤버십이 없어
 * staff 컨텍스트를 만들 수 없는 경로(system)에서 쓴다 (7.5).
 */
export async function findMembershipIn(
  ctx: DataContext,
  companyId: string,
  userId: string,
  role: CompanyRole,
  tx: Executor = db,
) {
  if (
    (ctx.kind === "staff" || ctx.kind === "customer") &&
    ctx.companyId !== companyId
  ) {
    throw new TenantViolationError({ ctxKind: ctx.kind, rowCompanyId: companyId });
  }
  const [row] = await tx
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId),
        eq(memberships.role, role),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 계정 조회(초대 이메일 대조용). users 는 업체에 속하지 않는다. */
export async function findUserById(ctx: DataContext, userId: string) {
  void ctx;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function findMembership(
  ctx: DataContext,
  userId: string,
  role: CompanyRole,
  tx: Executor = db,
) {
  const companyId = ctx.kind === "staff" ? ctx.companyId : "";
  const [row] = await tx
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId),
        eq(memberships.role, role),
        scoped(ctx, memberships),
      ),
    )
    .limit(1);
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function countActiveAdminsIn(
  ctx: DataContext,
  companyId: string,
  tx: Executor = db,
) {
  if (
    (ctx.kind === "staff" || ctx.kind === "customer") &&
    ctx.companyId !== companyId
  ) {
    throw new TenantViolationError({
      ctxKind: ctx.kind,
      ctxCompanyId: ctx.companyId,
      rowCompanyId: companyId,
    });
  }
  const rows = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.companyId, companyId),
        eq(memberships.role, "company_admin"),
        eq(memberships.isActive, true),
      ),
    );
  return rows.length;
}

export async function countActiveAdmins(ctx: DataContext, tx: Executor = db) {
  const rows = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        scoped(ctx, memberships),
        eq(memberships.role, "company_admin"),
        eq(memberships.isActive, true),
      ),
    );
  return rows.length;
}

export async function setMembershipActive(
  ctx: DataContext,
  membershipId: string,
  isActive: boolean,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(memberships)
    .set({
      isActive,
      revokedAt: isActive ? null : new Date(),
    })
    .where(and(eq(memberships.id, membershipId), scoped(ctx, memberships)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function deactivateUserMembershipsIn(
  ctx: DataContext,
  companyId: string,
  userId: string,
  tx: Executor = db,
) {
  if (
    (ctx.kind === "staff" || ctx.kind === "customer") &&
    ctx.companyId !== companyId
  ) {
    throw new TenantViolationError({
      ctxKind: ctx.kind,
      ctxCompanyId: ctx.companyId,
      rowCompanyId: companyId,
    });
  }
  const rows = await tx
    .update(memberships)
    .set({ isActive: false, revokedAt: new Date() })
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, companyId),
        eq(memberships.isActive, true),
      ),
    )
    .returning();
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function deactivateUserMemberships(
  ctx: DataContext,
  userId: string,
  tx: Executor = db,
) {
  const rows = await tx
    .update(memberships)
    .set({ isActive: false, revokedAt: new Date() })
    .where(
      and(
        eq(memberships.userId, userId),
        scoped(ctx, memberships),
        eq(memberships.isActive, true),
      ),
    )
    .returning();
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function deleteUserSessions(
  ctx: DataContext,
  userId: string,
  tx: Executor = db,
) {
  void ctx;
  await tx.delete(sessions).where(eq(sessions.userId, userId));
}

export async function insertInvitation(
  ctx: DataContext,
  values: typeof invitations.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(invitations).values(values).returning();
  if (!row) throw new Error("초대 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function findInvitationByToken(ctx: DataContext, token: string) {
  void ctx;
  const [row] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);
  return row ?? null;
}

export async function markInvitationAccepted(
  ctx: DataContext,
  invitationId: string,
  userId: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(invitations)
    .set({ acceptedBy: userId, acceptedAt: new Date() })
    .where(and(eq(invitations.id, invitationId), scoped(ctx, invitations)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function findUserEmail(ctx: DataContext, userId: string) {
  void ctx;
  const [row] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function updateUserProfile(
  userId: string,
  patch: { name: string; phone: string | null },
) {
  await db
    .update(users)
    .set({ name: patch.name, phone: patch.phone, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function listMembersByCompanyId(ctx: DataContext, companyId: string) {
  if (ctx.kind === "staff" && ctx.companyId !== companyId) {
    throw new TenantViolationError();
  }
  const rows = await db
    .select({ membership: memberships, user: users })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.companyId, companyId));
  for (const row of rows) assertSameTenant(ctx, row.membership);
  return rows;
}

export async function purgeExpiredSessions(ctx: DataContext, now: Date) {
  if (ctx.kind !== "system") return 0;
  const rows = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  return rows.length;
}

export async function purgeExpiredVerifications(ctx: DataContext, now: Date) {
  if (ctx.kind !== "system") return 0;
  const rows = await db
    .delete(verifications)
    .where(lt(verifications.expiresAt, now))
    .returning({ id: verifications.id });
  return rows.length;
}

export async function purgeExpiredInvitations(ctx: DataContext, now: Date) {
  if (ctx.kind !== "system") return 0;
  const rows = await db
    .delete(invitations)
    .where(and(lt(invitations.expiresAt, now), isNull(invitations.acceptedAt)))
    .returning({ id: invitations.id });
  return rows.length;
}
export async function countActivePmsIn(ctx: DataContext, companyId: string) {
  if (
    (ctx.kind === "staff" || ctx.kind === "customer") &&
    ctx.companyId !== companyId
  ) {
    throw new TenantViolationError({
      ctxKind: ctx.kind,
      ctxCompanyId: ctx.companyId,
      rowCompanyId: companyId,
    });
  }
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.companyId, companyId),
        eq(memberships.role, "project_manager"),
        eq(memberships.isActive, true),
      ),
    );
  return rows.length;
}

/** plan gate 의 pm_seats 판정용 (13.1) */
export async function countActivePms(ctx: DataContext) {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        scoped(ctx, memberships),
        eq(memberships.role, "project_manager"),
        eq(memberships.isActive, true),
      ),
    );
  return rows.length;
}
