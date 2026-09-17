import { randomUUID } from "node:crypto";
import * as cheerio from "cheerio";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { DomainError, ForbiddenError, NotFoundError, VerificationRequiredError } from "@/lib/errors";
import { messages } from "@/lib/messages";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { staffPolicy } from "@/modules/membership/policy";
import { recordAudit } from "@/modules/audit";
import { requireFeature } from "@/modules/billing/gate";
import { assertStaffOwnsProject } from "@/lib/authz";
import { assertPublicHttpUrl } from "@/lib/ssrf";
import { getStorageAdapter } from "@/lib/storage";
import { extForMime, sniffMime } from "@/lib/storage/magic";
import {
  assertVisibilityTransition,
  type Visibility,
} from "@/lib/visibility";
import {
  findMaterialById,
  insertMaterial,
  insertMaterialHistory,
  listDueScheduledMaterials,
  updateMaterialRow,
} from "@/modules/material/repo";
import { insertStorageObject } from "@/modules/storage-quota/repo";
import { emit } from "@/lib/notify";

const PURCHASE = [
  "quote",
  "ordered",
  "shipped",
  "installed",
  "completed",
] as const;
type Purchase = (typeof PURCHASE)[number];

function assertEditor(ctx: DataContext) {
  if (ctx.kind === "system") return;
  if (!isStaff(ctx) || !staffPolicy.editProjectContent(ctx.roles)) {
    throw new ForbiddenError();
  }
}

export const createMaterialInput = z.object({
  projectId: z.string().uuid(),
  spaceCategory: z.enum([
    "living_room",
    "kitchen",
    "bathroom",
    "bedroom",
    "lighting",
    "furniture",
    "appliance",
  ]),
  name: z.string().trim().min(1).max(200),
  brand: z.string().max(100).optional(),
  spec: z.string().max(200).optional(),
  color: z.string().max(50).optional(),
  applyLocation: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  imageObjectId: z.string().uuid().optional(),
  externalUrl: z.string().url().optional(),
});

export async function createMaterial(
  ctx: DataContext,
  raw: z.infer<typeof createMaterialInput>,
) {
  assertEditor(ctx);
  if (!isStaff(ctx)) throw new ForbiddenError();
  const input = createMaterialInput.parse(raw);
  let preview: Awaited<ReturnType<typeof fetchLinkPreview>> | null = null;
  if (input.externalUrl) {
    await assertPublicHttpUrl(input.externalUrl);
    try {
      preview = await fetchLinkPreview(ctx, input.projectId, input.externalUrl);
    } catch {
      preview = null;
    }
  }
  return insertMaterial(ctx, {
    companyId: ctx.companyId,
    projectId: input.projectId,
    spaceCategory: input.spaceCategory,
    name: input.name,
    brand: input.brand || null,
    spec: input.spec || null,
    color: input.color || null,
    applyLocation: input.applyLocation || null,
    description: input.description || null,
    imageObjectId: input.imageObjectId,
    externalUrl: input.externalUrl,
    linkTitle: preview?.title,
    linkSiteName: preview?.siteName,
    linkImageObjectId: preview?.imageObjectId,
    linkFetchedAt: preview ? new Date() : null,
    createdBy: ctx.userId,
    visibilityStatus: "draft",
  });
}

export async function changeMaterialVisibility(
  ctx: DataContext,
  id: string,
  to: Visibility,
  publishAt?: Date,
) {
  assertEditor(ctx);
  const row = await findMaterialById(ctx, id);
  if (!row) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  assertVisibilityTransition(row.visibilityStatus, to);
  if (to === "scheduled" && !publishAt) throw new ForbiddenError();
  const updated = await db.transaction(async (tx) => {
    const next = await updateMaterialRow(
      ctx,
      id,
      { visibilityStatus: to, publishAt: to === "scheduled" ? publishAt : null },
      tx,
    );
    await recordAudit(
      {
        action: "visibility_change",
        targetType: "material",
        targetId: id,
        projectId: row.projectId,
        before: { visibilityStatus: row.visibilityStatus },
        after: { visibilityStatus: to },
      },
      ctx,
      tx,
    );
    return next;
  });
  if (to === "published" && row.approvalStatus === "pending") {
    await emit("material.approval_requested", {
      companyId: row.companyId,
      projectId: row.projectId,
      targetId: id,
      actorUserId: "userId" in ctx ? ctx.userId : undefined,
    });
  }
  return updated;
}

