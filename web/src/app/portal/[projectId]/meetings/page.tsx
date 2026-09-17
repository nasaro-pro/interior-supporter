import { requireProjectAccess } from "@/lib/authz/portal";
import {
  ackMeetingAction,
  listMeetingAcksForProject,
  listMeetings,
  listParticipantsForProject,
} from "@/modules/meeting";
import { formatSeoul } from "@/lib/datetime";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId);
  const [rows, participants, acks] = await Promise.all([
    listMeetings(ctx, projectId, { publishedOnly: true }),
    listParticipantsForProject(ctx, projectId),
    listMeetingAcksForProject(ctx, projectId),
  ]);
  const acksByMeeting = new Map<string, typeof acks>();
  for (const ack of acks) {
    const list = acksByMeeting.get(ack.meetingId) ?? [];
    list.push(ack);
    acksByMeeting.set(ack.meetingId, list);
  }
  const byMeeting = new Map<string, string[]>();
  for (const row of participants) {
    const name = row.externalName ?? row.role ?? "";
    if (!name) continue;
    const list = byMeeting.get(row.meetingId) ?? [];
    list.push(name);
    byMeeting.set(row.meetingId, list);
  }
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-10">
      <div>
        <p className="gold-label">{messages.meetingsTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.meetingsTitle}</h1>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.noPublished}</p>
      ) : (
        <ul className="flex flex-col gap-6">
          {rows.map((row) => (
            <li key={row.id} className="paper-card">
              <p className="text-lg font-semibold">{row.title}</p>
              <p className="text-muted-foreground">{formatSeoul(row.meetingAt)}</p>
              {(byMeeting.get(row.id) ?? []).length > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {messages.participantsLabel}: {(byMeeting.get(row.id) ?? []).join(", ")}
                </p>
              ) : null}
              {row.minutes ? <p className="mt-3 whitespace-pre-wrap">{row.minutes}</p> : null}
              {row.decisions ? (
                <p className="mt-2 whitespace-pre-wrap">{row.decisions}</p>
              ) : null}
              {row.attachmentId ? (
                <a className="ghost-btn-sm mt-3" href={`/api/files/${row.attachmentId}?v=full`}>
                  {messages.attachmentLabel}
                </a>
              ) : null}
              <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
                {(acksByMeeting.get(row.id) ?? []).map((ack) => (
                  <li key={ack.id}>{ack.body}</li>
                ))}
              </ul>
              <form
                action={ackMeetingAction.bind(null, projectId, row.id)}
                className="mt-3 flex flex-col gap-2"
              >
                <textarea name="body" required className="field min-h-16" />
                <button type="submit" className="ghost-btn w-fit">
                  {messages.ackMeeting}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
