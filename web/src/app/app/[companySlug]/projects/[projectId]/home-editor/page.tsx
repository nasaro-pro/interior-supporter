import Link from "next/link";
import { requireProjectInCompany } from "@/lib/authz";
import { loadEditorState, loadHomePage, layoutSchema, type BlockType } from "@/modules/page-builder";
import { listDesigns } from "@/modules/design";
import { listMaterialsByProject } from "@/modules/material";
import { listPhotosByProject } from "@/modules/photo";
import { findProjectById } from "@/modules/project";
import { findNextSchedule, listRecentSchedules } from "@/modules/schedule";
import { HomeEditor } from "@/components/page-builder/editor";
import { HomeRenderer } from "@/components/page-builder/renderer/home-renderer";
import { DefaultHome } from "@/components/page-builder/default-home";
import { messages } from "@/lib/messages";
import { toSeoulInputValue } from "@/lib/datetime";
import type { Visibility } from "@/lib/visibility";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { companySlug, projectId } = await params;
  const { preview } = await searchParams;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  if (preview === "1") {
    const home = await loadHomePage(ctx, projectId, { publishedOnly: true });
    const [project, next, recent, photos] = await Promise.all([
      findProjectById(ctx, projectId),
      findNextSchedule(ctx, projectId, { publishedOnly: true }),
      listRecentSchedules(ctx, projectId, { publishedOnly: true }),
      listPhotosByProject(ctx, projectId, { publishedOnly: true, limit: 100 }),
    ]);
    return (
      <main>
        <div className="border-b px-6 py-3 text-sm">
          <Link href={`/app/${companySlug}/projects/${projectId}/home-editor`}>
            {messages.backToEditor}
          </Link>
        </div>
        {home.mode === "blocks" ? (
          <HomeRenderer blocks={home.blocks} projectId={projectId} />
        ) : (
          <DefaultHome
            title={project?.title ?? ""}
            currentProcess={project?.currentProcess ?? null}
            nextTitle={next?.title ?? null}
            nextAt={next?.startAt ?? null}
            recent={recent.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt }))}
            photos={photos.items.slice(0, 6).map((row) => ({ id: row.id, storageObjectId: row.storageObjectId }))}
          />
        )}
      </main>
    );
  }
  const [{ page, blocks, templates, photos, pairGroups }, designs, materials] =
    await Promise.all([
      loadEditorState(ctx, projectId),
      listDesigns(ctx, projectId, { limit: 100 }),
      listMaterialsByProject(ctx, projectId, { limit: 100 }),
    ]);
  return (
    <HomeEditor
      companySlug={companySlug}
      projectId={projectId}
      pageUpdatedAt={page.token}
      initialBlocks={blocks.map((row) => ({
        id: row.id,
        blockType: row.blockType as BlockType,
        layout: layoutSchema.parse(row.layout),
        style: (row.style ?? {}) as Record<string, unknown>,
        content: row.content,
        visibilityStatus: row.visibilityStatus as Visibility,
        // datetime-local 입력값은 KST 기준 문자열이다 (5.1)
        publishAt: toSeoulInputValue(row.publishAt) || null,
      }))}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        scope: t.scope,
        promotionStatus: t.promotionStatus,
      }))}
      designs={designs.items.map((d) => ({ id: d.id, versionName: d.versionName }))}
      materials={materials.items.map((m) => ({ id: m.id, name: m.name }))}
      photos={photos.map((p) => ({
        id: p.id,
        storageObjectId: p.storageObjectId,
        processCategory: p.processCategory,
        published: p.visibilityStatus === "published",
      }))}
      pairGroups={pairGroups.map((g) => ({
        id: g.id,
        label: g.shotDate ?? g.id.slice(0, 8),
      }))}
    />
  );
}
