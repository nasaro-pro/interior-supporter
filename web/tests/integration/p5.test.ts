import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { db } from "@/lib/db/client";
import { ForbiddenError, TenantViolationError, VerificationRequiredError } from "@/lib/errors";
import { assertSameTenant } from "@/lib/tenancy";
import { findProjectById } from "@/modules/project";
import { setDesignApproval, createDesignVersion, changeDesignVisibility } from "@/modules/design/service";
import { loadProjectAccess } from "@/lib/authz/portal";
import { insertProjectAccess } from "@/modules/access/repo";
import { issueVerificationCode, verifyProjectCode, isVerified } from "@/modules/access";
import { auditLogs } from "@/modules/audit/schema";
import { storageObjects } from "@/modules/storage-quota/schema";
import { createPhotos, changePhotoVisibility, pairPhotos } from "@/modules/photo/service";
import { loadHomePage, saveAsProjectTemplate, requestTemplatePromotion, approveTemplatePromotion } from "@/modules/page-builder";
import { findPageByProject, insertBlock } from "@/modules/page-builder/repo";
import { createComment, editComment } from "@/modules/comment/service";
import { signUpload, completeUpload, findStorageObjectById } from "@/modules/storage-quota";
import { getStorageAdapter } from "@/lib/storage";
import { fetchLinkPreview } from "@/modules/material";
import { deactivateMember } from "@/modules/membership";
import { staffContextFor, loadProjectStaff } from "@/lib/authz";
import { seedCanonical } from "../fixtures/seed";

test("T-02 업체 A 컨텍스트로 업체 B 리소스 id 는 TenantViolation 또는 미조회", async () => {
  const { staffA, projectB1 } = await seedCanonical();
  await expect(findProjectById(staffA, projectB1.id)).resolves.toBeNull();
  expect(() => assertSameTenant(staffA, projectB1)).toThrow(TenantViolationError);
});

test("T-05 확정 코드 없이 승인은 거부되고 verification_failed 가 남는다", async () => {
  const { custA, staffA, projectA1, companyA, adminA } = await seedCanonical();
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: companyA.id,
      projectId: projectA1.id,
      objectKey: `t05-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: adminA.id,
    })
    .returning();
  const design = await createDesignVersion(staffA, {
    projectId: projectA1.id,
    versionName: "승인안",
    storageObjectId: object.id,
  });
  await changeDesignVisibility(staffA, design.id, "review");
  await changeDesignVisibility(staffA, design.id, "published");
  const ctx = await loadProjectAccess(custA.id, projectA1.id);
  await expect(setDesignApproval(ctx, design.id, "approved")).rejects.toBeInstanceOf(
    VerificationRequiredError,
  );
  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.actionType, "verification_failed"));
  expect(logs.some((row) => row.projectId === projectA1.id && row.actorId === custA.id)).toBe(true);
}, 20_000);

test("T-06 코드 재발급 후 기존 검증은 거부된다", async () => {
  const { custA, staffA, projectA1, companyA, adminA } = await seedCanonical();
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: companyA.id,
      projectId: projectA1.id,
      objectKey: `t06-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: adminA.id,
    })
    .returning();
  const design = await createDesignVersion(staffA, {
    projectId: projectA1.id,
    versionName: "재발급",
    storageObjectId: object.id,
  });
  await changeDesignVisibility(staffA, design.id, "review");
  await changeDesignVisibility(staffA, design.id, "published");
  const code = await issueVerificationCode(staffA, projectA1.id);
  let ctx = await loadProjectAccess(custA.id, projectA1.id);
  await verifyProjectCode(ctx, projectA1.id, code);
  await issueVerificationCode(staffA, projectA1.id);
  expect(await isVerified(ctx, projectA1.id, custA.id)).toBe(false);
  ctx = await loadProjectAccess(custA.id, projectA1.id);
  await expect(setDesignApproval(ctx, design.id, "approved")).rejects.toBeInstanceOf(
    VerificationRequiredError,
  );
});

test("T-07 코드 6회 오입력은 잠긴다", async () => {
  const { custA, staffA, projectA1 } = await seedCanonical();
  await issueVerificationCode(staffA, projectA1.id);
  const ctx = await loadProjectAccess(custA.id, projectA1.id);
  const { verifyProjectCode } = await import("@/modules/access");
  const { RateLimitError } = await import("@/lib/errors");
  for (let i = 0; i < 5; i += 1) {
    const result = await verifyProjectCode(ctx, projectA1.id, "XXXXXXXX");
    expect(result.ok).toBe(false);
  }
  await expect(verifyProjectCode(ctx, projectA1.id, "XXXXXXXX")).rejects.toBeInstanceOf(
    RateLimitError,
  );
});

