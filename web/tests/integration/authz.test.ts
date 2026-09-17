import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/errors";
import { staffContextFor } from "@/lib/authz";
import { isStaff } from "@/lib/tenancy";
import { companies } from "@/modules/company/schema";
import { memberships, users, sessions } from "@/modules/membership/schema";
import { staffPolicy } from "@/modules/membership";
import { deactivateMember, revokeCompanyAdmin } from "@/modules/membership";

async function seedCompany() {
  const [admin] = await db
    .insert(users)
    .values({
      email: `admin-${randomUUID()}@example.com`,
      name: "admin",
    })
    .returning();
  const [customer] = await db
    .insert(users)
    .values({
      email: `cust-${randomUUID()}@example.com`,
      name: "customer",
    })
    .returning();
  const [member] = await db
    .insert(users)
    .values({
      email: `pm-${randomUUID()}@example.com`,
      name: "pm",
    })
    .returning();
  const [company] = await db
    .insert(companies)
    .values({
      name: "Test Co",
      slug: `co-${randomUUID().slice(0, 8)}`,
      createdBy: admin.id,
    })
    .returning();
  await db.insert(memberships).values([
    {
      userId: admin.id,
      companyId: company.id,
      role: "company_admin",
    },
    {
      userId: admin.id,
      companyId: company.id,
      role: "project_manager",
    },
    {
      userId: member.id,
      companyId: company.id,
      role: "project_manager",
    },
  ]);
  return { admin, customer, member, company };
}

test("고객 계정은 업체 스태프 컨텍스트를 얻지 못한다", async () => {
  const { customer, company } = await seedCompany();
  await expect(staffContextFor(customer.id, company.slug)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("마지막 company_admin 역할 회수는 거부된다", async () => {
  const { admin, company } = await seedCompany();
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  await expect(revokeCompanyAdmin(ctx, admin.id)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("멤버 비활성화 시 해당 사용자 세션이 삭제된다", async () => {
  const { admin, member, company } = await seedCompany();
  await db.insert(sessions).values({
    userId: member.id,
    token: `tok-${randomUUID()}`,
    expiresAt: new Date(Date.now() + 86400000),
  });
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const],
  };
  await deactivateMember(ctx, member.id);
  const leftover = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, member.id));
  expect(leftover).toHaveLength(0);
});

test("대표 계정은 PM 멤버십으로 콘텐츠 편집 정책이 허용된다", async () => {
  const { admin, company } = await seedCompany();
  const ctx = await staffContextFor(admin.id, company.slug);
  if (!isStaff(ctx)) throw new Error("expected staff");
  expect(staffPolicy.editProjectContent(ctx.roles)).toBe(true);
});
