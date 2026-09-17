import { requireCompanyAdmin } from "@/lib/authz";
import { messages } from "@/lib/messages";
import { listCompanyMembers } from "@/modules/membership";
import {
  deactivateMemberAction,
  inviteMemberAction,
  togglePmAction,
} from "@/modules/membership";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyAdmin(companySlug);
  const rows = await listCompanyMembers(ctx);
  const users = new Map<
    string,
    {
      name: string;
      email: string;
      activeRoles: string[];
      userId: string;
      isActive: boolean;
    }
  >();
  for (const row of rows) {
    const current = users.get(row.user.id) ?? {
      name: row.user.name,
      email: row.user.email,
      activeRoles: [],
      userId: row.user.id,
      isActive: false,
    };
    if (row.membership.isActive) {
      current.activeRoles.push(row.membership.role);
      current.isActive = true;
    }
    users.set(row.user.id, current);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-3xl">{messages.membersTitle}</h1>
      <form
        action={inviteMemberAction.bind(null, companySlug)}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          {messages.inviteEmailLabel}
          <input
            name="email"
            type="email"
            required
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {messages.inviteRoleLabel}
          <select name="role" className="h-9 rounded-md border border-input px-3">
            <option value="project_manager">{messages.rolePm}</option>
            <option value="field_worker">{messages.roleField}</option>
            <option value="company_admin">{messages.roleAdmin}</option>
          </select>
        </label>
        <button
          type="submit"
          className="ink-btn"
        >
          {messages.inviteSubmit}
        </button>
      </form>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2">{messages.nameLabel}</th>
            <th>{messages.emailLabel}</th>
            <th>역할</th>
            <th>{messages.memberStatus}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {[...users.values()].map((user) => {
            const hasPm = user.activeRoles.includes("project_manager");
            return (
              <tr key={user.userId} className="border-t">
                <td className="py-2">{user.name}</td>
                <td>{user.email}</td>
                <td>
                  {user.activeRoles.includes("company_admin")
                    ? messages.roleAdmin
                    : ""}
                  {user.activeRoles.includes("company_admin") && hasPm
                    ? " · "
                    : ""}
                  {user.activeRoles.includes("field_worker")
                    ? (user.activeRoles.length > 1 ? " · " : "") + messages.roleField
                    : ""}
                </td>
                <td>
                  {user.isActive ? messages.memberActive : messages.memberInactive}
                </td>
                <td className="flex gap-2 py-2">
                  {user.isActive ? (
                    <>
                      <form
                        action={togglePmAction.bind(
                          null,
                          companySlug,
                          user.userId,
                          !hasPm,
                        )}
                      >
                        <button type="submit" className="ghost-btn-sm">
                          {hasPm ? messages.togglePmOff : messages.togglePmOn}
                        </button>
                      </form>
                      <form
                        action={deactivateMemberAction.bind(
                          null,
                          companySlug,
                          user.userId,
                        )}
                      >
                        <button type="submit" className="danger-btn">
                          {messages.deactivateMember}
                        </button>
                      </form>
                    </>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
