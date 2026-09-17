import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { ForbiddenError, RateLimitError, VerificationRequiredError } from "@/lib/errors";
import { loadProjectAccess } from "@/lib/authz/portal";
import { GET as publishScheduled } from "@/app/api/cron/publish-scheduled/route";
import { companies, platformSettings } from "@/modules/company/schema";
import { customers } from "@/modules/customer/schema";
import { memberships, users } from "@/modules/membership/schema";
import { createProject } from "@/modules/project";
import { insertProjectAccess } from "@/modules/access/repo";
import {
  createCustomerInvite,
  issueVerificationCode,
  revokeProjectAccess,
  verifyProjectCode,
  listMyProjects,
  isVerified,
} from "@/modules/access";
import { acceptInvitationForUser } from "@/modules/membership";
import { createPhotos, bulkChangePhotoVisibility } from "@/modules/photo/service";
import { listPhotos } from "@/modules/photo";
import { changeDesignVisibility, createDesignVersion } from "@/modules/design/service";
import { setDesignApproval } from "@/modules/design/service";
import { createComment } from "@/modules/comment";
import { editComment } from "@/modules/comment/service";
import { storageObjects } from "@/modules/storage-quota/schema";
import { notifications } from "@/modules/notification/schema";
import { auditLogs } from "@/modules/audit/schema";
import { progressPhotos } from "@/modules/photo/schema";

async function ensureSettings() {
  const rows: Array<[string, unknown]> = [
    ["invite_expire_days", 7],
    ["verify_code_length", 8],
    ["verify_attempt_limit", 5],
    ["verify_attempt_window_min", 10],
  ];
  for (const [key, value] of rows) {
    await db
      .insert(platformSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value },
      });
  }
}

