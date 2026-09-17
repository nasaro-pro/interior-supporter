import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ForbiddenError, NotFoundError, RateLimitError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { recordAudit } from "@/modules/audit";
import { getPlatformSetting } from "@/modules/company/repo";
import { findProjectById, updateProjectRow } from "@/modules/project/repo";
import { insertInvitation } from "@/modules/membership/repo";
import { consumeRateLimit } from "@/lib/ratelimit";
import { systemJob } from "@/lib/tenancy/system";
import { env } from "@/lib/config/env";
import {
  findActiveAccess,
  insertVerification,
  listAccessForUser,
  revokeAccess,
  updateAccessLabel,
} from "@/modules/access/repo";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function settingNumber(value: unknown, key: string) {
  if (typeof value !== "number" || value <= 0) {
    throw new Error(`platform_settings.${key} 가 없습니다.`);
  }
  return value;
}

function hashCode(code: string) {
  return createHash("sha256").update(code.toUpperCase()).digest("hex");
}

function randomCode(length: number) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function canManageAccess(ctx: DataContext, managerId: string) {
  if (!isStaff(ctx)) return false;
  return ctx.roles.includes("company_admin") || ctx.userId === managerId;
}

export async function createCustomerInvite(ctx: DataContext, projectId: string) {
  const project = await findProjectById(ctx, projectId);
  if (!project) throw new NotFoundError();
  if (!canManageAccess(ctx, project.managerId) || !isStaff(ctx)) throw new ForbiddenError();
  const days = settingNumber(await getPlatformSetting("invite_expire_days"), "invite_expire_days");
  const token = randomBytes(24).toString("base64url");
  const invite = await insertInvitation(ctx, {
    kind: "project_customer",
    companyId: ctx.companyId,
    projectId,
    token,
    invitedBy: ctx.userId,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  });
  return {
    token,
    url: `${env.NEXT_PUBLIC_APP_URL}/invite/${token}`,
    id: invite.id,
  };
}

export async function revokeProjectAccess(ctx: DataContext, accessId: string) {
  const row = await db.transaction(async (tx) => {
    const updated = await revokeAccess(ctx, accessId, tx);
    if (!updated) throw new NotFoundError();
    await recordAudit(
      {
        action: "project_access_revoke",
        targetType: "project_access",
        targetId: accessId,
        projectId: updated.projectId,
      },
      ctx,
      tx,
    );
    return updated;
  });
  return row;
}

export async function setAccessLabel(
  ctx: DataContext,
  accessId: string,
  label: string,
) {
  const row = await updateAccessLabel(
    ctx,
    accessId,
    labelInput.parse(label.trim() || "") || null,
  );
  if (!row) throw new NotFoundError();
  return row;
}

export async function issueVerificationCode(ctx: DataContext, projectId: string) {
  const project = await findProjectById(ctx, projectId);
  if (!project) throw new NotFoundError();
  if (!canManageAccess(ctx, project.managerId) || !isStaff(ctx)) throw new ForbiddenError();
  const length = settingNumber(await getPlatformSetting("verify_code_length"), "verify_code_length");
  const code = randomCode(length);
  await db.transaction(async (tx) => {
    await updateProjectRow(
      ctx,
      projectId,
      {
        verificationCodeHash: hashCode(code),
        codeVersion: project.codeVersion + 1,
        codeIssuedBy: ctx.userId,
        codeIssuedAt: new Date(),
      },
      tx,
    );
    await recordAudit(
      {
        action: "verification_code_issue",
        targetType: "project",
        targetId: projectId,
        projectId,
        after: { codeVersion: project.codeVersion + 1 },
      },
      ctx,
      tx,
    );
  });
  return code;
}

export async function verifyProjectCode(
  ctx: DataContext,
  projectId: string,
  rawCode: string,
  ip?: string,
) {
  const project = await findProjectById(ctx, projectId);
  if (!project || ctx.kind !== "customer") throw new ForbiddenError();
  const limit = settingNumber(
    await getPlatformSetting("verify_attempt_limit"),
    "verify_attempt_limit",
  );
  const windowMin = settingNumber(
    await getPlatformSetting("verify_attempt_window_min"),
    "verify_attempt_window_min",
  );
  const rl = await consumeRateLimit({
    key: `verify_code:${projectId}:${ctx.userId}`,
    limit,
    windowMs: windowMin * 60 * 1000,
  });
  if (!rl.allowed) {
    await recordAudit({
      action: "verification_failed",
      targetType: "project",
      targetId: projectId,
      projectId,
      after: { reason: "locked" },
    }, ctx);
    throw new RateLimitError();
  }
  const code = rawCode.trim().toUpperCase();
  const digest = hashCode(code);
  const stored = project.verificationCodeHash;
  const ok =
    Boolean(stored) &&
    stored !== null &&
    stored.length === digest.length &&
    timingSafeEqual(Buffer.from(stored), Buffer.from(digest));
  if (!ok) {
    await recordAudit({
      action: "verification_failed",
      targetType: "project",
      targetId: projectId,
      projectId,
      after: { remaining: rl.remaining },
    }, ctx);
    return { ok: false as const, remaining: rl.remaining };
  }
  await db.transaction(async (tx) => {
    await insertVerification(
      ctx,
      {
        companyId: ctx.companyId,
        projectId,
        userId: ctx.userId,
        codeVersion: project.codeVersion,
        ipAddress: ip,
      },
      tx,
    );
    await recordAudit(
      {
        action: "verification_success",
        targetType: "project",
        targetId: projectId,
        projectId,
        after: { codeVersion: project.codeVersion },
      },
      ctx,
      tx,
    );
  });
  return { ok: true as const, remaining: rl.remaining };
}

export { findActiveAccess };

/**
 * 내 프로젝트 목록(/portal). 한 계정이 여러 업체에 초대될 수 있어 업체 경계를
 * 가로지르는 조회이므로 system 헬퍼로만 제공한다 (6.3).
 */
export async function listMyProjects(userId: string) {
  return listAccessForUser(systemJob("portal-list"), userId);
}

export const labelInput = z.string().max(50);
