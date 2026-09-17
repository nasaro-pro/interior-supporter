import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { ForbiddenError } from "@/lib/errors";
import { seedCanonical } from "../fixtures/seed";
import { memberships, users } from "@/modules/membership/schema";
import { grantAssignment } from "@/modules/assignment/service";
import { loadProjectStaff, assertFieldAssigned, assertStaffOwnsProject } from "@/lib/authz";
import { createFieldLog } from "@/modules/field-log/service";
import { createCustomerRequest, addRequestCorrection } from "@/modules/request/service";
import { listRequests } from "@/modules/request/repo";

test("시공팀은 미배정 프로젝트 스태프 워크스페이스에 들어갈 수 없다", async () => {
  const seed = await seedCanonical();
  const [field] = await db
    .insert(users)
    .values({
      email: `field-${randomUUID()}@example.com`,
      name: "field",
      emailVerified: true,
    })
    .returning();
  await db.insert(memberships).values({
    userId: field.id,
    companyId: seed.companyA.id,
    role: "field_worker",
  });
  await expect(loadProjectStaff(field.id, seed.projectA1.id)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("배정된 시공팀만 작업일지를 남기고 만료 후는 거부된다", async () => {
  const seed = await seedCanonical();
  const [field] = await db
    .insert(users)
    .values({
      email: `field2-${randomUUID()}@example.com`,
      name: "field2",
      emailVerified: true,
    })
    .returning();
  await db.insert(memberships).values({
    userId: field.id,
    companyId: seed.companyA.id,
    role: "field_worker",
  });
  const fieldCtx = {
    kind: "staff" as const,
    companyId: seed.companyA.id,
    userId: field.id,
    roles: ["field_worker" as const],
  };
  await expect(assertFieldAssigned(fieldCtx, seed.projectA1.id)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
  await grantAssignment(seed.staffA, {
    projectId: seed.projectA1.id,
    userId: field.id,
    assignmentRole: "field_worker",
    startsAt: "2026-01-01T00:00",
    endsAt: "2026-12-31T23:59",
  });
  await assertFieldAssigned(fieldCtx, seed.projectA1.id);
  const log = await createFieldLog(fieldCtx, {
    projectId: seed.projectA1.id,
    processCategory: "finishing",
    body: "오늘 마감",
    status: "started",
  });
  expect(log.body).toBe("오늘 마감");
  await expect(assertStaffOwnsProject(fieldCtx, seed.projectA1.id)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("고객 요청 원문은 정정으로만 보완된다", async () => {
  const seed = await seedCanonical();
  const customerCtx = {
    kind: "customer" as const,
    companyId: seed.companyA.id,
    projectId: seed.projectA1.id,
    userId: seed.custA.id,
    verified: true,
  };
  const created = await createCustomerRequest(customerCtx, seed.projectA1.id, "벽지 변경");
  expect(created.originalBody).toBe("벽지 변경");
  await addRequestCorrection(customerCtx, created.id, "색만 아이보리");
  const rows = await listRequests(customerCtx, seed.projectA1.id);
  expect(rows[0]?.request.originalBody).toBe("벽지 변경");
});
