import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { db, type DbTx } from "@/lib/db/client";
import { DomainError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { messages } from "@/lib/messages";
import { isStaff, isFieldOnly, type DataContext } from "@/lib/tenancy/context";
import { seoulYearMonth } from "@/lib/datetime";
import { getStorageAdapter, isLocalStorage } from "@/lib/storage";
import { ALLOWED_MIMES, extForMime, isCadMime, sniffMime } from "@/lib/storage/magic";
import { getPlatformSetting, updateCompany } from "@/modules/company/repo";
import { recordAudit } from "@/modules/audit";
import { requireLimit } from "@/modules/billing/gate";
import { assertFieldAssigned, assertStaffOwnsProject } from "@/lib/authz";
import { logger } from "@/lib/logger";
import {
  findStorageObjectAccess,
  findStorageObjectById,
  insertStorageObject,
  sumReadyBytes,
  updateStorageObject,
} from "@/modules/storage-quota/repo";

const signInput = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/x-dwg",
    "application/x-sketchup",
  ]),
  contentLength: z.number().int().positive(),
  category: z.enum(["design", "photo", "material", "brand", "link"]),
  projectId: z.string().uuid().optional(),
});

function settingNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return null;
}

async function maxBytes(mime: string) {
  const key = mime.startsWith("image/") ? "max_image_mb" : "max_pdf_mb";
  const mb = settingNumber(await getPlatformSetting(key));
  if (!mb || Number.isNaN(mb)) {
    throw new Error(`platform_settings.${key} 가 없습니다.`);
  }
  return mb * 1024 * 1024;
}

/** plan gate 의 storage_mb 판정용 (13.1 · 10.6) */
async function currentUsedMb(ctx: DataContext) {
  const bytes = await sumReadyBytes(ctx);
  return Math.ceil(bytes / (1024 * 1024));
}

async function recalcStorage(ctx: DataContext, tx: typeof db | DbTx = db) {
  const bytes = await sumReadyBytes(ctx, tx);
  await updateCompany(ctx, { storageUsedMb: Math.ceil(bytes / (1024 * 1024)) }, tx);
}

export async function signUpload(ctx: DataContext, raw: z.infer<typeof signInput>) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = signInput.parse(raw);
  if (input.category !== "brand" && !input.projectId) throw new ForbiddenError();
  if (input.projectId) {
    if (isFieldOnly(ctx.roles)) {
      if (input.category !== "photo") throw new ForbiddenError();
      await assertFieldAssigned(ctx, input.projectId);
    } else {
      await assertStaffOwnsProject(ctx, input.projectId);
    }
  }
  // 13.1 plan gate — 유료화 전에는 항상 통과한다(10.6: 집계만 한다).
  await requireLimit(ctx.companyId, "storage_mb", await currentUsedMb(ctx));
  const limit = await maxBytes(input.contentType);
  if (input.contentLength > limit) {
    throw new DomainError("file_too_large", messages.fileTooLarge, 400);
  }
  const id = randomUUID();
  const ext = extForMime(input.contentType);
  const objectKey =
    input.category === "brand"
      ? `${ctx.companyId}/_brand/${id}.${ext}`
      : input.category === "link"
        ? `${ctx.companyId}/_link/${id}.${ext}`
        : `${ctx.companyId}/${input.projectId}/${input.category}/${seoulYearMonth()}/${id}.${ext}`;
  const row = await insertStorageObject(ctx, {
    id,
    companyId: ctx.companyId,
    projectId: input.projectId,
    objectKey,
    category: input.category,
    originalFilename: input.filename,
    mimeType: input.contentType,
    byteSize: input.contentLength,
    status: "pending",
    uploadedBy: ctx.userId,
  });
  const signed = await getStorageAdapter().signUpload({
    objectKey,
    contentType: input.contentType,
    contentLength: input.contentLength,
  });
  const url = isLocalStorage()
    ? `/api/uploads/local/${row.id}`
    : signed.url;
  return {
    objectId: row.id,
    url,
    headers: signed.headers,
    expiresAt: signed.expiresAt,
  };
}

/**
 * 매직바이트 검증에 필요한 건 앞쪽 몇 바이트뿐이다.
 * 50MB PDF 를 통째로 메모리에 올리면 서버리스 함수 한도를 압박한다 (14.2).
 */
async function readHead(
  stream: ReadableStream<Uint8Array>,
  max = 4096,
): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < max) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return Buffer.concat(chunks).subarray(0, max);
}