async function seed() {
  await ensureSettings();
  const [admin] = await db
    .insert(users)
    .values({ email: `p4-admin-${randomUUID()}@example.com`, name: "admin" })
    .returning();
  const [customer] = await db
    .insert(users)
    .values({ email: `p4-cust-${randomUUID()}@example.com`, name: "customer" })
    .returning();
  const [stranger] = await db
    .insert(users)
    .values({ email: `p4-str-${randomUUID()}@example.com`, name: "stranger" })
    .returning();
  const [company] = await db
    .insert(companies)
    .values({
      name: "P4 Co",
      slug: `p4-${randomUUID().slice(0, 8)}`,
      createdBy: admin.id,
    })
    .returning();
  const [companyB] = await db
    .insert(companies)
    .values({
      name: "P4 B",
      slug: `p4b-${randomUUID().slice(0, 8)}`,
      createdBy: admin.id,
    })
    .returning();
  await db.insert(memberships).values([
    { userId: admin.id, companyId: company.id, role: "company_admin" },
    { userId: admin.id, companyId: company.id, role: "project_manager" },
    { userId: admin.id, companyId: companyB.id, role: "company_admin" },
    { userId: admin.id, companyId: companyB.id, role: "project_manager" },
  ]);
  const [custRow] = await db
    .insert(customers)
    .values({ companyId: company.id, name: "고객A" })
    .returning();
  const [custRowB] = await db
    .insert(customers)
    .values({ companyId: companyB.id, name: "고객B" })
    .returning();
  const staff = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const staffB = {
    kind: "staff" as const,
    companyId: companyB.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const project = await createProject(staff, {
    title: "P4 프로젝트",
    customerId: custRow.id,
  });
  const projectB = await createProject(staffB, {
    title: "P4 다른업체",
    customerId: custRowB.id,
  });
  return { admin, customer, stranger, company, companyB, staff, project, projectB };
}

async function grant(staff: {
  kind: "staff";
  companyId: string;
  userId: string;
  roles: Array<"company_admin" | "project_manager">;
}, projectId: string, userId: string) {
  return insertProjectAccess(staff, {
    companyId: staff.companyId,
    projectId,
    userId,
    grantedBy: staff.userId,
  });
}

test("접근 없는 계정은 포털 컨텍스트를 얻지 못한다", async () => {
  const { stranger, project } = await seed();
  await expect(loadProjectAccess(stranger.id, project.id)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("접근 회수 직후 해당 계정은 거부된다", async () => {
  const { customer, staff, project } = await seed();
  const access = await grant(staff, project.id, customer.id);
  const ctx = await loadProjectAccess(customer.id, project.id);
  expect(ctx.kind).toBe("customer");
  await revokeProjectAccess(staff, access.id);
  await expect(loadProjectAccess(customer.id, project.id)).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("초안 사진은 고객 조회에서 빠진다", async () => {
  const { customer, staff, project, company } = await seed();
  await grant(staff, project.id, customer.id);
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: company.id,
      projectId: project.id,
      objectKey: `p4-${randomUUID()}`,
      category: "photo",
      mimeType: "image/jpeg",
      byteSize: 10,
      status: "ready",
      uploadedBy: staff.userId,
    })
    .returning();
  await createPhotos(staff, {
    projectId: project.id,
    processCategory: "demolition",
    objectIds: [object.id],
  });
  const ctx = await loadProjectAccess(customer.id, project.id);
  const published = await listPhotos(ctx, project.id, "demolition", {
    publishedOnly: true,
  });
  const all = await listPhotos(staff, project.id, "demolition");
  expect(published.items).toHaveLength(0);
  expect(all.items).toHaveLength(1);
  expect(all.items[0]?.visibilityStatus).toBe("draft");
});

test("미검증 승인과 binding 댓글은 거부된다", async () => {
  const { customer, staff, project, company } = await seed();
  await grant(staff, project.id, customer.id);
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: company.id,
      projectId: project.id,
      objectKey: `p4d-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: staff.userId,
    })
    .returning();
  const design = await createDesignVersion(staff, {
    projectId: project.id,
    versionName: "1안",
    storageObjectId: object.id,
  });
  await changeDesignVisibility(staff, design.id, "review");
  await changeDesignVisibility(staff, design.id, "published");
  const ctx = await loadProjectAccess(customer.id, project.id);
  await expect(setDesignApproval(ctx, design.id, "approved")).rejects.toBeInstanceOf(
    VerificationRequiredError,
  );
  await expect(
    createComment(ctx, { projectId: project.id, body: "확정", binding: true }),
  ).rejects.toBeInstanceOf(VerificationRequiredError);
});

test("확정 코드 입력 후 승인되고 재발급하면 무효다", async () => {
  const { customer, staff, project, company } = await seed();
  await grant(staff, project.id, customer.id);
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: company.id,
      projectId: project.id,
      objectKey: `p4v-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: staff.userId,
    })
    .returning();
  const design = await createDesignVersion(staff, {
    projectId: project.id,
    versionName: "승인안",
    storageObjectId: object.id,
  });
  await changeDesignVisibility(staff, design.id, "review");
  await changeDesignVisibility(staff, design.id, "published");
  const code = await issueVerificationCode(staff, project.id);
  let ctx = await loadProjectAccess(customer.id, project.id);
  const verified = await verifyProjectCode(ctx, project.id, code);
  expect(verified.ok).toBe(true);
  ctx = await loadProjectAccess(customer.id, project.id);
  expect(ctx.verified).toBe(true);
  const approved = await setDesignApproval(ctx, design.id, "approved", "OK");
  expect(approved?.approvalStatus).toBe("approved");
  expect(approved?.approvedBy).toBe(customer.id);
  await issueVerificationCode(staff, project.id);
  expect(await isVerified(ctx, project.id, customer.id)).toBe(false);
  ctx = await loadProjectAccess(customer.id, project.id);
  await expect(setDesignApproval(ctx, design.id, "rejected")).rejects.toBeInstanceOf(
    VerificationRequiredError,
  );
});

test("코드 6회 오입력은 잠긴다", async () => {
  const { customer, staff, project } = await seed();
  await grant(staff, project.id, customer.id);
  await issueVerificationCode(staff, project.id);
  const ctx = await loadProjectAccess(customer.id, project.id);
  for (let i = 0; i < 5; i += 1) {
    const result = await verifyProjectCode(ctx, project.id, "XXXXXXXX");
    expect(result.ok).toBe(false);
  }
  await expect(verifyProjectCode(ctx, project.id, "XXXXXXXX")).rejects.toBeInstanceOf(
    RateLimitError,
  );
});

test("확정 지시 댓글은 본문이 감사에 남고 수정할 수 없다", async () => {
  const { customer, staff, project } = await seed();
  await grant(staff, project.id, customer.id);
  const code = await issueVerificationCode(staff, project.id);
  let ctx = await loadProjectAccess(customer.id, project.id);
  await verifyProjectCode(ctx, project.id, code);
  ctx = await loadProjectAccess(customer.id, project.id);
  const comment = await createComment(ctx, {
    projectId: project.id,
    body: "이 안으로 확정합니다",
    binding: true,
  });
  expect(comment.kind).toBe("binding");
  const [log] = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.targetId, comment.id));
  expect(log?.actionType).toBe("binding_comment");
  expect((log?.after as { body?: string } | null)?.body).toBe("이 안으로 확정합니다");
  await expect(editComment(staff, comment.id, "수정")).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("사진 10장 일괄 공개는 알림 1건이다", async () => {
  const { customer, staff, project, company } = await seed();
  await grant(staff, project.id, customer.id);
  const objects = [];
  for (let i = 0; i < 10; i += 1) {
    const [object] = await db
      .insert(storageObjects)
      .values({
        companyId: company.id,
        projectId: project.id,
        objectKey: `p4p-${i}-${randomUUID()}`,
        category: "photo",
        mimeType: "image/jpeg",
        byteSize: 10,
        status: "ready",
        uploadedBy: staff.userId,
      })
      .returning();
    objects.push(object);
  }
  const photos = await createPhotos(staff, {
    projectId: project.id,
    processCategory: "demolition",
    objectIds: objects.map((o) => o.id),
  });
  for (const photo of photos) {
    await db
      .update(progressPhotos)
      .set({ visibilityStatus: "review" })
      .where(eq(progressPhotos.id, photo.id));
  }
  await bulkChangePhotoVisibility(
    staff,
    photos.map((p) => p.id),
    "published",
  );
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.eventType, "photo.published"));
  const mine = rows.filter((r) => r.userId === customer.id && r.projectId === project.id);
  expect(mine.filter((r) => r.channel === "inapp")).toHaveLength(1);
});

