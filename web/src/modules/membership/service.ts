import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { systemJob } from "@/lib/tenancy/system";
import { recordAudit } from "@/modules/audit";
import { requireLimit } from "@/modules/billing/gate";
import { getPlatformSetting } from "@/modules/company/repo";
import { sendMail } from "@/lib/notify/channels/email";
import { env } from "@/lib/config/env";
import { messages } from "@/lib/messages";
import { ForbiddenError } from "@/lib/errors";
import {
  countActiveAdmins,
  countActiveAdminsIn,
  countActivePms,
  countActivePmsIn,
  deactivateUserMemberships,
  deactivateUserMembershipsIn,
  deleteUserSessions,
  findInvitationByToken,
  findMembership,
  findMembershipIn,
  findUserById,
  insertInvitation,
  insertMembership,
  markInvitationAccepted,
  setMembershipActive,
} from "@/modules/membership/repo";
import { insertProjectAccess, findAccessByProjectUser, restoreAccess } from "@/modules/access/repo";
import { emit } from "@/lib/notify";
import type { DataContext } from "@/lib/tenancy/context";

export const inviteMemberInput = z.object({
  email: z.email(),
  role: z.enum(["company_admin", "project_manager", "field_worker"]),
});

function expireDays(value: unknown) {
  if (typeof value !== "number" || value <= 0) {
    throw new Error("invite_expire_days 설정이 없습니다.");
  }
  return value;
}

export async function inviteMember(
  ctx: DataContext,
  raw: z.infer<typeof inviteMemberInput>,
) {
  if (ctx.kind !== "staff" || !ctx.roles.includes("company_admin")) {
    throw new ForbiddenError();
  }
  const input = inviteMemberInput.parse(raw);
  const days = expireDays(await getPlatformSetting("invite_expire_days"));
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const invite = await db.transaction(async (tx) => {
    const row = await insertInvitation(
      ctx,
      {
        kind: "company_member",
        companyId: ctx.companyId,
        role: input.role,
        email: input.email,
        token,
        invitedBy: ctx.userId,
        expiresAt,
      },
      tx,
    );
    await recordAudit(
      {
        action: "member_invite",
        targetType: "invitation",
        targetId: row.id,
        after: { role: input.role },
      },
      ctx,
      tx,
    );
    return row;
  });
  await sendMail({
    to: input.email,
    template: "member-invite",
    data: { url: `${env.NEXT_PUBLIC_APP_URL}/invite/${token}` },
  });
  return invite;
}

export async function inviteMemberByPlatform(
  ctx: DataContext,
  companyId: string,
  raw: z.infer<typeof inviteMemberInput>,
) {
  if (ctx.kind !== "platform") throw new ForbiddenError();
  const input = inviteMemberInput.parse(raw);
  const days = expireDays(await getPlatformSetting("invite_expire_days"));
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const invite = await db.transaction(async (tx) => {
    const row = await insertInvitation(
      ctx,
      {
        kind: "company_member",
        companyId,
        role: input.role,
        email: input.email,
        token,
        invitedBy: ctx.userId,
        expiresAt,
      },
      tx,
    );
    await recordAudit(
      {
        action: "member_invite",
        targetType: "invitation",
        targetId: row.id,
        companyId,
        after: { role: input.role },
      },
      ctx,
      tx,
    );
    return row;
  });
  await sendMail({
    to: input.email,
    template: "member-invite",
    data: { url: `${env.NEXT_PUBLIC_APP_URL}/invite/${token}` },
  });
  return invite;
}

export async function toggleProjectManager(
  ctx: DataContext,
  userId: string,
  enable: boolean,
) {
  if (ctx.kind !== "staff" || !ctx.roles.includes("company_admin")) {
    throw new ForbiddenError();
  }
  if (enable) {
    await requireLimit(ctx.companyId, "pm_seats", await countActivePms(ctx));
  }
  return db.transaction(async (tx) => {
    const existing = await findMembership(ctx, userId, "project_manager", tx);
    if (enable) {
      if (existing?.isActive) return existing;
      if (existing) {
        const row = await setMembershipActive(ctx, existing.id, true, tx);
        await recordAudit(
          {
            action: "member_role_change",
            targetType: "membership",
            targetId: existing.id,
            after: { role: "project_manager", isActive: true },
          },
          ctx,
          tx,
        );
        return row;
      }
      const row = await insertMembership(
        ctx,
        {
          userId,
          companyId: ctx.companyId,
          role: "project_manager",
          grantedBy: ctx.userId,
        },
        tx,
      );
      await recordAudit(
        {
          action: "member_role_change",
          targetType: "membership",
          targetId: row.id,
          after: { role: "project_manager", isActive: true },
        },
        ctx,
        tx,
      );
      return row;
    }
    if (!existing?.isActive) return existing;
    const row = await setMembershipActive(ctx, existing.id, false, tx);
    await recordAudit(
      {
        action: "member_role_change",
        targetType: "membership",
        targetId: existing.id,
        before: { role: "project_manager", isActive: true },
        after: { role: "project_manager", isActive: false },
      },
      ctx,
      tx,
    );
    return row;
  });
}

