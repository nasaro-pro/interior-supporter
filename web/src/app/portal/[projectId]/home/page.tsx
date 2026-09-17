import { requireProjectAccess } from "@/lib/authz/portal";
import { findProjectById } from "@/modules/project";
import { findNextSchedule, listRecentSchedules } from "@/modules/schedule";
import { listPhotosByProject } from "@/modules/photo";
import { loadHomePage } from "@/modules/page-builder";
import { DefaultHome } from "@/components/page-builder/default-home";
import { HomeRenderer } from "@/components/page-builder/renderer/home-renderer";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId);
  const home = await loadHomePage(ctx, projectId, { publishedOnly: true });
  if (home.mode === "blocks") {
    return <HomeRenderer blocks={home.blocks} projectId={projectId} allowComments verified={ctx.verified} />;
  }
  const [project, next, recent, photos] = await Promise.all([
    findProjectById(ctx, projectId),
    findNextSchedule(ctx, projectId, { publishedOnly: true }),
    listRecentSchedules(ctx, projectId, { publishedOnly: true }),
    listPhotosByProject(ctx, projectId, { publishedOnly: true, limit: 6 }),
  ]);
  return (
    <DefaultHome
      title={project?.title ?? ""}
      currentProcess={project?.currentProcess ?? null}
      nextTitle={next?.title ?? null}
      nextAt={next?.startAt ?? null}
      recent={recent.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt }))}
      photos={photos.items.map((row) => ({ id: row.id, storageObjectId: row.storageObjectId }))}
    />
  );
}
