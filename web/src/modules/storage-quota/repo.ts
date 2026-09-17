import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, type DbTx } from "@/lib/db/client";
import { storageObjects } from "@/modules/storage-quota/schema";
import { designVersions } from "@/modules/design/schema";
import { materials } from "@/modules/material/schema";
import { progressPhotos } from "@/modules/photo/schema";
import { companies } from "@/modules/company/schema";
import { memberships } from "@/modules/membership/schema";
import { projectAccess } from "@/modules/access/schema";
import { assertSameTenant, scoped, type DataContext } from "@/lib/tenancy/context";
import { TenantViolationError } from "@/lib/errors";

type Executor = typeof db | DbTx;

export async function insertStorageObject(
  ctx: DataContext,
  values: typeof storageObjects.$inferInsert,
  tx: Executor = db,
) {
  const [row] = await tx.insert(storageObjects).values(values).returning();
  if (!row) throw new Error("파일 메타 생성에 실패했습니다.");
  assertSameTenant(ctx, row);
  return row;
}

export async function findStorageObjectById(
  ctx: DataContext,
  id: string,
  tx: Executor = db,
) {
  const [row] = await tx
    .select()
    .from(storageObjects)
    .where(
      and(
        eq(storageObjects.id, id),
        scoped(ctx, storageObjects),
        isNull(storageObjects.deletedAt),
      ),
    )
    .limit(1);
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function listStorageObjectsByIds(ctx: DataContext, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(storageObjects)
    .where(
      and(
        scoped(ctx, storageObjects),
        inArray(storageObjects.id, ids),
        isNull(storageObjects.deletedAt),
      ),
    );
  for (const row of rows) assertSameTenant(ctx, row);
  return rows;
}

export async function updateStorageObject(
  ctx: DataContext,
  id: string,
  patch: Partial<typeof storageObjects.$inferInsert>,
  tx: Executor = db,
) {
  const [row] = await tx
    .update(storageObjects)
    .set(patch)
    .where(and(eq(storageObjects.id, id), scoped(ctx, storageObjects)))
    .returning();
  if (row) assertSameTenant(ctx, row);
  return row ?? null;
}

export async function sumReadyBytes(ctx: DataContext, tx: Executor = db) {
  const companyId =
    ctx.kind === "staff" || ctx.kind === "customer" ? ctx.companyId : "";
  return sumReadyBytesForCompany(ctx, companyId, tx);
}

export async function sumReadyBytesForCompany(
  ctx: DataContext,
  companyId: string,
  tx: Executor = db,
) {
  if ((ctx.kind === "staff" || ctx.kind === "customer") && ctx.companyId !== companyId) {
    throw new TenantViolationError();
  }
  const [row] = await tx
    .select({
      sum: sql<number>`coalesce(sum(${storageObjects.byteSize}), 0)`,
    })
    .from(storageObjects)
    .where(
      and(
        eq(storageObjects.companyId, companyId),
        eq(storageObjects.status, "ready"),
        isNull(storageObjects.deletedAt),
      ),
    );
  return Number(row?.sum ?? 0);
}

export async function findStorageObjectAccess(userId: string, objectId: string) {
  const [object] = await db
    .select()
    .from(storageObjects)
    .where(and(eq(storageObjects.id, objectId), isNull(storageObjects.deletedAt)))
    .limit(1);
  if (!object) return null;

  const staff = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.companyId, object.companyId),
        eq(memberships.isActive, true),
      ),
    )
    .limit(1);
  if (staff[0]) {
    return { object, kind: "staff" as const, published: true };
  }

  if (!object.projectId) return { object, kind: "none" as const, published: false };

  const [access] = await db
    .select({ id: projectAccess.id })
    .from(projectAccess)
    .where(
      and(
        eq(projectAccess.userId, userId),
        eq(projectAccess.projectId, object.projectId),
        eq(projectAccess.companyId, object.companyId),
        isNull(projectAccess.revokedAt),
      ),
    )
    .limit(1);
  if (!access) return { object, kind: "none" as const, published: false };

  const published = await isLinkedContentPublished(object);
  return { object, kind: "customer" as const, published };
}

async function isLinkedContentPublished(object: typeof storageObjects.$inferSelect) {
  const [design] = await db
    .select({ visibilityStatus: designVersions.visibilityStatus })
    .from(designVersions)
    .where(
      and(
        isNull(designVersions.deletedAt),
        eq(designVersions.companyId, object.companyId),
        or(
          eq(designVersions.storageObjectId, object.id),
          eq(designVersions.previewObjectId, object.id),
        ),
      ),
    )
    .limit(1);
  if (design) return design.visibilityStatus === "published";

  const [photo] = await db
    .select({ visibilityStatus: progressPhotos.visibilityStatus })
    .from(progressPhotos)
    .where(
      and(
        eq(progressPhotos.storageObjectId, object.id),
        eq(progressPhotos.companyId, object.companyId),
        isNull(progressPhotos.deletedAt),
      ),
    )
    .limit(1);
  if (photo) return photo.visibilityStatus === "published";

  const [material] = await db
    .select({ visibilityStatus: materials.visibilityStatus })
    .from(materials)
    .where(
      and(
        eq(materials.companyId, object.companyId),
        isNull(materials.deletedAt),
        or(
          eq(materials.imageObjectId, object.id),
          eq(materials.linkImageObjectId, object.id),
        ),
      ),
    )
    .limit(1);
  if (material) return material.visibilityStatus === "published";

  const [brand] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.brandLogoObjectId, object.id))
    .limit(1);
  return Boolean(brand);
}