export async function deactivateMember(ctx: DataContext, userId: string) {
  if (ctx.kind !== "staff" || !ctx.roles.includes("company_admin")) {
    throw new ForbiddenError();
  }
  return db.transaction(async (tx) => {
    const admin = await findMembership(ctx, userId, "company_admin", tx);
    if (admin?.isActive && (await countActiveAdmins(ctx, tx)) <= 1) {
      throw new ForbiddenError(messages.lastAdminDenied);
    }
    const rows = await deactivateUserMemberships(ctx, userId, tx);
    await deleteUserSessions(ctx, userId, tx);
    await recordAudit(
      {
        action: "member_deactivate",
        targetType: "user",
        targetId: userId,
        after: { memberships: rows.length },
      },
      ctx,
      tx,
    );
    return rows;
  });
}

export async function toggleProjectManagerByPlatform(
  ctx: DataContext,
  companyId: string,
  userId: string,
  enable: boolean,
) {
  if (ctx.kind !== "platform") throw new ForbiddenError();
  if (enable) {
    await requireLimit(companyId, "pm_seats", await countActivePmsIn(ctx, companyId));
  }
  return db.transaction(async (tx) => {
    const existing = await findMembershipIn(ctx, companyId, userId, "project_manager", tx);
    if (enable) {
      if (existing?.isActive) return existing;
      if (existing) {
        const row = await setMembershipActive(ctx, existing.id, true, tx);
        await recordAudit(
          {
            action: "member_role_change",
            targetType: "membership",
            targetId: existing.id,
            companyId,
            after: { role: "project_manager", isActive: true },
          },
          ctx,
          tx,
        );
        return row;
      }
      const row = await insertMembership(
        ctx,
        {
          userId,
          companyId,
          role: "project_manager",
          grantedBy: ctx.userId,
        },
        tx,
      );
      await recordAudit(
        {
          action: "member_role_change",
          targetType: "membership",
          targetId: row.id,
          companyId,
          after: { role: "project_manager", isActive: true },
        },
        ctx,
        tx,
      );
      return row;
    }
    if (!existing?.isActive) return existing;
    const row = await setMembershipActive(ctx, existing.id, false, tx);
    await recordAudit(
      {
        action: "member_role_change",
        targetType: "membership",
        targetId: existing.id,
        companyId,
        before: { role: "project_manager", isActive: true },
        after: { role: "project_manager", isActive: false },
      },
      ctx,
      tx,
    );
    return row;
  });
}

export async function deactivateMemberByPlatform(
  ctx: DataContext,
  companyId: string,
  userId: string,
) {
  if (ctx.kind !== "platform") throw new ForbiddenError();
  return db.transaction(async (tx) => {
    const admin = await findMembershipIn(ctx, companyId, userId, "company_admin", tx);
    if (admin?.isActive && (await countActiveAdminsIn(ctx, companyId, tx)) <= 1) {
      throw new ForbiddenError(messages.lastAdminDenied);
    }
    const rows = await deactivateUserMembershipsIn(ctx, companyId, userId, tx);
    await deleteUserSessions(ctx, userId, tx);
    await recordAudit(
      {
        action: "member_deactivate",
        targetType: "user",
        targetId: userId,
        companyId,
        after: { memberships: rows.length },
      },
      ctx,
      tx,
    );
    return rows;
  });
}

