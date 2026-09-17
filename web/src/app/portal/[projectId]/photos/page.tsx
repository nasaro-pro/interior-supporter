import { requireProjectAccess } from "@/lib/authz/portal";
import { listPhotosByProject } from "@/modules/photo";
import { FileImage } from "@/components/portal/file-image";
import { Lightbox } from "@/components/portal/lightbox";
import { LoadMore } from "@/components/shared/load-more";
import { messages, processLabels } from "@/lib/messages";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { projectId } = await params;
  const { cursor } = await searchParams;
  const ctx = await requireProjectAccess(projectId);
  const { items: rows, nextCursor } = await listPhotosByProject(ctx, projectId, {
    publishedOnly: true,
    cursor,
  });
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.processCategory) ?? [];
    list.push(row);
    grouped.set(row.processCategory, list);
  }
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <div>
        <p className="gold-label">{messages.photosTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.photosTitle}</h1>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.noPublished}</p>
      ) : null}
      {[...grouped.entries()].map(([process, items]) => (
        <section key={process}>
          <h2 className="mb-3 text-2xl">
            {processLabels[process as keyof typeof processLabels]}
          </h2>
          <div className="grid grid-cols-2 gap-px bg-[rgba(154,129,84,0.3)] sm:grid-cols-3">
            {items.map((row) => (
              <Lightbox key={row.id} objectId={row.storageObjectId} alt={row.description ?? ""}>
                <FileImage
                  objectId={row.storageObjectId}
                  alt={row.description ?? ""}
                  className="h-40 w-full bg-[var(--sand)] object-cover"
                />
              </Lightbox>
            ))}
          </div>
        </section>
      ))}
      {nextCursor ? (
        <LoadMore href={`/portal/${projectId}/photos?cursor=${encodeURIComponent(nextCursor)}`} />
      ) : null}
    </main>
  );
}
