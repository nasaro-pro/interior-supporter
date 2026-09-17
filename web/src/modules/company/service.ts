import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { recordAudit } from "@/modules/audit";
import { insertFreeSubscription } from "@/modules/billing/repo";
import {
  findCompanyBySlug,
  insertCompany,
  slugTaken,
  updateCompany,
  updateCompanyById,
  findCompanyById,
} from "@/modules/company/repo";
import { insertMembership } from "@/modules/membership/repo";
import { insertDefaultPreferences } from "@/modules/notification/repo";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { staffPolicy } from "@/modules/membership/policy";

export const createCompanyInput = z.object({
  name: z.string().min(1).max(200),
  businessType: z.string().max(50).optional(),
});

export const createCompanyByPlatformInput = createCompanyInput.extend({
  adminEmail: z.email(),
});

function slugBase(name: string) {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "company";
}

export async function createCompany(
  userId: string,
  raw: z.infer<typeof createCompanyInput>,
) {
  const input = createCompanyInput.parse(raw);
  let slug = slugBase(input.name);
  if (await slugTaken(slug)) slug = `${slug}-${Date.now().toString(36)}`;
  const companyId = randomUUID();
  const ctx: DataContext = {
    kind: "staff",
    companyId,
    userId,
    roles: ["company_admin", "project_manager"],
  };

  return db.transaction(async (tx) => {
    const company = await insertCompany(
      ctx,
      {
        id: companyId,
        name: input.name,
        slug,
        businessType: input.businessType,
        status: "active",
        planTier: "free",
        createdBy: userId,
      },
      tx,
    );
    await insertMembership(
      ctx,
      { userId, companyId: company.id, role: "company_admin", grantedBy: userId },
      tx,
    );
    await insertMembership(
      ctx,
      {
        userId,
        companyId: company.id,
        role: "project_manager",
        grantedBy: userId,
      },
      tx,
    );
    await insertFreeSubscription(ctx, company.id, tx);
    await insertDefaultPreferences(ctx, userId, tx);
    await recordAudit(
      {
        action: "company_create",
        targetType: "company",
        targetId: company.id,
        after: { slug, planTier: "free" },
      },
      ctx,
      tx,
    );
    return company;
  });
}

/**
 * SITE_DESIGN 2.2 — 플랫폼 운영자가 테넌트를 만든다.
 * 운영자 본인은 업체 멤버십을 갖지 않는다. 총관리자는 초대 수락으로 생긴다.
 */
export async function createCompanyByPlatform(
  ctx: DataContext,
  raw: z.infer<typeof createCompanyByPlatformInput>,
) {
  if (ctx.kind !== "platform") throw new ForbiddenError();
  const input = createCompanyByPlatformInput.parse(raw);
  let slug = slugBase(input.name);
  if (await slugTaken(slug)) slug = `${slug}-${Date.now().toString(36)}`;
  const companyId = randomUUID();

  const company = await db.transaction(async (tx) => {
    const row = await insertCompany(
      ctx,
      {
        id: companyId,
        name: input.name,
        slug,
        businessType: input.businessType,
        status: "active",
        planTier: "free",
        createdBy: ctx.userId,
      },
      tx,
    );
    await insertFreeSubscription(ctx, row.id, tx);
    await recordAudit(
      {
        action: "company_create",
        targetType: "company",
        targetId: row.id,
        after: { slug, planTier: "free" },
      },
      ctx,
      tx,
    );
    return row;
  });

  const { inviteMemberByPlatform } = await import("@/modules/membership/service");
  await inviteMemberByPlatform(ctx, company.id, {
    email: input.adminEmail,
    role: "company_admin",
  });
  return company;
}

export const companySettingsInput = z.object({
  name: z.string().trim().min(1).max(200),
  brandColor: z.string().max(20).optional(),
  brandLogoObjectId: z.string().uuid().optional(),
});

export async function updateCompanySettings(
  ctx: DataContext,
  slug: string,
  raw: z.infer<typeof companySettingsInput>,
) {
  if (!isStaff(ctx) || !staffPolicy.manageCompanySettings(ctx.roles)) {
    throw new ForbiddenError();
  }
  const input = companySettingsInput.parse(raw);
  const company = await findCompanyBySlug(ctx, slug);
  if (!company) throw new NotFoundError();
  return updateCompany(ctx, {
    name: input.name,
    brandColor: input.brandColor || null,
    brandLogoObjectId: input.brandLogoObjectId,
  });
}

const companyStatus = z.enum(["active", "past_due", "suspended"]);

export async function changeCompanyStatus(
  ctx: DataContext,
  companyId: string,
  raw: string,
) {
  if (ctx.kind !== "platform") throw new ForbiddenError();
  const status = companyStatus.parse(raw);
  const current = await findCompanyById(ctx, companyId);
  if (!current) throw new NotFoundError();
  const updated = await db.transaction(async (tx) => {
    const row = await updateCompanyById(ctx, companyId, { status }, tx);
    await recordAudit(
      {
        action: "company_status_change",
        targetType: "company",
        targetId: companyId,
        before: { status: current.status },
        after: { status },
      },
      ctx,
      tx,
    );
    return row;
  });
  const { emit } = await import("@/lib/notify");
  await emit("company.status_changed", {
    companyId,
    targetId: companyId,
    actorUserId: ctx.userId,
    variables: { status },
  });
  return updated;
}

export async function savePlatformSetting(
  ctx: DataContext,
  key: string,
  rawValue: string,
) {
  if (ctx.kind !== "platform") throw new ForbiddenError();
  const { upsertPlatformSetting } = await import("@/modules/company/repo");
  let value: unknown = rawValue;
  try {
    value = JSON.parse(rawValue) as unknown;
  } catch {
    value = rawValue;
  }
  return upsertPlatformSetting(ctx, key, value);
}