test("한 계정은 여러 업체 프로젝트를 함께 본다", async () => {
  const { customer, staff, project, projectB, companyB } = await seed();
  await grant(staff, project.id, customer.id);
  await insertProjectAccess(
    {
      kind: "staff",
      companyId: companyB.id,
      userId: staff.userId,
      roles: ["company_admin", "project_manager"],
    },
    {
      companyId: companyB.id,
      projectId: projectB.id,
      userId: customer.id,
      grantedBy: staff.userId,
    },
  );
  const list = await listMyProjects(customer.id);
  const titles = list.map((row) => row.project.title);
  expect(titles).toEqual(expect.arrayContaining(["P4 프로젝트", "P4 다른업체"]));
});

test("초대 수락 후 프로젝트 접근이 생긴다", async () => {
  const { customer, staff, project } = await seed();
  const invite = await createCustomerInvite(staff, project.id);
  const result = await acceptInvitationForUser(customer.id, invite.token);
  expect(result.ok).toBe(true);
  const ctx = await loadProjectAccess(customer.id, project.id);
  expect(ctx.projectId).toBe(project.id);
});

test("크론 시크릿 없이 요청하면 401이다", async () => {
  const res = await publishScheduled(
    new Request("http://localhost/api/cron/publish-scheduled"),
  );
  expect(res.status).toBe(401);
});
