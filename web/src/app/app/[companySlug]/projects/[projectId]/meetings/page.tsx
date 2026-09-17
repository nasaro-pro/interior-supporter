import { requireProjectInCompany } from "@/lib/authz";
import {
  changeMeetingVisibilityAction,
  createMeetingAction,
  listMeetings,
  listParticipantsForProject,
} from "@/modules/meeting";
import { Uploader } from "@/components/shared/uploader";
import { VisibilityControl } from "@/components/shared/visibility-control";
import { formatSeoul } from "@/lib/datetime";
import { messages, visibilityLabels } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const [rows, participants] = await Promise.all([
    listMeetings(ctx, projectId),
    listParticipantsForProject(ctx, projectId),
  ]);
  const byMeeting = new Map<string, string[]>();
  for (const row of participants) {
    const name = row.externalName ?? row.role ?? "";
    if (!name) continue;
    const list = byMeeting.get(row.meetingId) ?? [];
    list.push(name);
    byMeeting.set(row.meetingId, list);
  }
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <h2 className="text-2xl">{messages.meetingsTitle}</h2>
      <form
        action={createMeetingAction.bind(null, companySlug, projectId)}
        className="flex flex-col gap-2"
      >
        <input name="title" required placeholder={messages.projectTitleLabel} className="h-9 rounded-md border border-input px-3" />
        <input type="datetime-local" name="meetingAt" required className="h-9 rounded-md border border-input px-3" />
        <input name="participants" placeholder={messages.participantsLabel} className="h-9 rounded-md border border-input px-3" />
        <textarea name="minutes" placeholder={messages.minutesLabel} className="rounded-md border border-input px-3 py-2" />
        <textarea name="decisions" placeholder={messages.decisionsLabel} className="rounded-md border border-input px-3 py-2" />
        <p className="text-sm text-muted-foreground">{messages.attachmentLabel}</p>
        <Uploader
          companySlug={companySlug}
          projectId={projectId}
          category="design"
          accept="application/pdf,image/jpeg,image/png,image/webp"
        />
        <button type="submit" className="ink-btn w-fit">
          {messages.createMeeting}
        </button>
      </form>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <li key={row.id} className="border-t pt-3 text-sm">
            <p>
              {row.title} · {formatSeoul(row.meetingAt)} · {visibilityLabels[row.visibilityStatus]}
            </p>
            {(byMeeting.get(row.id) ?? []).length > 0 ? (
              <p className="mt-1 text-muted-foreground">
                {messages.participantsLabel}: {(byMeeting.get(row.id) ?? []).join(", ")}
              </p>
            ) : null}
            {row.minutes ? <p className="mt-1 whitespace-pre-wrap">{row.minutes}</p> : null}
            {row.decisions ? <p className="mt-1">{row.decisions}</p> : null}
            {row.attachmentId ? (
              <a className="ghost-btn-sm mt-2" href={`/api/files/${row.attachmentId}?v=full`}>
                {messages.attachmentLabel}
              </a>
            ) : null}
            <VisibilityControl
              current={row.visibilityStatus}
              action={changeMeetingVisibilityAction.bind(
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
