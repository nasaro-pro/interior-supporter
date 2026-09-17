import { requireCompanyStaff } from "@/lib/authz";
import {
  createCustomerAction,
  listCustomers,
  updateCustomerAction,
} from "@/modules/customer";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string }>;
  searchParams: Promise<{ cursor?: string; edit?: string }>;
}) {
  const { companySlug } = await params;
  const { cursor, edit } = await searchParams;
  const ctx = await requireCompanyStaff(companySlug);
  const { items, nextCursor } = await listCustomers(ctx, { cursor });
  const editing = items.find((c) => c.id === edit);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <h1 className="text-3xl">{messages.customersTitle}</h1>
      <form
        action={
          editing
            ? updateCustomerAction.bind(null, companySlug, editing.id)
            : createCustomerAction.bind(null, companySlug)
        }
        className="grid gap-2 md:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          {messages.customerNameLabel}
          <input
            name="name"
            required
            defaultValue={editing?.name}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.phoneLabel}
          <input
            name="phone"
            defaultValue={editing?.phone ?? ""}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.emailLabel}
          <input
            name="email"
            type="email"
            defaultValue={editing?.email ?? ""}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          {messages.memoLabel}
          <textarea
            name="memo"
            defaultValue={editing?.memo ?? ""}
            className="rounded-md border border-input px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="ink-btn"
        >
          {editing ? messages.saveCustomer : messages.createCustomer}
        </button>
      </form>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">{messages.customerNameLabel}</th>
            <th>{messages.phoneLabel}</th>
            <th>{messages.emailLabel}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-2">{row.name}</td>
              <td>{row.phone}</td>
              <td>{row.email}</td>
              <td>
                <a
                  className="ghost-btn-sm"
                  href={`/app/${companySlug}/admin/customers?edit=${row.id}`}
                >
                  {messages.saveCustomer}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor ? (
        <a
          className="ghost-btn w-fit"
          href={`/app/${companySlug}/admin/customers?cursor=${encodeURIComponent(nextCursor)}`}
        >
          {messages.nextPage}
        </a>
      ) : null}
    </main>
  );
}