test("T-09 draft→published 직접 전이는 거부된다", async () => {
  const { staffA, projectA1, companyA, adminA } = await seedCanonical();
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: companyA.id,
      projectId: projectA1.id,
      objectKey: `t09-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: adminA.id,
    })
    .returning();
  const design = await createDesignVersion(staffA, {
    projectId: projectA1.id,
    versionName: "직접공개",
    storageObjectId: object.id,
  });
  await expect(changeDesignVisibility(staffA, design.id, "published")).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("T-10 Before&After 한 장만 공개면 블록이 빠진다", async () => {
  const { staffA, projectA1, companyA, adminA, custA } = await seedCanonical();
  const objects = [];
  for (let i = 0; i < 2; i += 1) {
    const [object] = await db
      .insert(storageObjects)
      .values({
        companyId: companyA.id,
        projectId: projectA1.id,
        objectKey: `t10-${i}-${randomUUID()}`,
        category: "photo",
        mimeType: "image/jpeg",
        byteSize: 10,
        status: "ready",
        uploadedBy: adminA.id,
      })
      .returning();
    objects.push(object);
  }
  const photos = await createPhotos(staffA, {
    projectId: projectA1.id,
    processCategory: "demolition",
    objectIds: objects.map((o) => o.id),
  });
  const pairGroupId = randomUUID();
  await pairPhotos(staffA, {
    beforeId: photos[0]!.id,
    afterId: photos[1]!.id,
    pairGroupId,
  });
  await changePhotoVisibility(staffA, photos[0]!.id, "review");
  await changePhotoVisibility(staffA, photos[0]!.id, "published");
  const page = await findPageByProject(staffA, projectA1.id);
  await insertBlock(staffA, {
    companyId: companyA.id,
    pageId: page!.id,
    blockType: "before_after",
    orderIndex: 0,
    layout: { x: 0, y: 0, w: 12, h: 4 },
    content: { pairGroupId },
    visibilityStatus: "published",
  });
  const ctx = await loadProjectAccess(custA.id, projectA1.id);
  const home = await loadHomePage(ctx, projectA1.id, { publishedOnly: true });
  expect(home.mode).toBe("default");
});

test("T-11 공개 상태 변경은 감사 before/after 를 남긴다", async () => {
  const { staffA, projectA1, companyA, adminA } = await seedCanonical();
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: companyA.id,
      projectId: projectA1.id,
      objectKey: `t11-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: adminA.id,
    })
    .returning();
  const design = await createDesignVersion(staffA, {
    projectId: projectA1.id,
    versionName: "감사",
    storageObjectId: object.id,
  });
  await changeDesignVisibility(staffA, design.id, "review");
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.targetId, design.id));
  const vis = logs.find((row) => row.actionType === "visibility_change");
  expect(vis?.before).toEqual({ visibilityStatus: "draft" });
  expect(vis?.after).toEqual({ visibilityStatus: "review" });
});

test("T-13 고객이 타인 댓글 수정은 403", async () => {
  const { custA, custShared, staffA, projectA1 } = await seedCanonical();
  await insertProjectAccess(staffA, {
    companyId: staffA.companyId,
    projectId: projectA1.id,
    userId: custShared.id,
    grantedBy: staffA.userId,
  });
  const author = await loadProjectAccess(custA.id, projectA1.id);
  const comment = await createComment(author, { projectId: projectA1.id, body: "내 댓글" });
  const other = await loadProjectAccess(custShared.id, projectA1.id);
  await expect(editComment(other, comment.id, "가로채기")).rejects.toBeInstanceOf(ForbiddenError);
});

test("T-14 PM 이 템플릿 승격을 직접 승인하면 403", async () => {
  const { pmACtx, projectA2 } = await seedCanonical();
  const tpl = await saveAsProjectTemplate(pmACtx, projectA2.id, "제안");
  await requestTemplatePromotion(pmACtx, tpl.id);
  await expect(approveTemplatePromotion(pmACtx, tpl.id)).rejects.toBeInstanceOf(ForbiddenError);
});

test("T-15 허용되지 않은 MIME 업로드는 격리된다", async () => {
  const { staffA, projectA1 } = await seedCanonical();
  const fake = Buffer.from("not-a-jpeg");
  const signed = await signUpload(staffA, {
    filename: "x.jpg",
    contentType: "image/jpeg",
    contentLength: fake.byteLength,
    category: "photo",
    projectId: projectA1.id,
  });
  const pending = await findStorageObjectById(staffA, signed.objectId);
  await getStorageAdapter().put(pending!.objectKey, fake, "image/jpeg");
  await expect(completeUpload(staffA, signed.objectId)).rejects.toBeInstanceOf(Error);
  const after = await db.select().from(storageObjects).where(eq(storageObjects.id, signed.objectId));
  expect(after[0]?.status).toBe("quarantined");
});

test("T-16 링크 미리보기 사설 IP 는 거부된다", async () => {
  const { staffA, projectA1 } = await seedCanonical();
  await expect(fetchLinkPreview(staffA, projectA1.id, "http://127.0.0.1/x")).rejects.toBeInstanceOf(
    ForbiddenError,
  );
});

test("멤버십 회수 후 스태프 컨텍스트가 막힌다", async () => {
  const { staffA, pmRevoke, companyA } = await seedCanonical();
  await deactivateMember(staffA, pmRevoke.id);
  await expect(staffContextFor(pmRevoke.id, companyA.slug)).rejects.toBeInstanceOf(ForbiddenError);
});

test("PM 은 타인 담당 프로젝트 스태프 컨텍스트를 얻지 못한다", async () => {
  const { pmA, projectA1 } = await seedCanonical();
  await expect(loadProjectStaff(pmA.id, projectA1.id)).rejects.toBeInstanceOf(ForbiddenError);
});
