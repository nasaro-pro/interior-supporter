import { requireProjectAccess } from "@/lib/authz/portal";
import { listDesigns, approveDesignAction, rejectDesignAction } from "@/modules/design";
import { listStorageObjectsByIds } from "@/modules/storage-quota";
import { FileImage } from "@/components/portal/file-image";
import { LoadMore } from "@/components/shared/load-more";
import { VerifyHint } from "@/components/portal/verify-hint";
import { isCadMime } from "@/lib/storage/magic";
import { messages } from "@/lib/messages";

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
  const { items: rows, nextCursor } = await listDesigns(ctx, projectId, {
    publishedOnly: true,
    cursor,
  });
  const files = await listStorageObjectsByIds(
    ctx,
    rows.flatMap((row) => [row.storageObjectId, row.previewObjectId].filter(Boolean) as string[]),
  );
  const mimeById = new Map(files.map((file) => [file.id, file.mimeType]));
  const latest = rows[0];
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <div>
        <p className="gold-label">{messages.designsTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.designsTitle}</h1>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.noPublished}</p>
      ) : null}
      {latest ? (
        <article className="paper-card">
          <p className="text-xl font-semibold">
            v{latest.versionNo} {latest.versionName}
          </p>
          {latest.changeNote ? (
            <p className="mt-1 text-sm leading-7 text-muted-foreground">{latest.changeNote}</p>
          ) : null}
          {latest.previewObjectId ? (
            <FileImage
              objectId={latest.previewObjectId}
              alt={latest.versionName}
              className="mt-4 w-full object-cover"
            />
          ) : mimeById.get(latest.storageObjectId)?.startsWith("image/") ? (
            <FileImage
              objectId={latest.storageObjectId}
              alt={latest.versionName}
              className="mt-4 w-full object-cover"
            />
          ) : null}
          {latest.storageObjectId ? (
            <a
              className="ghost-btn-sm mt-3"
              href={`/api/files/${latest.storageObjectId}?v=full`}
            >
              {isCadMime(mimeById.get(latest.storageObjectId) ?? "")
                ? messages.cadDownload
                : messages.downloadFile}
            </a>
          ) : null}
          <p className="mt-3 text-sm">
            {latest.approvalStatus === "approved"
              ? messages.approvalApproved
              : latest.approvalStatus === "rejected"
                ? messages.approvalRejected
                : messages.approvalPending}
          </p>
          {ctx.verified ? (
            <div className="mt-4 flex flex-col gap-2">
              <form
                action={approveDesignAction.bind(null, projectId, latest.id)}
                className="flex flex-col gap-2"
              >
                <input
                  name="note"
                  placeholder={messages.approvalNote}
                  className="field"
                />
                <button type="submit" className="ink-btn">
                  {messages.approve}
                </button>
              </form>
              <form action={rejectDesignAction.bind(null, projectId, latest.id)}>
                <button type="submit" className="ghost-btn w-full">
                  {messages.reject}
                </button>
              </form>
            </div>
          ) : (
            <VerifyHint projectId={projectId} />
          )}
        </article>
      ) : null}
      {rows.slice(1).map((row) => (
        <article key={row.id} className="border-t pt-3 text-sm">
          <p>
            v{row.versionNo} {row.versionName}
          </p>
          {row.changeNote ? (
            <p className="text-muted-foreground">{row.changeNote}</p>
          ) : null}
        </article>
      ))}
      {nextCursor ? (
        <LoadMore href={`/portal/${projectId}/design?cursor=${encodeURIComponent(nextCursor)}`} />
      ) : null}
    </main>
  );
}
