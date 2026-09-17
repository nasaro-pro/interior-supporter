import { requireCompanyAdmin } from "@/lib/authz";
import { listAuditLogs } from "@/modules/audit";
import { listCompanyMembers } from "@/modules/membership";
import { formatSeoul, parseSeoulDayEnd, parseSeoulInput } from "@/lib/datetime";
import {
  actorLabels,
  auditActionLabels,
  labelOf,
  messages,
} from "@/lib/messages";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string }>;
  searchParams: Promise<{
    cursor?: string;
    actionType?: string;
    actorId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { companySlug } = await params;
  const q = await searchParams;
  const ctx = await requireCompanyAdmin(companySlug);
  const [result, members] = await Promise.all([
    listAuditLogs(ctx, {
      cursor: q.cursor,
      actionType: q.actionType
        ? (q.actionType as NonNullable<
            Parameters<typeof listAuditLogs>[1]
          >["actionType"])
        : undefined,
      actorId: q.actorId || undefined,
      from: q.from ? parseSeoulInput(q.from) : undefined,
      to: q.to ? parseSeoulDayEnd(q.to) : undefined,
    }),
    listCompanyMembers(ctx),
  ]);
  const actors = new Map(members.map((m) => [m.user.id, m.user.name]));
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-3xl">{messages.auditLogTitle}</h1>
      <form className="flex flex-wrap gap-2 text-sm" method="get">
        <select
          name="actionType"
          defaultValue={q.actionType ?? ""}
          className="h-9 rounded-md border border-input px-3"
        >
          <option value="">{messages.filterAction}</option>
          {Object.entries(auditActionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="actorId" defaultValue={q.actorId ?? ""} className="h-9 rounded-md border border-input px-3">
          <option value="">{messages.filterActor}</option>
          {[...actors.entries()].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={q.from} className="h-9 rounded-md border border-input px-3" />
        <input type="date" name="to" defaultValue={q.to} className="h-9 rounded-md border border-input px-3" />
        <button type="submit" className="ghost-btn">
          {messages.applyFilter}
        </button>
      </form>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">{messages.filterAction}</th>
            <th>{messages.filterActor}</th>
            <th>대상</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((row) => (
            <tr key={row.log.id} className="border-t">
              <td className="py-2">
                {labelOf(auditActionLabels, row.log.actionType)}
              </td>
              <td>
                {row.actorName ?? "-"}
                <span className="ml-1 text-xs text-muted-foreground">
                  {labelOf(actorLabels, row.log.actorLabel)}
                </span>
              </td>
              <td>{row.log.targetType}</td>
              <td>{formatSeoul(row.log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.nextCursor ? (
        <a
          className="ghost-btn w-fit"
          href={`/app/${companySlug}/admin/audit-log?cursor=${encodeURIComponent(result.nextCursor)}`}
        >
          {messages.nextPage}
        </a>
      ) : null}
    </main>
  );
}
