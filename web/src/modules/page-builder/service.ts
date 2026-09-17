import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff, type DataContext } from "@/lib/tenancy/context";
import { recordAudit } from "@/modules/audit";
import { requireFeature } from "@/modules/billing/gate";
import { emit } from "@/lib/notify";
import { assertVisibilityTransition, type Visibility } from "@/lib/visibility";
import { listDesignsByIds } from "@/modules/design/repo";
import { listMaterialsByIds } from "@/modules/material/repo";
import { listPhotosByPairGroupIds, listPhotosByProject } from "@/modules/photo/repo";
import { listSchedules } from "@/modules/schedule/repo";
import { listComments } from "@/modules/comment/repo";
import {
  findPageByProject,
  insertPage,
  touchPage,
  listBlocks,
  insertBlock,
  updateBlockRow,
  listDueScheduledBlocks,
  insertTemplate,
  findTemplateById,
  updateTemplateRow,
  listUsableTemplates,
} from "@/modules/page-builder/repo";
import {
  blockContentSchemas,
  emptyContent,
  layoutSchema,
  parseBlockContent,
  type BlockType,
} from "@/modules/page-builder/blocks/schemas";
import { pageBuilderPolicy } from "@/modules/page-builder/policy";
import { messages } from "@/lib/messages";
import { parseSeoulInputOptional } from "@/lib/datetime";

const visibilitySchema = z.enum(["draft", "review", "scheduled", "published"]);

const saveBlockSchema = z.object({
  id: z.string().uuid(),
  blockType: z.enum([
    "text",
    "gallery",
    "before_after",
    "design_file",
    "material_card",
    "schedule",
    "comment",
    "process",
    "button",
    "divider",
  ]),
  layout: layoutSchema,
  style: z.record(z.string(), z.unknown()).default({}),
  content: z.unknown(),
  visibilityStatus: visibilitySchema,
  publishAt: z.string().nullable().optional(),
  deleted: z.boolean().optional(),
  isNew: z.boolean().optional(),
});

export const saveHomeInput = z.object({
  projectId: z.string().uuid(),
  pageUpdatedAt: z.string(),
  blocks: z.array(saveBlockSchema),
});

function sanitizeTextHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "u", "h1", "h2", "h3", "ul", "ol", "li", "a", "span"],
    allowedAttributes: { a: ["href", "rel", "target"], span: ["class"] },
  });
}

function assertCanEdit(
  ctx: DataContext,
): asserts ctx is Extract<DataContext, { kind: "staff" }> {
  if (!isStaff(ctx) || !pageBuilderPolicy.editHome(ctx.roles)) {
    throw new ForbiddenError();
  }
}

export async function publishDueBlocks(ctx: DataContext, now: Date) {
  if (ctx.kind !== "system") throw new ForbiddenError();
  const rows = await listDueScheduledBlocks(ctx, now);
  for (const row of rows) {
    await db.transaction(async (tx) => {
      await updateBlockRow(
        ctx,
        row.id,
        { visibilityStatus: "published", publishAt: null },
        tx,
      );
      await recordAudit(
        {
          action: "visibility_change",
          targetType: "block",
          targetId: row.id,
          before: { visibilityStatus: row.visibilityStatus },
          after: { visibilityStatus: "published" },
        },
        ctx,
        tx,
      );
    });
  }
  return rows.length;
}

export async function ensurePage(ctx: DataContext, projectId: string) {
  const existing = await findPageByProject(ctx, projectId);
  if (existing) return existing;
  return insertPage(ctx, {
    companyId: ctx.kind === "staff" || ctx.kind === "customer" ? ctx.companyId : "",
    projectId,
    title: "프로젝트 홈",
  });
}

export async function loadEditorState(ctx: DataContext, projectId: string) {
  assertCanEdit(ctx);
  const page = await ensurePage(ctx, projectId);
  const [blocks, templates, photos] = await Promise.all([
    listBlocks(ctx, page.id),
    listUsableTemplates(ctx, projectId),
    listPhotosByProject(ctx, projectId, { limit: 100 }),
  ]);
  // 갤러리 블록은 프로젝트에 등록된 진행 사진에서 고른다.
  // (예전 UI 는 objectId 를 손으로 입력하게 했다.)
  const pickable = photos.items.map((p) => ({
    id: p.id,
    storageObjectId: p.storageObjectId,
    processCategory: p.processCategory,
    visibilityStatus: p.visibilityStatus,
    pairGroupId: p.pairGroupId,
    pairRole: p.pairRole,
    shotDate: p.shotDate,
  }));
  const pairGroups = [
    ...new Map(
      pickable
        .filter((p) => p.pairGroupId)
        .map((p) => [p.pairGroupId as string, p]),
    ).entries(),
  ].map(([id, sample]) => ({ id, shotDate: sample.shotDate }));
  return { page, blocks, templates, photos: pickable, pairGroups };
}

