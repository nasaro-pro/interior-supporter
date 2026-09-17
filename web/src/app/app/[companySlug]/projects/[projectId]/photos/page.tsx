import { requireProjectInCompany } from "@/lib/authz";
import {
  bulkPhotoVisibilityAction,
  changePhotoVisibilityAction,
  createPhotosAction,
  listPhotos,
  pairPhotosAction,
} from "@/modules/photo";
import { listFieldLogs } from "@/modules/field-log";
import { LoadMore } from "@/components/shared/load-more";
import { Uploader } from "@/components/shared/uploader";
import { VisibilityControl } from "@/components/shared/visibility-control";
import { FileImage } from "@/components/portal/file-image";
import { messages, processLabels, visibilityLabels } from "@/lib/messages";

const PROCESSES = Object.keys(processLabels) as (keyof typeof processLabels)[];

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
  searchParams: Promise<{ process?: string; cursor?: string }>;
}) {
  const { companySlug, projectId } = await params;
  const { process: processRaw, cursor } = await searchParams;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const process = PROCESSES.includes(processRaw as keyof typeof processLabels)
    ? (processRaw as keyof typeof processLabels)
    : "demolition";
  const [{ items: rows, nextCursor }, logs] = await Promise.all([
    listPhotos(ctx, projectId, process, { cursor }),
    listFieldLogs(ctx, projectId),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h2 className="text-2xl">{messages.photosTitle}</h2>
      <nav className="flex flex-wrap gap-2 text-sm">
        {PROCESSES.map((key) => (
          <a
            key={key}
            className={key === process ? "nav-btn nav-btn-active" : "nav-btn"}
            href={`/app/${companySlug}/projects/${projectId}/photos?process=${key}`}
          >
            {processLabels[key]}
          </a>
        ))}
      </nav>
      <form
        action={createPhotosAction.bind(null, companySlug, projectId, process)}
        className="flex flex-col gap-2"
      >
        <input type="date" name="shotDate" className="h-9 w-48 rounded-md border border-input px-3" />
        <select name="fieldWorkLogId" className="h-9 rounded-md border border-input px-3">
          <option value="">{messages.noWorkLog}</option>
          {logs.map((row) => (
            <option key={row.id} value={row.id}>
              {processLabels[row.processCategory]} · {row.workDate}
            </option>
          ))}
        </select>
        <textarea name="description" placeholder={messages.descriptionLabel} className="rounded-md border border-input px-3 py-2" />
        <Uploader
          companySlug={companySlug}
          projectId={projectId}
          category="photo"
          multiple
          accept="image/jpeg,image/png,image/webp"
        />
        <button type="submit" className="ink-btn w-fit">
          {messages.uploadPhotos}
        </button>
      </form>
      <form className="flex flex-col gap-2" action={bulkPhotoVisibilityAction.bind(null, companySlug, projectId, "review")}>
        {rows.map((row) => (
          <label key={row.id} className="flex items-start gap-3 border-t py-3 text-sm">
            <input type="checkbox" name="ids" value={row.id} />
            <span>
              <FileImage
                objectId={row.storageObjectId}
                alt=""
                className="h-24 w-24 object-cover"
              />
              <p>
                {visibilityLabels[row.visibilityStatus]}
                {row.pairRole ? ` · ${row.pairRole}` : ""}
                {row.fieldWorkLogId ? ` · ${messages.linkWorkLog}` : ""}
              </p>
              <VisibilityControl
                current={row.visibilityStatus}
                action={changePhotoVisibilityAction.bind(
                  null,
                  companySlug,
                  projectId,
                  row.id,
                )}
              />
            </span>
          </label>
        ))}
        <div className="flex gap-2">
          <button type="submit" className="ghost-btn">
            {messages.bulkReview}
          </button>
          <button
            type="submit"
            formAction={bulkPhotoVisibilityAction.bind(null, companySlug, projectId, "published")}
            className="ghost-btn"
          >
            {messages.bulkPublish}
          </button>
        </div>
      </form>
      <form
        action={pairPhotosAction.bind(null, companySlug, projectId)}
        className="flex flex-wrap gap-2 text-sm"
      >
        <select name="beforeId" className="h-9 rounded-md border border-input px-3">
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.id.slice(0, 8)} {messages.pairBefore}
            </option>
          ))}
        </select>
        <select name="afterId" className="h-9 rounded-md border border-input px-3">
          {rows.map((row) => (
            <option key={row.id} value={row.id}>
              {row.id.slice(0, 8)} {messages.pairAfter}
            </option>
          ))}
        </select>
        <button type="submit" className="ghost-btn">
          {messages.savePair}
        </button>
      </form>
      {nextCursor ? (
        <LoadMore
          href={`/app/${companySlug}/projects/${projectId}/photos?process=${process}&cursor=${encodeURIComponent(nextCursor)}`}
        />
      ) : null}
    </main>
  );
}
