import { requireCompanyStaff } from "@/lib/authz";
import { hasRole } from "@/lib/tenancy/context";
import { listProjects } from "@/modules/project";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { companySlug } = await params;
  const { cursor } = await searchParams;
  const ctx = await requireCompanyStaff(companySlug);
  const { items, nextCursor } = await listProjects(ctx, {
    cursor,
    managerId: hasRole(ctx, "company_admin") ? undefined : ctx.userId,
  });
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl">{messages.projectsTitle}</h1>
        <a
          className="ink-btn text-sm"
          href={`/app/${companySlug}/projects/new`}
        >
          {messages.createProject}
        </a>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">{messages.projectTitleLabel}</th>
            <th>{messages.customerNameLabel}</th>
            <th>{messages.managerLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.project.id} className="border-t">
              <td className="py-2">
                <a
                  className="text-link"
                  href={`/app/${companySlug}/projects/${row.project.id}/overview`}
                >
                  {row.project.title}
                </a>
              </td>
              <td>{row.customerName}</td>
              <td>{row.managerName}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {nextCursor ? (
        <a
          className="ghost-btn w-fit"
          href={`/app/${companySlug}/projects?cursor=${encodeURIComponent(nextCursor)}`}
        >
          {messages.nextPage}
        </a>
      ) : null}
    </main>
  );
}
