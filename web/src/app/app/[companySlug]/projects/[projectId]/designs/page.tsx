import { requireProjectInCompany } from "@/lib/authz";
import {
  changeDesignVisibilityAction,
  createDesignAction,
  listDesigns,
} from "@/modules/design";
import { listStorageObjectsByIds } from "@/modules/storage-quota";
import { LoadMore } from "@/components/shared/load-more";
import { Uploader } from "@/components/shared/uploader";
import { VisibilityControl } from "@/components/shared/visibility-control";
import { FileImage } from "@/components/portal/file-image";
import { isCadMime } from "@/lib/storage/magic";
import { approvalLabels, messages, visibilityLabels } from "@/lib/messages";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { companySlug, projectId } = await params;
  const { cursor } = await searchParams;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const { items: rows, nextCursor } = await listDesigns(ctx, projectId, { cursor });
  const files = await listStorageObjectsByIds(
    ctx,
    rows.flatMap((row) => [row.storageObjectId, row.previewObjectId].filter(Boolean) as string[]),
  );
  const mimeById = new Map(files.map((file) => [file.id, file.mimeType]));
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <h2 className="text-2xl">{messages.designsTitle}</h2>
      <form
        action={createDesignAction.bind(null, companySlug, projectId)}
        className="flex flex-col gap-2"
      >
        <input
          name="versionName"
          required
          placeholder={messages.versionNameLabel}
          className="h-9 rounded-md border border-input px-3"
        />
        <textarea
          name="changeNote"
          placeholder={messages.changeNoteLabel}
          className="rounded-md border border-input px-3 py-2"
        />
        <Uploader
          companySlug={companySlug}
          projectId={projectId}
          category="design"
          name="storageObjectId"
        />
        <p className="text-sm text-muted-foreground">{messages.previewImage}</p>
        <Uploader
          companySlug={companySlug}
          projectId={projectId}
          category="design"
          name="previewObjectId"
          accept="image/jpeg,image/png,image/webp"
        />
        <button
          type="submit"
          className="ink-btn w-fit"
        >
          {messages.createDesign}
        </button>
      </form>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => {
          const mime = mimeById.get(row.storageObjectId) ?? "";
          const cad = isCadMime(mime);
          const previewId = row.previewObjectId ?? (mime.startsWith("image/") ? row.storageObjectId : null);
          return (
            <li key={row.id} className="border-t pt-3 text-sm">
              <p>
                v{row.versionNo} {row.versionName} · {visibilityLabels[row.visibilityStatus]} ·{" "}
                {approvalLabels[row.approvalStatus]}
              </p>
              {previewId ? (
                <FileImage
                  objectId={previewId}
                  alt={row.versionName}
                  className="mt-2 h-32 w-48 object-cover"
                />
              ) : null}
              {row.storageObjectId ? (
                <a
                  className="ghost-btn-sm mt-2"
                  href={`/api/files/${row.storageObjectId}?v=full`}
                >
                  {cad ? messages.cadDownload : messages.downloadFile}
                </a>
              ) : null}
              <VisibilityControl
                current={row.visibilityStatus}
                action={changeDesignVisibilityAction.bind(
                  null,
                  companySlug,
                  projectId,
                  row.id,
                )}
              />
            </li>
          );
        })}
      </ul>
      {nextCursor ? (
        <LoadMore
          href={`/app/${companySlug}/projects/${projectId}/designs?cursor=${encodeURIComponent(nextCursor)}`}
        />
      ) : null}
    </main>
  );
}
