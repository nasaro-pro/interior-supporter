import { requireCompanyAdmin } from "@/lib/authz";
import {
  listCompanyTemplates,
  listPromotionQueue,
  approvePromotionAction,
  rejectPromotionAction,
} from "@/modules/page-builder";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyAdmin(companySlug);
  const [rows, queue] = await Promise.all([
    listCompanyTemplates(ctx),
    listPromotionQueue(ctx),
  ]);
  const companyTemplates = rows.filter((row) => row.scope === "company");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl">{messages.templatesTitle}</h1>
      <section>
        <h2 className="mb-2 font-medium">{messages.requestPromotion}</h2>
        {queue.length === 0 ? <p className="text-sm text-muted-foreground">{messages.noItems}</p> : null}
        <ul className="flex flex-col gap-3 text-sm">
          {queue.map((row) => (
            <li key={row.id} className="border-t pt-2">
              <p>{row.name}</p>
              <form action={approvePromotionAction.bind(null, companySlug, row.id)}>
                <button type="submit" className="ghost-btn-sm">
                  {messages.approveTemplate}
                </button>
              </form>
              <form action={rejectPromotionAction.bind(null, companySlug, row.id)} className="mt-1 flex gap-2">
                <input name="note" required placeholder={messages.rejectNote} className="field flex-1" />
                <button type="submit" className="danger-btn">{messages.rejectTemplate}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-medium">{messages.templatesTitle}</h2>
        {companyTemplates.length === 0 ? <p className="text-sm">{messages.noItems}</p> : null}
        <ul className="text-sm">
          {companyTemplates.map((row) => (
            <li key={row.id}>{row.name}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
