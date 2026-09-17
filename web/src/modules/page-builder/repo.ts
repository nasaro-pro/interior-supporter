import { db, type DbTx } from "@/lib/db/client";
import { blocks, pages, templates } from "@/modules/page-builder/schema";
import {
  assertSameProject,
  assertSameTenant,
  projectScoped,
  scoped,
  type DataContext,
} from "@/lib/tenancy/context";
import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { cursorTs } from "@/lib/cursor";

type Executor = typeof db | DbTx;

export async function insertPage(
  ctx: DataContext,
  values: typeof pages.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx
    .insert(pages)
    .values(values)
    .returning({
      id: pages.id,
      companyId: pages.companyId,
      projectId: pages.projectId,
      title: pages.title,
      updatedAt: pages.updatedAt,
      token: cursorTs(pages.updatedAt),
    });
  if (!row) throw new Error("페이지 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function findPageByProject(ctx: DataContext, projectId: string) {
  const [row] = await db
    .select({
      id: pages.id,
      companyId: pages.companyId,
      projectId: pages.projectId,
      title: pages.title,
      updatedAt: pages.updatedAt,
      // 낙관적 동시성 토큰. timestamptz 는 µs 까지 저장하는데 JS Date 는 ms 까지만
      // 담으므로, Date 로 왕복하면 비교가 영원히 실패한다(= 항상 충돌).
      token: cursorTs(pages.updatedAt),
    })
    .from(pages)
    .where(
      and(
        scoped(ctx, pages),
        projectScoped(ctx, pages),
        eq(pages.projectId, projectId),
      ),
    )
    .limit(1);
  if (row) {
    assertSameTenant(ctx, row);
    assertSameProject(ctx, row);
  }
  return row ?? null;
}

/**
 * 9.4 낙관적 동시성 — pages.updated_at 을 버전 토큰으로 쓴다.
 * 토큰은 DB 가 만든 마이크로초 문자열이며, 비교는 ::timestamptz 로 되돌려서 한다.
 */
export async function touchPage(
  ctx: DataContext,
  pageId: string,
  expectedToken: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(pages)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(pages.id, pageId),
        sql`${pages.updatedAt} = ${expectedToken}::timestamptz`,
        scoped(ctx, pages),
      ),
    )
    .returning({
      id: pages.id,
      companyId: pages.companyId,
      projectId: pages.projectId,
      updatedAt: pages.updatedAt,
      token: cursorTs(pages.updatedAt),
    });
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function listBlocks(
  ctx: DataContext,
  pageId: string,
  opts?: { publishedOnly?: boolean },
) {
  const rows = await db
    .select()
    .from(blocks)
    .where(
      and(
        scoped(ctx, blocks),
        eq(blocks.pageId, pageId),
        isNull(blocks.deletedAt),
        opts?.publishedOnly ? eq(blocks.visibilityStatus, "published") : undefined,
      ),
    )
    .orderBy(asc(blocks.orderIndex), asc(blocks.createdAt));
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function insertBlock(
  ctx: DataContext,
  values: typeof blocks.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(blocks).values(values).returning();
  if (!row) throw new Error("블록 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function updateBlockRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof blocks.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(blocks)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(blocks.id, id), scoped(ctx, blocks)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function listDueScheduledBlocks(ctx: DataContext, now: Date) {
  const rows = await db
    .select()
    .from(blocks)
    .where(
      and(
        scoped(ctx, blocks),
        eq(blocks.visibilityStatus, "scheduled"),
        lte(blocks.publishAt, now),
        isNull(blocks.deletedAt),
      ),
    );
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function insertTemplate(
  ctx: DataContext,
  values: typeof templates.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(templates).values(values).returning();
  if (!row) throw new Error("템플릿 생성에 실패했습니다.");
  if (row.companyId) assertSameTenant(ctx, row);
  return row;
}

/**
 * 스코프 조건을 쿼리에 넣는다 (AGENTS.md 2).
 * 사후 assertSameTenant 에만 의존하면, 타 업체 id 를 넣은 평범한 오조작까지
 * TenantViolationError(= 17.3 즉시 알람)를 유발해 알람이 무의미해진다.
 * platform scope 템플릿(company_id IS NULL)은 모든 업체에 읽기 전용으로 보인다.
 */
export async function findTemplateById(ctx: DataContext, id: string) {
  const visible =
    ctx.kind === "staff" || ctx.kind === "customer"
      ? or(eq(templates.companyId, ctx.companyId), isNull(templates.companyId))
      : undefined;
  const [row] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), visible))
    .limit(1);
  if (!row) return null;
  if (row.scope === "platform") return row;
  if (row.companyId) assertSameTenant(ctx, row);
  return row;
}

export async function updateTemplateRow(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof templates.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(templates)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(templates.id, id), scoped(ctx, templates)))
    .returning();
  if (row?.companyId) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function listUsableTemplates(ctx: DataContext, projectId: string) {
  const rows = await db
    .select()
    .from(templates)
    .where(
      or(
        and(eq(templates.scope, "project"), eq(templates.projectId, projectId), scoped(ctx, templates)),
        and(eq(templates.scope, "company"), scoped(ctx, templates)),
        eq(templates.scope, "platform"),
      ),
    )
    .orderBy(desc(templates.createdAt));
  return rows.filter((row) => {
    if (row.scope === "platform") return true;
    if (row.companyId) assertSameTenant(ctx, row);
    return true;
  });
}

export async function listCompanyTemplates(ctx: DataContext) {
  const rows = await db
    .select()
    .from(templates)
    .where(scoped(ctx, templates))
    .orderBy(desc(templates.createdAt));
  for (const row of rows) {
    if (row.companyId) assertSameTenant(ctx, row);
  }
  return rows;
}

export async function listPromotionQueue(ctx: DataContext) {
  const rows = await db
    .select()
    .from(templates)
    .where(
      and(
        scoped(ctx, templates),
        eq(templates.promotionStatus, "requested"),
      ),
    )
    .orderBy(desc(templates.updatedAt));
  for (const row of rows) {
    if (row.companyId) assertSameTenant(ctx, row);
  }
  return rows;
}

export async function listPlatformTemplates(ctx: DataContext) {
  if (ctx.kind !== "platform") return [];
  return db
    .select()
    .from(templates)
    .where(eq(templates.scope, "platform"))
    .orderBy(desc(templates.createdAt));
}
