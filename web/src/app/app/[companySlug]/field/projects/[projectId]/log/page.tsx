import Link from "next/link";
import { requireFieldAssignment } from "@/lib/authz";
import {
  createFieldLogAction,
  listFieldLogs,
  updateFieldLogAction,
} from "@/modules/field-log";
import { createFieldPhotosAction, listPhotosByProject } from "@/modules/photo";
import { Uploader } from "@/components/shared/uploader";
import { FileImage } from "@/components/portal/file-image";
import { processLabels, messages } from "@/lib/messages";
import { seoulDayValue } from "@/lib/datetime";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const ctx = await requireFieldAssignment(companySlug, projectId);
  const today = seoulDayValue();
  const [rows, photos] = await Promise.all([
    listFieldLogs(ctx, projectId, today),
    listPhotosByProject(ctx, projectId, { limit: 80 }),
  ]);
  const byLog = new Map<string, typeof photos.items>();
  for (const photo of photos.items) {
    if (!photo.fieldWorkLogId) continue;
    const list = byLog.get(photo.fieldWorkLogId) ?? [];
    list.push(photo);
    byLog.set(photo.fieldWorkLogId, list);
  }
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-5">
      <div className="flex justify-between gap-2">
        <h1 className="text-2xl">{messages.fieldLogTitle}</h1>
        <Link
          href={`/app/${companySlug}/field/projects/${projectId}/photos`}
          className="ghost-btn"
        >
          {messages.fieldPhotosTitle}
        </Link>
      </div>
      <form
        action={createFieldLogAction.bind(null, companySlug, projectId)}
        className="flex flex-col gap-3"
      >
        <select name="processCategory" className="h-12 rounded-md border border-input px-3 text-base">
          {Object.entries(processLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <textarea name="body" required className="min-h-28 rounded-md border border-input px-3 py-2" />
        <textarea name="issue" placeholder={messages.issueLabel} className="min-h-16 rounded-md border border-input px-3 py-2" />
        <select name="status" className="h-12 rounded-md border border-input px-3">
          <option value="started">{messages.workLogStatusStarted}</option>
          <option value="in_progress">{messages.workLogStatusProgress}</option>
          <option value="done">{messages.workLogStatusDone}</option>
        </select>
        <button type="submit" className="ink-btn h-12 text-base">
          {messages.submitFieldLog}
        </button>
      </form>
      <ul className="flex flex-col gap-4 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="border-t pt-3">
            <p>
              {processLabels[row.processCategory]} · {row.status}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{row.body}</p>
            {row.issue ? <p className="mt-1">{row.issue}</p> : null}
            <div className="mt-2 grid grid-cols-3 gap-1">
              {(byLog.get(row.id) ?? []).map((photo) => (
                <FileImage
                  key={photo.id}
                  objectId={photo.storageObjectId}
                  alt=""
                  className="h-20 w-full object-cover"
                />
              ))}
            </div>
            <form
              action={createFieldPhotosAction.bind(
                null,
                companySlug,
                projectId,
                row.processCategory,
              )}
              className="mt-2 flex flex-col gap-2"
            >
              <input type="hidden" name="fieldWorkLogId" value={row.id} />
              <input type="hidden" name="shotDate" value={today} />
              <Uploader
                companySlug={companySlug}
                projectId={projectId}
                category="photo"
                name="objectIds"
                accept="image/jpeg,image/png,image/webp"
                multiple
              />
              <button type="submit" className="ghost-btn-sm w-fit">
                {messages.uploadPhotos}
              </button>
            </form>
            <form
              action={updateFieldLogAction.bind(null, companySlug, projectId, row.id)}
              className="mt-2 flex flex-col gap-2"
            >
              <input type="hidden" name="processCategory" value={row.processCategory} />
              <textarea name="body" defaultValue={row.body} className="rounded-md border border-input px-3 py-2" />
              <textarea name="issue" defaultValue={row.issue ?? ""} className="rounded-md border border-input px-3 py-2" />
              <select name="status" defaultValue={row.status} className="h-10 rounded-md border border-input px-3">
                <option value="started">{messages.workLogStatusStarted}</option>
                <option value="in_progress">{messages.workLogStatusProgress}</option>
                <option value="done">{messages.workLogStatusDone}</option>
              </select>
              <button type="submit" className="ghost-btn-sm w-fit">
                {messages.submitFieldLog}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
