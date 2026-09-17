import { requireProjectInCompany } from "@/lib/authz";
import { findProjectById } from "@/modules/project";
import { findUserEmail } from "@/modules/membership";
import { listAuditLogs } from "@/modules/audit";
import { findNextSchedule } from "@/modules/schedule";
import { formatSeoul } from "@/lib/datetime";
import { auditActionLabels, labelOf, messages, processLabels } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const [project, recent, next] = await Promise.all([
    findProjectById(ctx, projectId),
    listAuditLogs(ctx, { projectId, limit: 8 }),
    findNextSchedule(ctx, projectId),
  ]);
  const manager = project
    ? await findUserEmail(ctx, project.managerId)
    : null;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h2 className="text-2xl">{messages.overviewTitle}</h2>
      <p>
        {messages.managerLabel}: {manager?.name}
      </p>
      <p>
        {messages.currentProcessLabel}:{" "}
        {project?.currentProcess
          ? processLabels[project.currentProcess]
          : "-"}
      </p>
      <div>
        <h3 className="font-medium">{messages.nextSchedule}</h3>
        {next ? (
          <p>
            {next.title} · {formatSeoul(next.startAt)}
          </p>
        ) : (
          <p>{messages.noItems}</p>
        )}
      </div>
      <div>
        <h3 className="font-medium">{messages.recentActivity}</h3>
        <ul className="text-sm">
          {recent.items.map((row) => (
            <li key={row.log.id}>
              {labelOf(auditActionLabels, row.log.actionType)} ·{" "}
              {formatSeoul(row.log.createdAt)}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
