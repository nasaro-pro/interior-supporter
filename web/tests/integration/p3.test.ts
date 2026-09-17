import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { ForbiddenError, DomainError } from "@/lib/errors";
import { companies } from "@/modules/company/schema";
import { customers } from "@/modules/customer/schema";
import { memberships, users } from "@/modules/membership/schema";
import { pages } from "@/modules/page-builder/schema";
import { createProject, findProjectById } from "@/modules/project";
import { createSchedule } from "@/modules/schedule/service";
import { changeDesignVisibility, createDesignVersion } from "@/modules/design/service";
import { fetchLinkPreview } from "@/modules/material";
import { storageObjects } from "@/modules/storage-quota/schema";
import { signUpload, completeUpload, findStorageObjectById } from "@/modules/storage-quota";
import { getStorageAdapter } from "@/lib/storage";
import sharp from "sharp";

async function seed() {
  const [admin] = await db
    .insert(users)
    .values({ email: `p3-admin-${randomUUID()}@example.com`, name: "admin" })
    .returning();
  const [pm] = await db
    .insert(users)
    .values({ email: `p3-pm-${randomUUID()}@example.com`, name: "pm" })
    .returning();
  const [other] = await db
    .insert(users)
    .values({ email: `p3-other-${randomUUID()}@example.com`, name: "other" })
    .returning();
  const [company] = await db
    .insert(companies)
    .values({
      name: "P3 Co",
      slug: `p3-${randomUUID().slice(0, 8)}`,
      createdBy: admin.id,
    })
    .returning();
  const [companyB] = await db
    .insert(companies)
    .values({
      name: "P3 B",
      slug: `p3b-${randomUUID().slice(0, 8)}`,
      createdBy: other.id,
    })
    .returning();
  await db.insert(memberships).values([
    { userId: admin.id, companyId: company.id, role: "company_admin" },
    { userId: admin.id, companyId: company.id, role: "project_manager" },
    { userId: pm.id, companyId: company.id, role: "project_manager" },
    { userId: other.id, companyId: companyB.id, role: "company_admin" },
  ]);
  const [customer] = await db
    .insert(customers)
    .values({ companyId: company.id, name: "고객" })
    .returning();
  return { admin, pm, other, company, companyB, customer };
}

test("PM 프로젝트 생성 시 담당자는 본인으로 고정된다", async () => {
  const { admin, pm, customer, company } = await seed();
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: pm.id,
    roles: ["project_manager" as const],
  };
  const project = await createProject(ctx, {
    title: "PM 프로젝트",
    customerId: customer.id,
    managerId: admin.id,
  });
  expect(project.managerId).toBe(pm.id);
  const [home] = await db
    .select()
    .from(pages)
    .where(eq(pages.projectId, project.id));
  expect(home?.title).toBe("프로젝트 홈");
});

test("총관리자는 다른 PM을 담당자로 지정할 수 있다", async () => {
  const { admin, pm, customer, company } = await seed();
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const project = await createProject(ctx, {
    title: "Admin 프로젝트",
    customerId: customer.id,
    managerId: pm.id,
  });
  expect(project.managerId).toBe(pm.id);
});

test("일정 생성 직후는 초안이다", async () => {
  const { admin, customer, company } = await seed();
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const project = await createProject(ctx, {
    title: "일정 프로젝트",
    customerId: customer.id,
  });
  const schedule = await createSchedule(ctx, {
    projectId: project.id,
    type: "visit",
    title: "현장 방문",
    startAt: new Date().toISOString(),
  });
  expect(schedule.visibilityStatus).toBe("draft");
});

test("디자인 초안→공개 전이는 서비스에서도 거부된다", async () => {
  const { admin, customer, company } = await seed();
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const project = await createProject(ctx, {
    title: "디자인 프로젝트",
    customerId: customer.id,
  });
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: company.id,
      projectId: project.id,
      objectKey: `k-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: admin.id,
    })
    .returning();
  const design = await createDesignVersion(ctx, {
    projectId: project.id,
    versionName: "1안",
    storageObjectId: object.id,
  });
  await expect(
    changeDesignVisibility(ctx, design.id, "published"),
  ).rejects.toBeInstanceOf(ForbiddenError);
});

test("다른 업체 프로젝트는 조회되지 않는다", async () => {
  const { admin, customer, company, companyB, other } = await seed();
  const ctxA = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const project = await createProject(ctxA, {
    title: "A 프로젝트",
    customerId: customer.id,
  });
  const ctxB = {
    kind: "staff" as const,
    companyId: companyB.id,
    userId: other.id,
    roles: ["company_admin" as const],
  };
  await expect(findProjectById(ctxB, project.id)).resolves.toBeNull();
});

test("확장자 위조 파일은 격리 후 삭제된다", async () => {
  const { admin, customer, company } = await seed();
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const project = await createProject(ctx, {
    title: "파일 프로젝트",
    customerId: customer.id,
  });
  const fake = Buffer.from("not-a-jpeg");
  const signed = await signUpload(ctx, {
    filename: "x.jpg",
    contentType: "image/jpeg",
    contentLength: fake.byteLength,
    category: "photo",
    projectId: project.id,
  });
  const pending = await findStorageObjectById(ctx, signed.objectId);
  await getStorageAdapter().put(pending!.objectKey, fake, "image/jpeg");
  await expect(completeUpload(ctx, signed.objectId)).rejects.toBeInstanceOf(
    DomainError,
  );
  const after = await db
    .select()
    .from(storageObjects)
    .where(eq(storageObjects.id, signed.objectId));
  expect(after[0]?.status).toBe("quarantined");
});

test("정상 이미지 완료 시 썸네일과 사용량이 갱신된다", async () => {
  const { admin, customer, company } = await seed();
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const project = await createProject(ctx, {
    title: "썸네일 프로젝트",
    customerId: customer.id,
  });
  const jpeg = await sharp({
    create: { width: 20, height: 20, channels: 3, background: "#c00" },
  })
    .jpeg()
    .toBuffer();
  const signed = await signUpload(ctx, {
    filename: "ok.jpg",
    contentType: "image/jpeg",
    contentLength: jpeg.byteLength,
    category: "photo",
    projectId: project.id,
  });
  const pending = await findStorageObjectById(ctx, signed.objectId);
  await getStorageAdapter().put(pending!.objectKey, jpeg, "image/jpeg");
  const done = await completeUpload(ctx, signed.objectId);
  expect(done?.status).toBe("ready");
  expect(done?.thumbKey).toBeTruthy();
  const [updatedCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, company.id));
  expect(updatedCompany.storageUsedMb).toBeGreaterThan(0);
});

test("자재 링크 127.0.0.1 은 거부된다", async () => {
  const { admin, customer, company } = await seed();
  const ctx = {
    kind: "staff" as const,
    companyId: company.id,
    userId: admin.id,
    roles: ["company_admin" as const, "project_manager" as const],
  };
  const project = await createProject(ctx, {
    title: "링크 프로젝트",
    customerId: customer.id,
  });
  await expect(
    fetchLinkPreview(ctx, project.id, "http://127.0.0.1/secret"),
  ).rejects.toBeInstanceOf(ForbiddenError);
});



