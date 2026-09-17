import Link from "next/link";
import { requireCompanyStaff } from "@/lib/authz";
import { listMyAssignments } from "@/modules/assignment";
import { listFieldLogsByProjects, updateFieldLogAction } from "@/modules/field-log";
import { listPhotosByProjects } from "@/modules/photo";
import { seoulDayValue } from "@/lib/datetime";
import { messages, processLabels } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyStaff(companySlug);
  const today = seoulDayValue();
  const assignments = await listMyAssignments(ctx, ctx.userId);
  const projectIds = assignments.map((row) => row.projectId);
  const [logs, photos] = await Promise.all([
    listFieldLogsByProjects(ctx, projectIds, today),
    listPhotosByProjects(ctx, projectIds, { shotDate: today }),
  ]);
  const logsByProject = new Map<string, typeof logs>();
  for (const row of logs) {
    const list = logsByProject.get(row.projectId) ?? [];
    list.push(row);
    logsByProject.set(row.projectId, list);
  }
  const photoCount = new Map<string, number>();
  for (const row of photos) {
    photoCount.set(row.projectId, (photoCount.get(row.projectId) ?? 0) + 1);
  }
  return (
    <main className="page-wrap mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <p className="gold-label">{today}</p>
        <h1 className="mt-2 text-3xl">{messages.fieldTodayTitle}</h1>
      </div>
      <p className="text-sm text-muted-foreground">{messages.fieldTodayHint}</p>
      <ul className="flex flex-col gap-4">
        {assignments.map((row) => {
          const todayLogs = logsByProject.get(row.projectId) ?? [];
          const openIssues = todayLogs.filter((log) => log.issue && log.issueStatus === "open");
          const unfinished = todayLogs.filter((log) => log.status !== "done");
          return (
            <li
              key={row.assignment.id}
              className="rounded-md border border-[var(--sand)] bg-[var(--paper)] px-4 py-5"
            >
              <p className="text-lg">{row.projectTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {messages.uploadPhotos}: {photoCount.get(row.projectId) ?? 0}
              </p>
              {todayLogs.length === 0 ? (
                <p className="mt-2 text-sm">{messages.noItems}</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {todayLogs.map((log) => (
                    <li key={log.id}>
                      {processLabels[log.processCategory]} ·{" "}
                      {log.status === "done"
                        ? messages.workLogStatusDone
                        : log.status === "in_progress"
                          ? messages.workLogStatusProgress
                          : messages.workLogStatusStarted}
                      {log.issue ? ` · ${messages.issueLabel}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {openIssues.length > 0 ? (
                <p className="mt-2 text-sm">{messages.fieldOpenIssue}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/app/${companySlug}/field/projects/${row.projectId}/log`}
                  className="ink-btn"
                >
                  {messages.fieldLogTitle}
                </Link>
                <Link
                  href={`/app/${companySlug}/field/projects/${row.projectId}/photos`}
                  className="ghost-btn"
                >
                  {messages.fieldPhotosTitle}
                </Link>
              </div>
              {unfinished.map((log) => (
                <form
                  key={log.id}
                  action={updateFieldLogAction.bind(null, companySlug, row.projectId, log.id)}
                  className="mt-2"
                >
                  <input type="hidden" name="processCategory" value={log.processCategory} />
                  <input type="hidden" name="body" value={log.body} />
                  <input type="hidden" name="issue" value={log.issue ?? ""} />
                  <input type="hidden" name="status" value="done" />
                  <button type="submit" className="ghost-btn-sm">
                    {messages.fieldCompleteWork}
                  </button>
                </form>
              ))}
            </li>
          );
        })}
      </ul>
      {assignments.length === 0 ? <p>{messages.noItems}</p> : null}
    </main>
  );
}