export type HomeBlockView = {
  id: string;
  blockType: BlockType;
  layout: z.infer<typeof layoutSchema>;
  style: Record<string, unknown>;
  content: unknown;
  visible: boolean;
  disabled?: boolean;
  photos?: Array<{ id: string; storageObjectId: string; pairRole: string | null }>;
  design?: { id: string; versionName: string; storageObjectId: string | null };
  materials?: Array<{
    id: string;
    name: string;
    imageObjectId: string | null;
    spec: string | null;
  }>;
  schedules?: Array<{ id: string; title: string; startAt: Date; scheduleType: string }>;
  comments?: Array<{
    id: string;
    body: string;
    authorName: string;
    createdAt: Date;
    deleted: boolean;
    kind: string;
  }>;
};

export async function loadHomePage(
  ctx: DataContext,
  projectId: string,
  opts: { publishedOnly: boolean },
) {
  const page = await findPageByProject(ctx, projectId);
  if (!page) return { mode: "default" as const, blocks: [] as HomeBlockView[] };
  const rows = await listBlocks(ctx, page.id, {
    publishedOnly: opts.publishedOnly,
  });
  if (opts.publishedOnly && rows.length === 0) {
    return { mode: "default" as const, blocks: [] as HomeBlockView[] };
  }
  const resolved = await resolveBlocks(ctx, projectId, rows, opts.publishedOnly);
  const visible = opts.publishedOnly ? resolved.filter((b) => b.visible) : resolved;
  if (opts.publishedOnly && visible.length === 0) {
    return { mode: "default" as const, blocks: [] as HomeBlockView[] };
  }
  return { mode: "blocks" as const, page, blocks: visible };
}

