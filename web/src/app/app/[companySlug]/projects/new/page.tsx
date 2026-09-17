import { requireCompanyStaff } from "@/lib/authz";
import { hasRole } from "@/lib/tenancy/context";
import { listCustomers } from "@/modules/customer";
import { createProjectAction } from "@/modules/project";
import { listCompanyMembers } from "@/modules/membership";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyStaff(companySlug);
  const [customers, members] = await Promise.all([
    listCustomers(ctx, { limit: 100 }),
    listCompanyMembers(ctx),
  ]);
  const pms = new Map<string, string>();
  for (const row of members) {
    if (row.membership.isActive && row.membership.role === "project_manager") {
      pms.set(row.user.id, row.user.name);
    }
  }
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl">{messages.createProject}</h1>
      <form
        action={createProjectAction.bind(null, companySlug)}
        className="grid gap-2 md:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          {messages.projectTitleLabel}
          <input name="title" required className="h-9 rounded-md border border-input px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.customerNameLabel}
          <select name="customerId" required className="h-9 rounded-md border border-input px-3">
            {customers.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {hasRole(ctx, "company_admin") ? (
          <label className="flex flex-col gap-1 text-sm">
            {messages.managerLabel}
            <select name="managerId" className="h-9 rounded-md border border-input px-3">
              {[...pms.entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-sm">{messages.managerSelf}</p>
        )}
        <label className="flex flex-col gap-1 text-sm">
          {messages.addressLabel}
          <input name="address" className="h-9 rounded-md border border-input px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.contractDateLabel}
          <input type="date" name="contractDate" className="h-9 rounded-md border border-input px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.startDateLabel}
          <input type="date" name="startDate" className="h-9 rounded-md border border-input px-3" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.endDateLabel}
          <input type="date" name="endDate" className="h-9 rounded-md border border-input px-3" />
        </label>
        <button
          type="submit"
          className="ink-btn"
        >
          {messages.createProject}
        </button>
      </form>
    </main>
  );
}