export async function revokeCompanyAdmin(
  ctx: DataContext,
  userId: string,
) {
  if (ctx.kind !== "staff" || !ctx.roles.includes("company_admin")) {
    throw new ForbiddenError();
  }
  return db.transaction(async (tx) => {
    const admin = await findMembership(ctx, userId, "company_admin", tx);
    if (!admin?.isActive) return admin;
    if ((await countActiveAdmins(ctx, tx)) <= 1) {
      throw new ForbiddenError(messages.lastAdminDenied);
    }
    const row = await setMembershipActive(ctx, admin.id, false, tx);
    await recordAudit(
      {
        action: "member_role_change",
        targetType: "membership",
        targetId: admin.id,
        after: { role: "company_admin", isActive: false },
      },
      ctx,
      tx,
    );
    return row;
  });
}

export type AcceptInviteResult =
  | { ok: true; invite: Awaited<ReturnType<typeof findInvitationByToken>> }
  | { ok: false; reason: "expired" | "email_mismatch" };

/**
 * ARCHITECTURE.md 7.5 — 초대 수락.
 *
 * 컨텍스트: 수락 시점에는 아직 멤버십·접근이 없으므로 staff 컨텍스트를 만들 수 없다.
 * 예전 구현은 **수락자 본인에게 company_admin 컨텍스트**를 날조해 썼는데,
 * 그러면 감사 로그의 행위자가 초대한 PM 이 아니라 초대받은 고객으로 남는다.
 * 6.3 이 허용한 system 배치 컨텍스트를 쓰고, 실제 부여자·수락자는 감사에 명시한다.
 *
 * 이메일 바인딩: company_member 초대는 초대장 이메일과 수락 계정 이메일이
 * 일치해야 한다(스태프 권한이 링크 유출만으로 넘어가면 안 된다).
 * project_customer 초대는 배우자·가족 전달이 정상 사용이므로 묶지 않는다.
 */
export async function acceptInvitationForUser(
  userId: string,
  token: string,
): Promise<AcceptInviteResult> {
  const ctx = systemJob("invite-accept");
  const invite = await findInvitationByToken(ctx, token);
  if (!invite || invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" as const };
  }

  if (invite.kind === "company_member" && invite.email) {
    const account = await findUserById(ctx, userId);
    if (
      !account ||
      account.email.trim().toLowerCase() !== invite.email.trim().toLowerCase()
    ) {
      return { ok: false as const, reason: "email_mismatch" as const };
    }
  }

  await db.transaction(async (tx) => {
    if (invite.kind === "company_member") {
      if (!invite.role) throw new Error("초대 역할이 없습니다.");
      const existing = await findMembershipIn(
        ctx,
        invite.companyId,
        userId,
        invite.role,
        tx,
      );
      if (!existing) {
        await insertMembership(
          ctx,
          {
            userId,
            companyId: invite.companyId,
            role: invite.role,
            grantedBy: invite.invitedBy,
          },
          tx,
        );
      }
      // 12.2 — 멤버 권한이 실제로 생기는 시점도 기록한다.
      await recordAudit(
        {
          action: "member_role_change",
          targetType: "membership",
          targetId: invite.id,
          companyId: invite.companyId,
          after: {
            role: invite.role,
            grantedBy: invite.invitedBy,
            acceptedBy: userId,
          },
        },
        ctx,
        tx,
      );
    } else if (invite.kind === "project_customer") {
      if (!invite.projectId) throw new Error("초대 프로젝트가 없습니다.");
      const existing = await findAccessByProjectUser(
        ctx,
        invite.projectId,
        userId,
        tx,
      );
      if (existing?.revokedAt) {
        await restoreAccess(ctx, existing.id, invite.invitedBy, tx);
      } else if (!existing) {
        await insertProjectAccess(
          ctx,
          {
            companyId: invite.companyId,
            projectId: invite.projectId,
            userId,
            grantedBy: invite.invitedBy,
          },
          tx,
        );
      }
      await recordAudit(
        {
          action: "project_access_grant",
          targetType: "project",
          targetId: invite.projectId,
          projectId: invite.projectId,
          companyId: invite.companyId,
          after: { grantedBy: invite.invitedBy, acceptedBy: userId },
        },
        ctx,
        tx,
      );
    }
    await markInvitationAccepted(ctx, invite.id, userId, tx);
  });

  if (invite.kind === "project_customer" && invite.projectId) {
    // 수락한 고객 + 초대한 담당자 (7.5)
    await emit("project.access_granted", {
      companyId: invite.companyId,
      projectId: invite.projectId,
      targetId: invite.projectId,
      actorUserId: userId,
    });
  }
  return { ok: true as const, invite };
}
