import { requireCompanyStaff } from "@/lib/authz";
import { hasRole } from "@/lib/tenancy";
import { listAuditLogs } from "@/modules/audit";
import { countActiveProjects, countProjectsByStatus } from "@/modules/project";
import { formatSeoul } from "@/lib/datetime";
import {
  auditActionLabels,
  labelOf,
  messages,
  projectStatusLabels,
} from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyStaff(companySlug);
  // 문서② 2.2 — 업체 감사로그 조회는 총관리자만. PM 에게는 본인 활동만 보인다.
  const isAdmin = hasRole(ctx, "company_admin");
  const [active, byStatus, recent] = await Promise.all([
    countActiveProjects(ctx),
    countProjectsByStatus(ctx),
    listAuditLogs(ctx, isAdmin ? { limit: 10 } : { limit: 10, actorId: ctx.userId }),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <h1 className="text-3xl">{messages.dashboardTitle}</h1>
      <p>
        {messages.activeProjects}: {active}
      </p>
      <ul className="text-sm">
        {byStatus.map((row) => (
          <li key={row.status}>
            {labelOf(projectStatusLabels, row.status)}: {row.n}
          </li>
        ))}
      </ul>
      <h2 className="font-medium">{messages.recentActivity}</h2>
      {recent.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{messages.noItems}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody>
            {recent.items.map((row) => (
              <tr key={row.log.id} className="border-t">
                <td className="py-2">
                  {labelOf(auditActionLabels, row.log.actionType)}
                </td>
                <td>{row.actorName}</td>
                <td>{formatSeoul(row.log.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
