import { requireProjectInCompany } from "@/lib/authz";
import {
  listCorrectionsForProject,
  listRequests,
  respondToRequestAction,
} from "@/modules/request";
import { listComments } from "@/modules/comment";
import { formatSeoul } from "@/lib/datetime";
import { messages } from "@/lib/messages";

const statusLabel = {
  open: messages.requestStatusOpen,
  in_progress: messages.requestStatusProgress,
  done: messages.requestStatusDone,
} as const;

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const [rows, corrections, comments] = await Promise.all([
    listRequests(ctx, projectId),
    listCorrectionsForProject(ctx, projectId),
    listComments(ctx, projectId, { limit: 50 }),
  ]);
  const byRequest = new Map<string, typeof corrections>();
  for (const row of corrections) {
    const list = byRequest.get(row.requestId) ?? [];
    list.push(row);
    byRequest.set(row.requestId, list);
  }
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h2 className="text-2xl">{messages.requestsTitle}</h2>
      <p className="text-sm text-muted-foreground">{messages.originalImmutable}</p>
      <ul className="flex flex-col gap-6">
        {rows.map(({ request, authorName }) => (
          <li key={request.id} className="border-t pt-4 text-sm">
            <p>
              {authorName} · {formatSeoul(request.createdAt)} ·{" "}
              {statusLabel[request.processStatus]}
            </p>
            <p className="mt-2 whitespace-pre-wrap">
              <span className="gold-label mr-2">{messages.requestOriginal}</span>
              {request.originalBody}
            </p>
            {(byRequest.get(request.id) ?? []).map((row) => (
              <p key={row.id} className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {messages.addCorrection} · {formatSeoul(row.createdAt)} · {row.body}
              </p>
            ))}
            {request.response ? (
              <p className="mt-2 whitespace-pre-wrap">
                {messages.requestResponse}: {request.response}
              </p>
            ) : null}
            <form
              action={respondToRequestAction.bind(
                null,
                companySlug,
                projectId,
                request.id,
              )}
              className="mt-3 flex flex-col gap-2"
            >
              <textarea
                name="response"
                defaultValue={request.response ?? ""}
                required
                className="rounded-md border border-input px-3 py-2"
              />
              <select
                name="processStatus"
                defaultValue={request.processStatus}
                className="h-9 w-40 rounded-md border border-input px-3"
              >
                <option value="open">{messages.requestStatusOpen}</option>
                <option value="in_progress">{messages.requestStatusProgress}</option>
                <option value="done">{messages.requestStatusDone}</option>
              </select>
              <button type="submit" className="ink-btn w-fit">
                {messages.requestResponse}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-3">
        <h3 className="text-lg">{messages.bindingBadge}</h3>
        <ul className="flex flex-col gap-4">
          {comments.items
            .filter((row) => row.comment.kind === "binding")
            .map(({ comment, authorName }) => (
              <li key={comment.id} className="border-t pt-3 text-sm">
                <p>
                  <span className="gold-label mr-2">{messages.bindingBadge}</span>
                  {authorName} · {formatSeoul(comment.createdAt)}
                </p>
                <p className="mt-2 whitespace-pre-wrap">
                  {comment.deletedAt ? messages.deletedComment : comment.body}
                </p>
              </li>
            ))}
        </ul>
      </section>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{messages.noItems}</p> : null}
    </main>
  );
}
