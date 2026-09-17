import { requireProjectInCompany } from "@/lib/authz";
import {
  changeEstimateVisibilityAction,
  createEstimateAction,
  listEstimates,
} from "@/modules/estimate";
import { Uploader } from "@/components/shared/uploader";
import { VisibilityControl } from "@/components/shared/visibility-control";
import { messages, visibilityLabels } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const rows = await listEstimates(ctx, projectId);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <h2 className="text-2xl">{messages.estimatesTitle}</h2>
      <form
        action={createEstimateAction.bind(null, companySlug, projectId)}
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
          name="pdfFileId"
          accept="application/pdf"
        />
        <button type="submit" className="ink-btn w-fit">
          {messages.createEstimate}
        </button>
      </form>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.id} className="border-t pt-3 text-sm">
            <p>
              v{row.versionNo} {row.versionName} · {visibilityLabels[row.visibilityStatus]}
            </p>
            <a className="ghost-btn-sm" href={`/api/files/${row.pdfFileId}?v=full`}>
              {messages.openLink}
            </a>
            <VisibilityControl
              current={row.visibilityStatus}
              action={changeEstimateVisibilityAction.bind(
                null,
                companySlug,
                projectId,
                row.id,
              )}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
