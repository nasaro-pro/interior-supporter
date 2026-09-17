import { requireCompanyAdmin } from "@/lib/authz";
import {
  grantAssignmentAction,
  listAssignments,
  revokeAssignmentAction,
} from "@/modules/assignment";
import { listProjects } from "@/modules/project";
import { listCompanyMembers } from "@/modules/membership";
import { formatSeoul } from "@/lib/datetime";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyAdmin(companySlug);
  const [rows, projects, members] = await Promise.all([
    listAssignments(ctx),
    listProjects(ctx, { limit: 100 }),
    listCompanyMembers(ctx),
  ]);
  const people = new Map<string, { name: string; email: string }>();
  for (const row of members) {
    people.set(row.user.id, { name: row.user.name, email: row.user.email });
  }
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6">
      <h1 className="text-3xl">{messages.assignmentsTitle}</h1>
      <form
        action={grantAssignmentAction.bind(null, companySlug)}
        className="grid gap-2 md:grid-cols-2"
      >
        <select name="projectId" required className="h-9 rounded-md border border-input px-3">
          {projects.items.map((row) => (
            <option key={row.project.id} value={row.project.id}>
              {row.project.title}
            </option>
          ))}
        </select>
        <select name="userId" required className="h-9 rounded-md border border-input px-3">
          {[...people.entries()].map(([id, user]) => (
            <option key={id} value={id}>
              {user.name} ({user.email})
            </option>
          ))}
        </select>
        <select name="assignmentRole" className="h-9 rounded-md border border-input px-3">
          <option value="field_worker">{messages.assignmentRoleField}</option>
          <option value="designer">{messages.assignmentRoleDesigner}</option>
        </select>
        <input type="datetime-local" name="startsAt" required className="h-9 rounded-md border border-input px-3" />
        <input type="datetime-local" name="endsAt" className="h-9 rounded-md border border-input px-3" />
        <button type="submit" className="ink-btn">
          {messages.grantAssignment}
        </button>
      </form>
      <ul className="flex flex-col gap-3 text-sm">
        {rows.map(({ assignment, userName, projectTitle }) => (
          <li key={assignment.id} className="flex items-center justify-between border-t pt-2">
            <p>
              {projectTitle} · {userName} ·{" "}
              {assignment.assignmentRole === "designer"
                ? messages.assignmentRoleDesigner
                : messages.assignmentRoleField}{" "}
              · {formatSeoul(assignment.startsAt)}
            </p>
            <form action={revokeAssignmentAction.bind(null, companySlug, assignment.id)}>
              <button type="submit" className="danger-btn">
                {messages.revokeAssignment}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