async function resolveBlocks(
  ctx: DataContext,
  projectId: string,
  rows: Awaited<ReturnType<typeof listBlocks>>,
  publishedOnly: boolean,
): Promise<HomeBlockView[]> {
  const designIds: string[] = [];
  const materialIds: string[] = [];
  const pairIds: string[] = [];
  for (const row of rows) {
    const parsed = blockContentSchemas[row.blockType as BlockType].safeParse(row.content);
    if (!parsed.success) continue;
    if (row.blockType === "design_file") {
      designIds.push((parsed.data as { designVersionId: string }).designVersionId);
    }
    if (row.blockType === "material_card") {
      materialIds.push(...(parsed.data as { materialIds: string[] }).materialIds);
    }
    if (row.blockType === "before_after") {
      pairIds.push((parsed.data as { pairGroupId: string }).pairGroupId);
    }
  }
  // 16.2 — 실제로 있는 블록 종류에 필요한 데이터만 조회한다.
  const needPhotos = rows.some((r) =>
    ["gallery", "before_after", "process"].includes(r.blockType),
  );
  const needSchedules = rows.some((r) => r.blockType === "schedule");
  const needComments = rows.some((r) => r.blockType === "comment");
  const [designs, materials, pairPhotos, allPhotos, schedules, comments] = await Promise.all([
    designIds.length ? listDesignsByIds(ctx, designIds) : [],
    materialIds.length ? listMaterialsByIds(ctx, materialIds) : [],
    pairIds.length ? listPhotosByPairGroupIds(ctx, projectId, pairIds) : [],
    needPhotos
      ? listPhotosByProject(ctx, projectId, { publishedOnly, limit: 100 }).then((page) => page.items)
      : [],
    needSchedules ? listSchedules(ctx, projectId, undefined, { publishedOnly }) : [],
    needComments
      ? listComments(ctx, projectId, { limit: 100 }).then((page) => page.items)
      : [],
  ]);
  const designMap = new Map(designs.map((d) => [d.id, d]));
  const materialMap = new Map(materials.map((m) => [m.id, m]));
  const pairMap = new Map<string, typeof pairPhotos>();
  for (const photo of pairPhotos) {
    if (!photo.pairGroupId) continue;
    const list = pairMap.get(photo.pairGroupId) ?? [];
    list.push(photo);
    pairMap.set(photo.pairGroupId, list);
  }

  return rows.map((row) => {
    const layout = layoutSchema.parse(row.layout);
    const parsed = blockContentSchemas[row.blockType as BlockType].safeParse(row.content);
    const content = parsed.success ? parsed.data : row.content;
    const view: HomeBlockView = {
      id: row.id,
      blockType: row.blockType as BlockType,
      layout,
      style: (row.style as Record<string, unknown>) ?? {},
      content,
      visible: true,
    };
    if (!parsed.success) {
      view.visible = !publishedOnly;
      return view;
    }
    if (row.blockType === "before_after") {
      const pair = pairMap.get((parsed.data as { pairGroupId: string }).pairGroupId) ?? [];
      const before = pair.find((p) => p.pairRole === "before");
      const after = pair.find((p) => p.pairRole === "after");
      const bothPublished =
        before?.visibilityStatus === "published" && after?.visibilityStatus === "published";
      view.photos = pair.map((p) => ({
        id: p.id,
        storageObjectId: p.storageObjectId,
        pairRole: p.pairRole,
      }));
      view.visible = publishedOnly ? bothPublished : true;
    }
    if (row.blockType === "design_file") {
      const design = designMap.get((parsed.data as { designVersionId: string }).designVersionId);
      if (!design || (publishedOnly && design.visibilityStatus !== "published")) {
        view.visible = !publishedOnly;
      } else {
        view.design = {
          id: design.id,
          versionName: design.versionName,
          storageObjectId: design.storageObjectId,
        };
      }
    }
    if (row.blockType === "material_card") {
      const ids = (parsed.data as { materialIds: string[] }).materialIds;
      const selected = ids
        .map((id) => materialMap.get(id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .filter((row) => !publishedOnly || row.visibilityStatus === "published");
      view.materials = selected.map((row) => ({
        id: row.id,
        name: row.name,
        imageObjectId: row.imageObjectId,
        spec: row.spec,
      }));
    }
    if (row.blockType === "gallery") {
      const ids = new Set((parsed.data as { objectIds: string[] }).objectIds);
      view.photos = allPhotos
        .filter((p) => ids.has(p.storageObjectId))
        .filter((p) => !publishedOnly || p.visibilityStatus === "published")
        .map((p) => ({
          id: p.id,
          storageObjectId: p.storageObjectId,
          pairRole: p.pairRole,
        }));
    }
    if (row.blockType === "process") {
      const cats = new Set((parsed.data as { categories: string[] }).categories);
      view.photos = allPhotos
        .filter((p) => cats.size === 0 || cats.has(p.processCategory))
        .map((p) => ({
          id: p.id,
          storageObjectId: p.storageObjectId,
          pairRole: p.pairRole,
        }));
    }
    if (row.blockType === "schedule") {
      const types = new Set((parsed.data as { scheduleTypes: string[] }).scheduleTypes);
      view.schedules = schedules
        .filter((s) => types.has(s.type))
        .map((s) => ({
          id: s.id,
          title: s.title,
          startAt: s.startAt,
          scheduleType: s.type,
        }));
    }
    if (row.blockType === "comment") {
      view.comments = comments.map(({ comment, authorName }) => ({
        id: comment.id,
        body: comment.deletedAt ? messages.deletedComment : comment.body,
        authorName,
        createdAt: comment.createdAt,
        deleted: Boolean(comment.deletedAt),
        kind: comment.kind,
      }));
    }
    if (row.blockType === "button") {
      const action = (parsed.data as { action: string; href?: string }).action;
      if (action === "approve" || action === "open_file") {
        const publishedDesign = designs.find((d) => d.visibilityStatus === "published");
        view.disabled = publishedOnly && !publishedDesign;
      }
    }
    return view;
  });
}

export async function saveHomeBlocks(
  ctx: DataContext,
  raw: z.infer<typeof saveHomeInput>,
) {
  assertCanEdit(ctx);
  // 13.1 plan gate — 유료화 전에는 항상 통과한다.
  await requireFeature(ctx.companyId, "cms_editor");
  const input = saveHomeInput.parse(raw);
  const page = await ensurePage(ctx, input.projectId);
  const existing = await listBlocks(ctx, page.id);
  const existingMap = new Map(existing.map((row) => [row.id, row]));

  const saved = await db.transaction(async (tx) => {
    const touched = await touchPage(ctx, page.id, input.pageUpdatedAt, tx);
    if (!touched) throw new ConflictError(messages.conflictSave);
    const sorted = [...input.blocks].sort(
      (a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x,
    );
    let orderIndex = 0;
    for (const block of sorted) {
      // I2 — scheduled 는 공개 시각이 필수다. DB CHECK 로 500 이 나기 전에 막는다.
      if (block.visibilityStatus === "scheduled" && !block.publishAt) {
        throw new ForbiddenError(messages.publishAtRequired);
      }
      const content = parseBlockContent(block.blockType, block.content);
      if (block.blockType === "text") {
        const text = content as { html: string; align: "left" | "center" };
        text.html = sanitizeTextHtml(text.html);
      }
      const current = existingMap.get(block.id);
      if (block.deleted) {
        if (current) {
          await updateBlockRow(ctx, block.id, { deletedAt: new Date() }, tx);
        }
        continue;
      }
      if (!current && !block.isNew) {
        // 이 페이지에 없는 블록 id 는 받지 않는다(다른 프로젝트의 블록 차단).
        throw new NotFoundError();
      }
      if (!current || block.isNew) {
        if (block.visibilityStatus !== "draft" && block.visibilityStatus !== "review") {
          throw new ForbiddenError(messages.visibilityDenied);
        }
        await insertBlock(
          ctx,
          {
            id: block.id,
            companyId: ctx.kind === "staff" ? ctx.companyId : page.companyId,
            pageId: page.id,
            blockType: block.blockType,
            orderIndex,
            layout: block.layout,
            style: block.style,
            content,
            visibilityStatus: block.visibilityStatus,
            publishAt: parseSeoulInputOptional(block.publishAt) ?? null,
          },
          tx,
        );
      } else {
        if (current.visibilityStatus !== block.visibilityStatus) {
          assertVisibilityTransition(
            current.visibilityStatus as Visibility,
            block.visibilityStatus,
          );
          await recordAudit(
            {
              action: "visibility_change",
              targetType: "block",
              targetId: block.id,
              projectId: input.projectId,
              before: { visibilityStatus: current.visibilityStatus },
              after: { visibilityStatus: block.visibilityStatus },
            },
            ctx,
            tx,
          );
        }
        await updateBlockRow(
          ctx,
          block.id,
          {
            orderIndex,
            layout: block.layout,
            style: block.style,
            content,
            visibilityStatus: block.visibilityStatus,
            publishAt: parseSeoulInputOptional(block.publishAt) ?? null,
          },
          tx,
        );
      }
      orderIndex += 1;
    }
    return touched;
  });
  return saved;
}

export async function saveAsProjectTemplate(
  ctx: DataContext,
  projectId: string,
  name: string,
) {
  if (!isStaff(ctx) || !pageBuilderPolicy.saveProjectTemplate(ctx.roles)) {
    throw new ForbiddenError();
  }
  const page = await findPageByProject(ctx, projectId);
  if (!page) throw new NotFoundError();
  const blocks = await listBlocks(ctx, page.id);
  const snapshot = blocks.map((row) => ({
    blockType: row.blockType,
    layout: row.layout,
    style: row.style,
    content: row.content,
    visibilityStatus: "draft",
  }));
  return insertTemplate(ctx, {
    companyId: ctx.companyId,
    projectId,
    scope: "project",
    name: name.trim() || "프로젝트 템플릿",
    blocksSnapshot: snapshot,
    createdBy: ctx.userId,
  });
}

export async function applyTemplate(
  ctx: DataContext,
  projectId: string,
  templateId: string,
  mode: "overwrite" | "append",
) {
  assertCanEdit(ctx);
  const template = await findTemplateById(ctx, templateId);
  if (!template) throw new NotFoundError();
  const page = await ensurePage(ctx, projectId);
  const current = await listBlocks(ctx, page.id);
  const snapshot = z
    .array(
      z.object({
        blockType: saveBlockSchema.shape.blockType,
        layout: layoutSchema,
        style: z.unknown().optional(),
        content: z.unknown(),
      }),
    )
    .parse(template.blocksSnapshot);
  const maxY = current.reduce((acc, row) => {
    const layout = layoutSchema.safeParse(row.layout);
    return Math.max(acc, layout.success ? layout.data.y + layout.data.h : 0);
  }, 0);

  await db.transaction(async (tx) => {
    await recordAudit(
      {
        action: "project_update",
        targetType: "page",
        targetId: page.id,
        projectId,
        before: { blocks: current.map((row) => ({ id: row.id, layout: row.layout, content: row.content })) },
        after: { templateId, mode },
      },
      ctx,
      tx,
    );
    if (mode === "overwrite") {
      for (const row of current) {
        await updateBlockRow(ctx, row.id, { deletedAt: new Date() }, tx);
      }
    }
    const yOffset = mode === "append" ? maxY : 0;
    let orderIndex = mode === "overwrite" ? 0 : current.length;
    for (const item of snapshot) {
      const layout = { ...item.layout, y: item.layout.y + yOffset };
      await insertBlock(
        ctx,
        {
          companyId: ctx.companyId,
          pageId: page.id,
          blockType: item.blockType,
          orderIndex,
          layout,
          style: (item.style as Record<string, unknown>) ?? {},
          content: item.content ?? emptyContent(item.blockType),
          visibilityStatus: "draft",
        },
        tx,
      );
      orderIndex += 1;
    }
    await touchPage(ctx, page.id, page.token, tx);
  });
}

export async function requestTemplatePromotion(ctx: DataContext, templateId: string) {
  if (!isStaff(ctx) || !pageBuilderPolicy.requestPromotion(ctx.roles)) {
    throw new ForbiddenError();
  }
  const template = await findTemplateById(ctx, templateId);
  if (!template || template.scope !== "project") throw new NotFoundError();
  const updated = await db.transaction(async (tx) => {
    const row = await updateTemplateRow(
      ctx,
      templateId,
      {
        promotionStatus: "requested",
        promotionRequestedBy: ctx.userId,
        promotionNote: null,
      },
      tx,
    );
    await recordAudit(
      {
        action: "template_promote_request",
        targetType: "template",
        targetId: templateId,
        projectId: template.projectId ?? undefined,
        after: { promotionStatus: "requested" },
      },
      ctx,
      tx,
    );
    return row;
  });
  await emit("template.promotion_requested", {
    companyId: ctx.companyId,
    targetId: templateId,
    actorUserId: ctx.userId,
    variables: { name: template.name },
  });
  return updated;
}

export async function approveTemplatePromotion(ctx: DataContext, templateId: string) {
  if (!isStaff(ctx) || !pageBuilderPolicy.approvePromotion(ctx.roles)) {
    throw new ForbiddenError();
  }
  await requireFeature(ctx.companyId, "company_template");
  const template = await findTemplateById(ctx, templateId);
  if (!template) throw new NotFoundError();
  return db.transaction(async (tx) => {
    await updateTemplateRow(
      ctx,
      templateId,
      { promotionStatus: "approved", promotionReviewedBy: ctx.userId },
      tx,
    );
    const copy = await insertTemplate(
      ctx,
      {
        companyId: ctx.companyId,
        projectId: null,
        scope: "company",
        name: template.name,
        description: template.description,
        blocksSnapshot: template.blocksSnapshot,
        promotionStatus: "none",
        createdBy: ctx.userId,
      },
      tx,
    );
    await recordAudit(
      {
        action: "template_promote_approve",
        targetType: "template",
        targetId: copy.id,
        after: { from: templateId, scope: "company" },
      },
      ctx,
      tx,
    );
    return copy;
  });
}

export async function rejectTemplatePromotion(
  ctx: DataContext,
  templateId: string,
  note: string,
) {
  if (!isStaff(ctx) || !pageBuilderPolicy.approvePromotion(ctx.roles)) {
    throw new ForbiddenError();
  }
  if (!note.trim()) throw new ForbiddenError(messages.rejectNote);
  const template = await findTemplateById(ctx, templateId);
  if (!template) throw new NotFoundError();
  return db.transaction(async (tx) => {
    const row = await updateTemplateRow(
      ctx,
      templateId,
      {
        promotionStatus: "rejected",
        promotionReviewedBy: ctx.userId,
        promotionNote: note.trim(),
      },
      tx,
    );
    await recordAudit(
      {
        action: "template_promote_reject",
        targetType: "template",
        targetId: templateId,
        after: { note: note.trim() },
      },
      ctx,
      tx,
    );
    return row;
  });
}

export async function savePlatformTemplate(
  ctx: DataContext,
  name: string,
  snapshot: unknown,
) {
  if (ctx.kind !== "platform") throw new ForbiddenError();
  return insertTemplate(ctx, {
    companyId: null,
    projectId: null,
    scope: "platform",
    name: name.trim() || "플랫폼 템플릿",
    blocksSnapshot: snapshot ?? [],
    createdBy: ctx.userId,
  });
}
