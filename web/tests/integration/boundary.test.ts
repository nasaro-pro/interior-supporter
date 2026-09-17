import { randomUUID } from "node:crypto";
import { expect, test } from "vitest";
import { eq } from "drizzle-orm";
import { seedCanonical } from "../fixtures/seed";
import { db } from "@/lib/db/client";
import { storageObjects } from "@/modules/storage-quota/schema";
import { auditLogs } from "@/modules/audit/schema";
import { insertProjectAccess, insertVerification } from "@/modules/access/repo";
import {
  changeDesignVisibility,
  createDesignVersion,
  setDesignApproval,
} from "@/modules/design/service";
import { createComment, editComment } from "@/modules/comment/service";
import { createSchedule } from "@/modules/schedule/service";
import { listSchedules } from "@/modules/schedule/repo";
import { createCompany } from "@/modules/company/service";
import { loadProjectAccess } from "@/lib/authz/portal";
import { recordAudit, listAuditLogs } from "@/modules/audit";
import { formatSeoul } from "@/lib/datetime";
import { encodeCursor, decodeCursor } from "@/lib/cursor";
import { TenantViolationError, ForbiddenError } from "@/lib/errors";
import { systemJob } from "@/lib/tenancy/system";

async function publishedDesignIn(
  seed: Awaited<ReturnType<typeof seedCanonical>>,
  projectId: string,
  ctx: Parameters<typeof createDesignVersion>[0],
  uploaderId: string,
  companyId: string,
) {
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId,
      projectId,
      objectKey: `boundary-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: uploaderId,
    })
    .returning();
  const design = await createDesignVersion(ctx, {
    projectId,
    versionName: "경계검증",
    storageObjectId: object.id,
  });
  await changeDesignVisibility(ctx, design.id, "review");
  await changeDesignVisibility(ctx, design.id, "published");
  return design;
}

/** T-18 (I11) — 같은 업체 안에서도 프로젝트 경계를 넘지 못한다 */
test("T-18 프로젝트 A 확정 고객이 같은 업체 프로젝트 B 디자인을 승인할 수 없다", async () => {
  const seed = await seedCanonical();
  // 고객은 A1 에만 접근·확정 권한을 갖는다
  await insertProjectAccess(seed.staffA, {
    companyId: seed.companyA.id,
    projectId: seed.projectA1.id,
    userId: seed.stranger.id,
    grantedBy: seed.adminA.id,
  });
  await insertVerification(seed.staffA, {
    companyId: seed.companyA.id,
    projectId: seed.projectA1.id,
    userId: seed.stranger.id,
    codeVersion: 0,
  });
  // A2 (다른 PM 담당) 에 공개 디자인을 만든다
  const design = await publishedDesignIn(
    seed,
    seed.projectA2.id,
    seed.pmACtx,
    seed.pmA.id,
    seed.companyA.id,
  );

  const ctx = await loadProjectAccess(seed.stranger.id, seed.projectA1.id);
  expect(ctx.verified).toBe(true);
  await expect(setDesignApproval(ctx, design.id, "approved")).rejects.toBeTruthy();
});

/** T-19 (I12) — PM 은 담당 아닌 프로젝트 콘텐츠를 공개할 수 없다 */
test("T-19 PM 이 담당 아닌 프로젝트 디자인의 공개 상태를 바꿀 수 없다", async () => {
  const seed = await seedCanonical();
  // A1 은 adminA 담당. 여기에 초안 디자인을 만든다.
  const [object] = await db
    .insert(storageObjects)
    .values({
      companyId: seed.companyA.id,
      projectId: seed.projectA1.id,
      objectKey: `boundary-${randomUUID()}`,
      category: "design",
      mimeType: "application/pdf",
      byteSize: 10,
      status: "ready",
      uploadedBy: seed.adminA.id,
    })
    .returning();
  const design = await createDesignVersion(seed.staffA, {
    projectId: seed.projectA1.id,
    versionName: "A1 초안",
    storageObjectId: object.id,
  });

  // pmA 는 A2 담당이다. 자기 컨텍스트로 A1 디자인을 건드릴 수 없어야 한다.
  await expect(
    changeDesignVisibility(seed.pmACtx, design.id, "review"),
  ).rejects.toBeInstanceOf(ForbiddenError);
});

/** T-20 — 계정 모델(ADR-10): 한 계정이 업체를 여러 개 만들 수 있다 */
test("T-20 한 계정이 업체를 두 개 개설할 수 있다", async () => {
  const seed = await seedCanonical();
  const first = await createCompany(seed.stranger.id, { name: "첫번째업체" });
  const second = await createCompany(seed.stranger.id, { name: "두번째업체" });
  expect(first.id).toBeTruthy();
  expect(second.id).toBeTruthy();
  expect(second.id).not.toBe(first.id);
});

/** T-21 — 입력 시각은 KST 로 해석한다 (5.1) */
test("T-21 일정 입력 시각은 서버 타임존과 무관하게 Asia/Seoul 로 해석된다", async () => {
  const seed = await seedCanonical();
  await createSchedule(seed.staffA, {
    projectId: seed.projectA1.id,
    type: "visit",
    title: "타임존 검증",
    startAt: "2026-09-13T10:00",
  });
  const rows = await listSchedules(seed.staffA, seed.projectA1.id);
  const row = rows.find((r) => r.title === "타임존 검증");
  expect(row).toBeTruthy();
  expect(formatSeoul(row!.startAt)).toBe("2026-09-13 10:00");
  expect(row!.startAt.toISOString()).toBe("2026-09-13T01:00:00.000Z");
});

/** T-22 — 같은 시각의 감사 로그가 커서 페이지네이션에서 누락되지 않는다 (16.2) */
test("T-22 한 트랜잭션의 감사 로그 5건이 커서 순회에서 전부 나온다", async () => {
  const seed = await seedCanonical();
  const marker = `cursor-${randomUUID()}`;
  await db.transaction(async (tx) => {
    for (let i = 0; i < 5; i += 1) {
      await recordAudit(
        {
          action: "visibility_change",
          targetType: marker,
          targetId: seed.projectA1.id,
          projectId: seed.projectA1.id,
          after: { seq: i },
        },
        seed.staffA,
        tx,
      );
    }
  });

  const seen = new Set<string>();
  let cursor: string | null | undefined = undefined;
  for (let page = 0; page < 10; page += 1) {
    const result = await listAuditLogs(seed.staffA, {
      limit: 2,
      cursor: cursor ?? undefined,
      projectId: seed.projectA1.id,
    });
    for (const row of result.items) {
      if (row.log.targetType === marker) seen.add(row.log.id);
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  expect(seen.size).toBe(5);
});

test("커서는 마이크로초까지 보존한다", () => {
  // timestamptz 는 µs 까지 저장한다. JS Date 로 왕복하면 절삭되어 행을 잃는다.
  const c = { createdAtRaw: "2026-09-13T01:23:45.678159Z", id: randomUUID() };
  const back = decodeCursor(encodeCursor(c));
  expect(back?.id).toBe(c.id);
  expect(back?.createdAtRaw).toBe("2026-09-13T01:23:45.678159Z");
  expect(decodeCursor("깨진커서")).toBeNull();
});

/** T-23 — 고객 댓글 수정 (문서② 4.5) */
test("T-23 고객은 요청·댓글 원문을 수정할 수 없고 확정 지시도 수정할 수 없다", async () => {
  const seed = await seedCanonical();
  // custA 는 시드가 이미 A1 접근을 갖고 있다(부록: seedCanonical).
  await insertProjectAccess(seed.staffA, {
    companyId: seed.companyA.id,
    projectId: seed.projectA1.id,
    userId: seed.stranger.id,
    grantedBy: seed.adminA.id,
  });
  await insertVerification(seed.staffA, {
    companyId: seed.companyA.id,
    projectId: seed.projectA1.id,
    userId: seed.custA.id,
    codeVersion: 0,
  });

  const mine = await loadProjectAccess(seed.custA.id, seed.projectA1.id);
  const other = await loadProjectAccess(seed.stranger.id, seed.projectA1.id);

  // 1) 본인 일반 댓글 → 원문 불변 (2차). 정정은 customer_requests 도메인.
  const normal = await createComment(mine, {
    projectId: seed.projectA1.id,
    body: "원래 내용",
  });
  await expect(editComment(mine, normal.id, "고친 내용")).rejects.toBeInstanceOf(
    ForbiddenError,
  );

  // 2) 타인 댓글 → 거부
  await expect(editComment(other, normal.id, "남의 글")).rejects.toBeInstanceOf(
    ForbiddenError,
  );

  // 3) 확정 지시 → 본인도 수정 불가
  const binding = await createComment(mine, {
    projectId: seed.projectA1.id,
    body: "이대로 진행해 주세요",
    binding: true,
  });
  await expect(editComment(mine, binding.id, "취소")).rejects.toBeInstanceOf(
    ForbiddenError,
  );

  // 확정 지시는 본문을 감사에 남긴다 (12.1)
  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.actionType, "binding_comment"));
  expect(
    logs.some(
      (row) =>
        row.targetId === binding.id &&
        (row.after as { body?: string } | null)?.body === "이대로 진행해 주세요",
    ),
  ).toBe(true);
});

/** 감사 로그 행위자 라벨이 실제 역할로 남는다 (12.1) */
test("감사 로그 actor_label 은 staff 가 아니라 실제 역할이다", async () => {
  const seed = await seedCanonical();
  const marker = `label-${randomUUID()}`;
  await recordAudit(
    { action: "project_update", targetType: marker, targetId: seed.projectA1.id },
    seed.pmACtx,
  );
  await recordAudit(
    { action: "project_update", targetType: marker, targetId: seed.projectA1.id },
    seed.staffA,
  );
  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.targetType, marker));
  const labels = rows.map((r) => r.actorLabel).sort();
  expect(labels).toEqual(["company_admin", "project_manager"]);
});

/** listAccessForUser 는 system 컨텍스트 전용이다 (AGENTS.md 2) */
test("포털 목록 조회는 staff 컨텍스트로 부를 수 없다", async () => {
  const seed = await seedCanonical();
  const { listAccessForUser } = await import("@/modules/access/repo");
  await expect(listAccessForUser(seed.staffA, seed.custA.id)).rejects.toBeTruthy();
  await expect(
    listAccessForUser(systemJob("test"), seed.custA.id),
  ).resolves.toBeInstanceOf(Array);
});

/** 타 업체 컨텍스트로 참여자 목록을 요청하면 경계 위반이다 */
test("업체 범위를 명시하는 조회는 타 업체를 거부한다", async () => {
  const seed = await seedCanonical();
  const { listCompanyMembersFor } = await import("@/modules/membership/repo");
  await expect(
    listCompanyMembersFor(seed.staffA, seed.companyB.id),
  ).rejects.toBeInstanceOf(TenantViolationError);
  await expect(
    listCompanyMembersFor(seed.staffA, seed.companyA.id),
  ).resolves.toBeInstanceOf(Array);
});

/**
 * 9.4 낙관적 동시성 — 새 프로젝트의 홈이 실제로 저장되는지.
 * 예전에는 pages.updated_at(µs)을 JS Date(ms)로 왕복해 비교가 영원히 실패했고,
 * 그 결과 홈 편집기의 저장이 항상 "다른 사람이 먼저 저장했습니다"로 끝났다.
 * 이 경로를 덮는 테스트가 없어 드러나지 않았다.
 */
test("홈 블록 저장은 성공하고, 오래된 토큰으로는 충돌한다", async () => {
  const seed = await seedCanonical();
  const { loadEditorState, saveHomeBlocks } = await import(
    "@/modules/page-builder/service"
  );
  const state = await loadEditorState(seed.staffA, seed.projectA1.id);
  const blockId = randomUUID();

  const saved = await saveHomeBlocks(seed.staffA, {
    projectId: seed.projectA1.id,
    pageUpdatedAt: state.page.token,
    blocks: [
      {
        id: blockId,
        blockType: "text",
        layout: { x: 0, y: 0, w: 12, h: 3 },
        style: {},
        content: { html: "<p>안내</p>", align: "left" },
        visibilityStatus: "draft",
        isNew: true,
      },
    ],
  });
  expect(saved?.token).toBeTruthy();
  expect(saved?.token).not.toBe(state.page.token);

  const after = await loadEditorState(seed.staffA, seed.projectA1.id);
  expect(after.blocks.some((b) => b.id === blockId)).toBe(true);

  // 오래된 토큰으로 다시 저장하면 충돌한다
  const { ConflictError } = await import("@/lib/errors");
  await expect(
    saveHomeBlocks(seed.staffA, {
      projectId: seed.projectA1.id,
      pageUpdatedAt: state.page.token,
      blocks: [],
    }),
  ).rejects.toBeInstanceOf(ConflictError);
});

/** I2 — 블록을 scheduled 로 두면서 공개 시각을 비우면 저장 전에 막힌다 */
test("공개 예약 블록에 공개 시각이 없으면 저장이 거부된다", async () => {
  const seed = await seedCanonical();
  const { loadEditorState, saveHomeBlocks } = await import(
    "@/modules/page-builder/service"
  );
  const state = await loadEditorState(seed.staffA, seed.projectA2.id);
  await expect(
    saveHomeBlocks(seed.staffA, {
      projectId: seed.projectA2.id,
      pageUpdatedAt: state.page.token,
      blocks: [
        {
          id: randomUUID(),
          blockType: "text",
          layout: { x: 0, y: 0, w: 12, h: 3 },
          style: {},
          content: { html: "<p>예약</p>", align: "left" },
          visibilityStatus: "scheduled",
          publishAt: null,
          isNew: true,
        },
      ],
    }),
  ).rejects.toBeInstanceOf(ForbiddenError);
});
