import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { recordAudit } from "@/modules/audit";
import { companies } from "@/modules/company/schema";
import { customers } from "@/modules/customer/schema";
import { users } from "@/modules/membership/auth-tables";
import { findProjectById } from "@/modules/project/repo";
import { projects } from "@/modules/project/schema";
import { auditLogs } from "@/modules/audit/schema";
import { assertSameTenant, createPlatformContext } from "@/lib/tenancy";
import { TenantViolationError } from "@/lib/errors";

async function seedTwoCompanies() {
  const [user] = await db
    .insert(users)
    .values({
      email: `p2a-${randomUUID()}@example.com`,
      name: "tester",
    })
    .returning();
  const [companyA] = await db
    .insert(companies)
    .values({ name: "A", slug: `a-${randomUUID().slice(0, 8)}`, createdBy: user.id })
    .returning();
  const [companyB] = await db
    .insert(companies)
    .values({ name: "B", slug: `b-${randomUUID().slice(0, 8)}`, createdBy: user.id })
    .returning();
  const [customer] = await db
    .insert(customers)
    .values({ companyId: companyB.id, name: "고객" })
    .returning();
  const [project] = await db
    .insert(projects)
    .values({
      companyId: companyB.id,
      customerId: customer.id,
      managerId: user.id,
      title: "B 프로젝트",
      createdBy: user.id,
    })
    .returning();
  return { user, companyA, companyB, project };
}

test("업체 A 컨텍스트로 업체 B 프로젝트 조회는 차단된다", async () => {
  const { user, companyA, project } = await seedTwoCompanies();
  const ctxA = {
    kind: "staff" as const,
    companyId: companyA.id,
    userId: user.id,
    roles: ["project_manager" as const],
  };
  expect(await findProjectById(ctxA, project.id)).toBeNull();
  expect(() => assertSameTenant(ctxA, project)).toThrow(TenantViolationError);
});

test("platform 컨텍스트 생성 시 cross_tenant_query 감사 로그가 남는다", async () => {
  const { user } = await seedTwoCompanies();
  await createPlatformContext(user.id, "P2-a 테스트");
  const [log] = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.actorId, user.id),
        eq(auditLogs.actionType, "cross_tenant_query"),
      ),
    )
    .limit(1);
  expect(log).toBeTruthy();
});

test("recordAudit 실패 시 비즈니스 트랜잭션이 롤백된다", async () => {
  const { user, companyB } = await seedTwoCompanies();
  const missingCompanyId = randomUUID();
  await expect(
    db.transaction(async (tx) => {
      await tx.insert(customers).values({
        companyId: companyB.id,
        name: "롤백대상",
      });
      await recordAudit(
        { action: "company_create", targetType: "company" },
        {
          kind: "staff",
          companyId: missingCompanyId,
          userId: user.id,
          roles: ["company_admin"],
        },
        tx,
      );
    }),
  ).rejects.toThrow();
  const leftover = await db
    .select()
    .from(customers)
    .where(eq(customers.name, "롤백대상"));
  expect(leftover).toHaveLength(0);
});
