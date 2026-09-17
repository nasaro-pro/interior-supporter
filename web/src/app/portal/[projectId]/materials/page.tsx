import { requireProjectAccess } from "@/lib/authz/portal";
import {
  listMaterialsByProject,
  approveMaterialAction,
  rejectMaterialAction,
} from "@/modules/material";
import { FileImage } from "@/components/portal/file-image";
import { LoadMore } from "@/components/shared/load-more";
import { VerifyHint } from "@/components/portal/verify-hint";
import { messages, spaceLabels } from "@/lib/messages";

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
  const { items: rows, nextCursor } = await listMaterialsByProject(ctx, projectId, {
    publishedOnly: true,
    cursor,
  });
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.spaceCategory) ?? [];
    list.push(row);
    grouped.set(row.spaceCategory, list);
  }
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <div>
        <p className="gold-label">{messages.materialsTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.materialsTitle}</h1>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.noPublished}</p>
      ) : null}
      {[...grouped.entries()].map(([space, items]) => (
        <section key={space}>
          <h2 className="mb-3 text-2xl">
            {spaceLabels[space as keyof typeof spaceLabels]}
          </h2>
          <ul className="flex flex-col gap-3">
            {items.map((row) => {
              const imageId = row.imageObjectId ?? row.linkImageObjectId;
              return (
                <li key={row.id} className="paper-card text-sm">
                  {imageId ? (
                    <FileImage
                      objectId={imageId}
                      alt={row.name}
                      className="mb-3 h-40 w-full object-cover"
                    />
                  ) : null}
                  <p className="text-lg font-semibold">{row.name}</p>
                  <p className="text-muted-foreground">
                    {[row.brand, row.spec, row.color].filter(Boolean).join(" · ")}
                  </p>
                  {row.externalUrl ? (
                    <a
                      href={row.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link"
                    >
                      {messages.openLink}
                    </a>
                  ) : null}
                  <p className="mt-1">
                    {row.approvalStatus === "approved"
                      ? messages.approvalApproved
                      : row.approvalStatus === "rejected"
                        ? messages.approvalRejected
                        : messages.approvalPending}
                  </p>
                  {ctx.verified ? (
                    <div className="mt-2 flex gap-2">
                      <form action={approveMaterialAction.bind(null, projectId, row.id)}>
                        <button type="submit" className="ghost-btn-sm">
                          {messages.approve}
                        </button>
                      </form>
                      <form action={rejectMaterialAction.bind(null, projectId, row.id)}>
                        <button type="submit" className="danger-btn">
                          {messages.reject}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <VerifyHint projectId={projectId} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {nextCursor ? (
        <LoadMore href={`/portal/${projectId}/materials?cursor=${encodeURIComponent(nextCursor)}`} />
      ) : null}
    </main>
  );
}
