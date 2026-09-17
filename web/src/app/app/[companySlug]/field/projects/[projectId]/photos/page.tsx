import { requireFieldAssignment } from "@/lib/authz";
import { createFieldPhotosAction, listPhotosByProject } from "@/modules/photo";
import { listFieldLogs } from "@/modules/field-log";
import { Uploader } from "@/components/shared/uploader";
import { FileImage } from "@/components/portal/file-image";
import { seoulDayValue } from "@/lib/datetime";
import { messages, processLabels } from "@/lib/messages";

const PROCESSES = Object.keys(processLabels) as (keyof typeof processLabels)[];

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
  searchParams: Promise<{ process?: string }>;
}) {
  const { companySlug, projectId } = await params;
  const { process: processRaw } = await searchParams;
  const ctx = await requireFieldAssignment(companySlug, projectId);
  const process = PROCESSES.includes(processRaw as keyof typeof processLabels)
    ? (processRaw as keyof typeof processLabels)
    : "finishing";
  const [{ items: rows }, logs] = await Promise.all([
    listPhotosByProject(ctx, projectId, { limit: 60 }),
    listFieldLogs(ctx, projectId),
  ]);
  const mine = rows.filter((row) => row.processCategory === process);
  const logLabel = new Map(logs.map((row) => [row.id, processLabels[row.processCategory]]));
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-5">
      <h1 className="text-2xl">{messages.fieldPhotosTitle}</h1>
      <nav className="flex flex-wrap gap-2">
        {PROCESSES.map((key) => (
          <a
            key={key}
            href={`/app/${companySlug}/field/projects/${projectId}/photos?process=${key}`}
            className={key === process ? "nav-btn nav-btn-active" : "nav-btn"}
          >
            {processLabels[key]}
          </a>
        ))}
      </nav>
      <form
        action={createFieldPhotosAction.bind(null, companySlug, projectId, process)}
        className="flex flex-col gap-3"
      >
        <input type="date" name="shotDate" defaultValue={seoulDayValue()} className="h-12 rounded-md border border-input px-3" />
        <select name="fieldWorkLogId" className="h-12 rounded-md border border-input px-3">
          <option value="">{messages.noWorkLog}</option>
          {logs.map((row) => (
            <option key={row.id} value={row.id}>
              {processLabels[row.processCategory]} · {row.workDate} · {row.body.slice(0, 24)}
            </option>
          ))}
        </select>
        <Uploader
          companySlug={companySlug}
          projectId={projectId}
          category="photo"
          name="objectIds"
          accept="image/jpeg,image/png,image/webp"
          multiple
        />
        <button type="submit" className="ink-btn h-12 text-base">
          {messages.uploadPhotos}
        </button>
      </form>
      <div className="grid grid-cols-2 gap-2">
        {mine.map((row) => (
          <div key={row.id}>
            <FileImage
              objectId={row.storageObjectId}
              alt={row.description ?? ""}
              className="h-36 w-full object-cover"
            />
            {row.fieldWorkLogId ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {messages.linkWorkLog}: {logLabel.get(row.fieldWorkLogId) ?? messages.linkWorkLog}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}
