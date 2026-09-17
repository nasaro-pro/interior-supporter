import { requireCompanyStaff } from "@/lib/authz";
import { listInbox, markInboxReadAction } from "@/modules/notification";
import { formatSeoul } from "@/lib/datetime";
import { labelOf, messages, notifyEventLabels } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyStaff(companySlug);
  void companySlug;
  const rows = await listInbox(ctx.userId, 40);
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-5">
      <h1 className="text-2xl">{messages.notificationsBell}</h1>
      <ul className="flex flex-col gap-3 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="border-t pt-3">
            <p>{labelOf(notifyEventLabels, row.eventType)}</p>
            <p className="text-muted-foreground">{formatSeoul(row.createdAt)}</p>
            {row.readAt ? null : (
              <form action={markInboxReadAction.bind(null, row.id)}>
                <button type="submit" className="ghost-btn-sm mt-1">
                  {messages.notificationsBell}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p>{messages.noItems}</p> : null}
    </main>
  );
}