export async function completeUpload(ctx: DataContext, objectId: string) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  const row = await findStorageObjectById(ctx, objectId);
  if (!row) throw new NotFoundError();
  if (isFieldOnly(ctx.roles)) {
    if (row.category !== "photo" || !row.projectId) throw new ForbiddenError();
    await assertFieldAssigned(ctx, row.projectId);
  } else {
    await assertStaffOwnsProject(ctx, row.projectId);
  }
  const storage = getStorageAdapter();
  const head = await storage.head(row.objectKey);
  if (!head.exists) throw new NotFoundError();
  const headBytes = await readHead(await storage.get(row.objectKey));
  const sniffed = sniffMime(headBytes, row.originalFilename ?? "");
  if (!sniffed || sniffed !== row.mimeType) {
    await db.transaction(async (tx) => {
      await updateStorageObject(
        ctx,
        objectId,
        { status: "quarantined", deletedAt: new Date() },
        tx,
      );
      await recordAudit(
        {
          action: "file_upload",
          targetType: "storage_object",
          targetId: objectId,
          projectId: row.projectId ?? undefined,
          after: { status: "quarantined" },
        },
        ctx,
        tx,
      );
    });
    await storage.delete(row.objectKey);
    logger.warn("file.quarantined", { objectId, declared: row.mimeType });
    throw new DomainError("invalid_file", messages.fileRejected, 400);
  }
  let thumbKey: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  if (sniffed.startsWith("image/") && !isCadMime(sniffed)) {
    // 썸네일을 만들 때만 전체를 읽는다. 이미지 상한은 20MB 다 (10.4).
    const full = Buffer.from(
      await new Response(await storage.get(row.objectKey)).arrayBuffer(),
    );
    // 디코딩 폭탄 방어
    const image = sharp(full, { limitInputPixels: 100_000_000 });
    const meta = await image.metadata();
    width = meta.width;
    height = meta.height;
    const thumb = await image
      .rotate()
      .resize({ width: 600, height: 600, fit: "inside", withoutEnlargement: true })
      .webp()
      .toBuffer();
    thumbKey = row.objectKey.replace(/\.[^.]+$/, "_thumb.webp");
    await storage.put(thumbKey, thumb, "image/webp");
    const display = await sharp(full, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    const displayKey = row.objectKey.replace(/\.[^.]+$/, "_display.webp");
    await storage.put(displayKey, display, "image/webp");
    await insertStorageObject(ctx, {
      companyId: ctx.companyId,
      projectId: row.projectId,
      objectKey: displayKey,
      derivativeOfId: objectId,
      category: row.category,
      originalFilename: row.originalFilename,
      mimeType: "image/webp",
      byteSize: display.byteLength,
      status: "ready",
      uploadedBy: ctx.userId,
    });
  }
  return db.transaction(async (tx) => {
    const updated = await updateStorageObject(
      ctx,
      objectId,
      {
        status: "ready",
        byteSize: head.contentLength || row.byteSize,
        thumbKey,
        width,
        height,
      },
      tx,
    );
    await recalcStorage(ctx, tx);
    await recordAudit(
      {
        action: "file_upload",
        targetType: "storage_object",
        targetId: objectId,
        projectId: row.projectId ?? undefined,
        after: { status: "ready", byteSize: head.contentLength },
      },
      ctx,
      tx,
    );
    return updated;
  });
}

export async function putLocalObject(
  ctx: DataContext,
  objectId: string,
  body: Uint8Array,
  contentType: string,
) {
  if (!isStaff(ctx)) throw new ForbiddenError();
  const row = await findStorageObjectById(ctx, objectId);
  if (!row || row.status !== "pending") throw new NotFoundError();
  if (isFieldOnly(ctx.roles)) {
    if (row.category !== "photo" || !row.projectId) throw new ForbiddenError();
    await assertFieldAssigned(ctx, row.projectId);
  } else {
    await assertStaffOwnsProject(ctx, row.projectId);
  }
  if (!ALLOWED_MIMES.includes(contentType as (typeof ALLOWED_MIMES)[number])) {
    throw new DomainError("invalid_file", messages.fileTypeDenied, 400);
  }
  await getStorageAdapter().put(row.objectKey, body, contentType);
}

export async function streamFile(userId: string, objectId: string, variant: "thumb" | "full") {
  const access = await findStorageObjectAccess(userId, objectId);
  if (!access || access.kind === "none") throw new ForbiddenError();
  if (access.kind === "customer" && !access.published) throw new ForbiddenError();
  const object = access.object;
  if (object.status !== "ready" && access.kind === "customer") throw new ForbiddenError();
  const key =
    variant === "thumb" && object.thumbKey ? object.thumbKey : object.objectKey;
  const stream = await getStorageAdapter().get(key);
  const mime =
    variant === "thumb" && object.thumbKey ? "image/webp" : object.mimeType;
  return { stream, mime };
}
