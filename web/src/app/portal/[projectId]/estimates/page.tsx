import { requireProjectAccess } from "@/lib/authz/portal";
import { listEstimates } from "@/modules/estimate";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId);
  const rows = await listEstimates(ctx, projectId, { publishedOnly: true });
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <div>
        <p className="gold-label">{messages.estimatesTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.estimatesTitle}</h1>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.noPublished}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id} className="paper-card flex items-center justify-between gap-3">
              <p className="text-lg font-semibold">
                v{row.versionNo} {row.versionName}
              </p>
              <a className="ink-btn" href={`/api/files/${row.pdfFileId}?v=full`}>
                {messages.openLink}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
