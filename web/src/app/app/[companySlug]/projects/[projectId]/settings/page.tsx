import { requireProjectInCompany } from "@/lib/authz";
import { hasRole } from "@/lib/tenancy/context";
import {
  archiveProjectAction,
  findProjectById,
  updateProjectAction,
} from "@/modules/project";
import { listCustomers } from "@/modules/customer";
import { listCompanyMembers } from "@/modules/membership";
import { messages, processLabels, projectStatusLabels } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const [project, customers, members] = await Promise.all([
    findProjectById(ctx, projectId),
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <h2 className="text-2xl">{messages.projectSettingsTitle}</h2>
      <form
        action={updateProjectAction.bind(null, companySlug, projectId)}
        className="grid gap-2 md:grid-cols-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          {messages.projectTitleLabel}
          <input
            name="title"
            required
            defaultValue={project?.title}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.customerNameLabel}
          <select
            name="customerId"
            defaultValue={project?.customerId}
            className="h-9 rounded-md border border-input px-3"
          >
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
            <select
              name="managerId"
              defaultValue={project?.managerId}
              className="h-9 rounded-md border border-input px-3"
            >
              {[...pms.entries()].map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm md:col-span-2">
          {messages.addressLabel}
          <input
            name="address"
            defaultValue={project?.address ?? ""}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        {/* 문서① 4.3 — 고객 화면의 "현재 진행 단계" */}
        <label className="flex flex-col gap-1 text-sm">
          {messages.currentProcessLabel}
          <select
            name="currentProcess"
            defaultValue={project?.currentProcess ?? ""}
            className="h-9 rounded-md border border-input px-3"
          >
            <option value="">{messages.currentProcessNone}</option>
            {Object.entries(processLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.projectStatusLabel}
          <select
            name="status"
            defaultValue={project?.status ?? "active"}
            className="h-9 rounded-md border border-input px-3"
          >
            {Object.entries(projectStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.contractDateLabel}
          <input
            type="date"
            name="contractDate"
            defaultValue={project?.contractDate ?? ""}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.startDateLabel}
          <input
            type="date"
            name="startDate"
            defaultValue={project?.startDate ?? ""}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.endDateLabel}
          <input
            type="date"
            name="endDate"
            defaultValue={project?.endDate ?? ""}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <button
          type="submit"
          className="ink-btn md:col-span-2"
        >
          {messages.saveProject}
        </button>
      </form>
      <form action={archiveProjectAction.bind(null, companySlug, projectId)}>
        <button type="submit" className="danger-btn">
          {messages.archiveProject}
        </button>
      </form>
    </main>
  );
}
