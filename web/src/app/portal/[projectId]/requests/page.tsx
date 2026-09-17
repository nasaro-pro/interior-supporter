import { requireProjectAccess } from "@/lib/authz/portal";
import {
  addRequestCorrectionAction,
  createPortalRequestAction,
  listCorrectionsForProject,
  listRequests,
} from "@/modules/request";
import { createPortalCommentAction, listComments } from "@/modules/comment";
import { VerifyHint } from "@/components/portal/verify-hint";
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
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId);
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10">
      <div>
        <p className="gold-label">{messages.requestsTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.requestsTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{messages.originalImmutable}</p>
      </div>
      <form
        action={createPortalRequestAction.bind(null, projectId)}
        className="flex flex-col gap-2"
      >
        <textarea
          name="body"
          required
          placeholder={messages.commentBodyLabel}
          className="field min-h-24"
        />
        <button type="submit" className="ink-btn">
          {messages.submitRequest}
        </button>
      </form>
      <ul className="flex flex-col gap-6">
        {rows.map(({ request, authorName }) => (
          <li key={request.id} className="paper-card text-sm">
            <p>
              {authorName} · {formatSeoul(request.createdAt)} ·{" "}
              {statusLabel[request.processStatus]}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-lg leading-8">
              {request.originalBody}
            </p>
            {(byRequest.get(request.id) ?? []).map((row) => (
              <p key={row.id} className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {messages.addCorrection} · {formatSeoul(row.createdAt)} · {row.body}
              </p>
            ))}
            {request.response ? (
              <p className="mt-3 whitespace-pre-wrap">
                {messages.requestResponse}: {request.response}
              </p>
            ) : null}
            {request.authorId === ctx.userId ? (
              <form
                action={addRequestCorrectionAction.bind(null, projectId, request.id)}
                className="mt-3 flex flex-col gap-2"
              >
                <textarea name="body" required className="field min-h-16" />
                <button type="submit" className="ghost-btn w-fit">
                  {messages.addCorrection}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl">{messages.bindingBadge}</h2>
        {ctx.verified ? (
          <form
            action={createPortalCommentAction.bind(null, projectId)}
            className="flex flex-col gap-2"
          >
            <textarea name="body" required className="field min-h-20" />
            <input type="hidden" name="binding" value="on" />
            <button type="submit" className="ink-btn w-fit">
              {messages.bindingCheck}
            </button>
          </form>
        ) : (
          <VerifyHint projectId={projectId} />
        )}
        <ul className="flex flex-col gap-4">
          {comments.items
            .filter((row) => row.comment.kind === "binding")
            .map(({ comment, authorName }) => (
              <li key={comment.id} className="paper-card text-sm">
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
    </main>
  );
}