export async function setMaterialApproval(
  ctx: DataContext,
  id: string,
  status: "approved" | "rejected",
) {
  if (ctx.kind !== "customer") throw new ForbiddenError();
  if (!ctx.verified) throw new VerificationRequiredError();
  await requireFeature(ctx.companyId, "approval_workflow");
  const row = await findMaterialById(ctx, id);
  if (!row || row.visibilityStatus !== "published") throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  const updated = await db.transaction(async (tx) => {
    const next = await updateMaterialRow(
      ctx,
      id,
      {
        approvalStatus: status,
        approvedBy: ctx.userId,
        approvedAt: new Date(),
      },
      tx,
    );
    await recordAudit(
      {
        action: "approval",
        targetType: "material",
        targetId: id,
        projectId: row.projectId,
        before: { approvalStatus: row.approvalStatus },
        after: { approvalStatus: status },
      },
      ctx,
      tx,
    );
    return next;
  });
  if (status === "approved") {
    await emit("material.approved", {
      companyId: row.companyId,
      projectId: row.projectId,
      targetId: id,
      actorUserId: ctx.userId,
    });
  }
  return updated;
}

export async function publishDueMaterials(ctx: DataContext, now: Date) {
  if (ctx.kind !== "system") throw new ForbiddenError();
  const rows = await listDueScheduledMaterials(ctx, now);
  for (const row of rows) {
    await changeMaterialVisibility(ctx, row.id, "published");
  }
  return rows.length;
}

export async function changePurchaseStatus(
  ctx: DataContext,
  id: string,
  to: Purchase,
  note?: string,
) {
  assertEditor(ctx);
  if (!isStaff(ctx)) throw new ForbiddenError();
  await requireFeature(ctx.companyId, "purchase_tracking");
  const row = await findMaterialById(ctx, id);
  if (!row) throw new NotFoundError();
  await assertStaffOwnsProject(ctx, row.projectId);
  const fromIdx = PURCHASE.indexOf(row.purchaseStatus);
  const toIdx = PURCHASE.indexOf(to);
  if (toIdx < fromIdx && !note?.trim()) {
    throw new ForbiddenError(messages.revertNoteRequired);
  }
  if (toIdx > fromIdx && toIdx !== fromIdx + 1) {
    throw new ForbiddenError();
  }
  return db.transaction(async (tx) => {
    const updated = await updateMaterialRow(ctx, id, { purchaseStatus: to }, tx);
    await insertMaterialHistory(
      ctx,
      {
        companyId: ctx.companyId,
        materialId: id,
        fromStatus: row.purchaseStatus,
        toStatus: to,
        note: note || null,
        changedBy: ctx.userId,
      },
      tx,
    );
    return updated;
  });
}

const PREVIEW_MAX = 1_000_000;

export async function fetchLinkPreview(
  ctx: DataContext,
  projectId: string,
  rawUrl: string,
) {
  assertEditor(ctx);
  if (!isStaff(ctx)) throw new ForbiddenError();
  const first = await assertPublicHttpUrl(rawUrl);
  const htmlRes = await followPublic(first, 3);
  const html = await readLimited(htmlRes, PREVIEW_MAX);
  const $ = cheerio.load(html.toString("utf8"));
  const title =
    $('meta[property="og:title"]').attr("content") || $("title").text() || null;
  const siteName =
    $('meta[property="og:site_name"]').attr("content") || first.hostname;
  const imageUrl = $('meta[property="og:image"]').attr("content");
  let imageObjectId: string | undefined;
  if (imageUrl) {
    try {
      imageObjectId = await copyRemoteImage(ctx, projectId, imageUrl);
    } catch {
      imageObjectId = undefined;
    }
  }
  return {
    title: title?.slice(0, 300) ?? null,
    siteName: siteName?.slice(0, 100) ?? first.hostname,
    imageObjectId,
    domain: first.hostname,
  };
}

async function followPublic(start: URL, remaining: number): Promise<Response> {
  const url = await assertPublicHttpUrl(start.toString());
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
    headers: { "User-Agent": "interior-supporter-preview" },
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc || remaining <= 0) {
      throw new ForbiddenError(messages.linkPreviewDenied);
    }
    return followPublic(new URL(loc, url), remaining - 1);
  }
  if (!res.ok) throw new ForbiddenError(messages.linkPreviewDenied);
  return res;
}

async function readLimited(res: Response, max: number) {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) {
      await reader.cancel();
      throw new ForbiddenError(messages.linkPreviewDenied);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function copyRemoteImage(
  ctx: Extract<DataContext, { kind: "staff" }>,
  projectId: string,
  rawUrl: string,
) {
  const res = await followPublic(new URL(rawUrl), 3);
  const body = await readLimited(res, PREVIEW_MAX);
  const sniffed = sniffMime(body);
  if (!sniffed || !sniffed.startsWith("image/")) {
    throw new DomainError("invalid_file", messages.fileRejected, 400);
  }
  const id = randomUUID();
  const objectKey = `${ctx.companyId}/_link/${id}.${extForMime(sniffed)}`;
  await getStorageAdapter().put(objectKey, body, sniffed);
  const row = await insertStorageObject(ctx, {
    id,
    companyId: ctx.companyId,
    projectId,
    objectKey,
    category: "link",
    mimeType: sniffed,
    byteSize: body.byteLength,
    status: "ready",
    uploadedBy: ctx.userId,
  });
  return row.id;
}
