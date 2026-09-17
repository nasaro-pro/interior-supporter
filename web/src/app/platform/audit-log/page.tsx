import { requirePlatformAdmin } from "@/lib/authz";
import { listAuditLogs } from "@/modules/audit";
import { listCompanies } from "@/modules/company";
import { formatSeoul, parseSeoulDayEnd, parseSeoulInput } from "@/lib/datetime";
import { auditActionLabels, labelOf, messages } from "@/lib/messages";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    cursor?: string;
    companyId?: string;
    actionType?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const q = await searchParams;
  const ctx = await requirePlatformAdmin("전체 감사 로그 조회");
  const [result, companies] = await Promise.all([
    listAuditLogs(ctx, {
      cursor: q.cursor,
      companyId: q.companyId || undefined,
      actionType: q.actionType
        ? (q.actionType as NonNullable<Parameters<typeof listAuditLogs>[1]>["actionType"])
        : undefined,
      from: q.from ? parseSeoulInput(q.from) : undefined,
      to: q.to ? parseSeoulDayEnd(q.to) : undefined,
    }),
    listCompanies(ctx, { limit: 100 }),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-3xl">{messages.auditLogTitle}</h1>
      <form className="flex flex-wrap gap-2 text-sm" method="get">
        <select name="companyId" defaultValue={q.companyId ?? ""} className="h-9 rounded border px-2">
          <option value="">{messages.companiesTitle}</option>
          {companies.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="actionType" defaultValue={q.actionType ?? ""} className="h-9 rounded border px-2">
          <option value="">{messages.filterAction}</option>
          {Object.entries(auditActionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={q.from} className="h-9 rounded border px-2" />
        <input type="date" name="to" defaultValue={q.to} className="h-9 rounded border px-2" />
        <button type="submit" className="ghost-btn">
          {messages.applyFilter}
        </button>
      </form>
      <table className="w-full text-left text-sm">
        <tbody>
          {result.items.map((row) => (
            <tr key={row.log.id} className="border-t">
              <td className="py-2">{labelOf(auditActionLabels, row.log.actionType)}</td>
              <td>{row.actorName}</td>
              <td>{row.log.companyId}</td>
              <td>{formatSeoul(row.log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.nextCursor ? (
        <a className="ghost-btn w-fit" href={`/platform/audit-log?cursor=${encodeURIComponent(result.nextCursor)}`}>
          {messages.nextPage}
        </a>
      ) : null}
    </main>
  );
}
