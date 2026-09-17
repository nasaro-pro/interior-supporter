import { and, asc, desc, eq } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { cursorCondition, cursorTs, decodeCursor, paginate } from "@/lib/cursor";
import { companies, platformSettings } from "@/modules/company/schema";
import { assertSameTenant, type DataContext } from "@/lib/tenancy/context";
import { TenantViolationError } from "@/lib/errors";

type Executor = typeof db | DbTx;

function asTenant(row: { id: string }) {
  return { companyId: row.id };
}

export async function getPlatformSetting(key: string) {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

/** plan gate 판정용 (13.1). 업체 경계와 무관한 요금제 등급 조회. */
export async function getPlanTier(companyId: string) {
  const [row] = await db
    .select({ planTier: companies.planTier })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  return row?.planTier ?? null;
}

export async function findCompanyBySlug(ctx: DataContext, slug: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  if (!row) return null;
  if (ctx.kind === "staff" || ctx.kind === "customer") {
    assertSameTenant(ctx, asTenant(row));
  }
  return row;
}

export async function slugTaken(slug: string) {
  const [row] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);
  return Boolean(row);
}

export async function insertCompany(
  ctx: DataContext,
  values: typeof companies.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(companies).values(values).returning();
  if (!row) throw new Error("업체 생성에 실패했습니다.");
  assertSameTenant(ctx, asTenant(row));
  return row;
}

export async function findCompanyById(ctx: DataContext, companyId: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!row) return null;
  assertSameTenant(ctx, asTenant(row));
  return row;
}

export async function updateCompany(
  ctx: DataContext,
  patch: {
    name?: string;
    brandColor?: string | null;
    brandLogoObjectId?: string | null;
    storageUsedMb?: number;
    status?: (typeof companies.$inferSelect)["status"];
  },
  tx: Executor = db,
) {
  const companyId = ctx.kind === "staff" || ctx.kind === "customer" ? ctx.companyId : "";
  return updateCompanyById(ctx, companyId, patch, tx);
}

export async function updateCompanyById(
  ctx: DataContext,
  companyId: string,
  patch: {
    name?: string;
    brandColor?: string | null;
    brandLogoObjectId?: string | null;
    storageUsedMb?: number;
    status?: (typeof companies.$inferSelect)["status"];
  },
  tx: Executor = db,
) {
  if ((ctx.kind === "staff" || ctx.kind === "customer") && ctx.companyId !== companyId) {
    throw new TenantViolationError();
  }
  const [row] = await tx
    .update(companies)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(companies.id, companyId))
    .returning();
  if (!row) return null;
  assertSameTenant(ctx, asTenant(row));
  return row;
}

export async function listCompanies(
  ctx: DataContext,
  filter: { cursor?: string; limit?: number; status?: string } = {},
) {
  if (ctx.kind !== "platform" && ctx.kind !== "system") return { items: [], nextCursor: null as string | null };
  const limit = filter.limit ?? 20;
  const rows = await db
    .select({ row: companies, cursorTs: cursorTs(companies.createdAt) })
    .from(companies)
    .where(
      and(
        cursorCondition(companies.createdAt, companies.id, decodeCursor(filter.cursor)),
        filter.status
          ? eq(companies.status, filter.status as (typeof companies.$inferSelect)["status"])
          : undefined,
      ),
    )
    .orderBy(desc(companies.createdAt), desc(companies.id))
    .limit(limit + 1);
  const page = paginate(rows, limit, (row) => ({
    createdAtRaw: row.cursorTs,
    id: row.row.id,
  }));
  return { items: page.items.map((r) => r.row), nextCursor: page.nextCursor };
}

export async function listCompanyIds(ctx: DataContext) {
  if (ctx.kind !== "system" && ctx.kind !== "platform") return [];
  const rows = await db.select({ id: companies.id }).from(companies);
  return rows.map((row) => row.id);
}

export async function listPlatformSettings(ctx: DataContext) {
  if (ctx.kind !== "platform") return [];
  return db.select().from(platformSettings).orderBy(asc(platformSettings.key));
}

export async function upsertPlatformSetting(
  ctx: DataContext,
  key: string,
  value: unknown,
  tx: Executor = db,
) {
  if (ctx.kind !== "platform") return null;
  const [row] = await tx
    .insert(platformSettings)
    .values({
      key,
      value,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value, updatedBy: ctx.userId, updatedAt: new Date() },
    })
    .returning();
  return row ?? null;
}
