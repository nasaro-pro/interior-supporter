import { requireProjectAccess } from "@/lib/authz/portal";
import { listSchedules } from "@/modules/schedule";
import { formatSeoul, seoulMonthValue } from "@/lib/datetime";
import { messages } from "@/lib/messages";
import { ProcessTimeline } from "@/components/schedule/process-timeline";
import { SundayMonthCalendar } from "@/components/schedule/sunday-month-calendar";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireProjectAccess(projectId);
  const rows = await listSchedules(ctx, projectId, undefined, { publishedOnly: true });
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10">
      <div>
        <p className="gold-label">{messages.scheduleTitle}</p>
        <h1 className="mt-2 text-3xl">{messages.scheduleTitle}</h1>
      </div>
      <SundayMonthCalendar
        monthValue={seoulMonthValue()}
        items={rows.map((row) => ({
          id: row.id,
          title: row.title,
          startAt: row.startAt,
          type: row.type,
        }))}
      />
      <ProcessTimeline
        items={rows.map((row) => ({
          id: row.id,
          title: row.title,
          startAt: row.startAt,
          endAt: row.endAt,
          processCategory: row.processCategory,
          type: row.type,
        }))}
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.noPublished}</p>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="paper-card">
              <p className="text-lg font-semibold">{row.title}</p>
              <p className="text-muted-foreground">{formatSeoul(row.startAt)}</p>
              {row.note ? <p>{row.note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
