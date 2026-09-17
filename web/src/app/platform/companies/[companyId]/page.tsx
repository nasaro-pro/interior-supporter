import { requirePlatformAdmin } from "@/lib/authz";
import { findCompanyById, changeCompanyStatusAction } from "@/modules/company";
import {
  listMembersByCompanyId,
  invitePlatformMemberAction,
  togglePlatformPmAction,
  deactivatePlatformMemberAction,
} from "@/modules/membership";
import { messages, planTierLabels } from "@/lib/messages";
import { notFound } from "next/navigation";

const statusLabel = {
  active: messages.companyStatusActive,
  past_due: messages.companyStatusPastDue,
  suspended: messages.companyStatusSuspended,
} as const;

export default async function Page({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const ctx = await requirePlatformAdmin("업체 상세 조회");
  const company = await findCompanyById(ctx, companyId);
  if (!company) notFound();
  const rows = await listMembersByCompanyId(ctx, companyId);
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
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <p className="gold-label">{messages.platformTitle}</p>
        <h1 className="mt-2 text-3xl">{company.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {company.slug} · {planTierLabels[company.planTier]} · {company.storageUsedMb}MB ·{" "}
          {statusLabel[company.status]}
        </p>
      </div>

      <form action={changeCompanyStatusAction.bind(null, companyId)} className="flex flex-wrap gap-2">
        <select name="status" defaultValue={company.status} className="field w-auto">
          <option value="active">{messages.companyStatusActive}</option>
          <option value="past_due">{messages.companyStatusPastDue}</option>
          <option value="suspended">{messages.companyStatusSuspended}</option>
        </select>
        <button type="submit" className="ghost-btn">
          {messages.saveCompanyStatus}
        </button>
      </form>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl">{messages.companyMembersTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{messages.platformInviteHelp}</p>
        </div>
        <form
          action={invitePlatformMemberAction.bind(null, companyId)}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            {messages.inviteEmailLabel}
            <input name="email" type="email" required className="field" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {messages.inviteRoleLabel}
            <select name="role" className="field">
              <option value="company_admin">{messages.roleAdmin}</option>
              <option value="project_manager">{messages.rolePm}</option>
            </select>
          </label>
          <button type="submit" className="ink-btn">
            {messages.inviteSubmit}
          </button>
        </form>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="py-2">{messages.nameLabel}</th>
              <th>{messages.emailLabel}</th>
              <th>{messages.inviteRoleLabel}</th>
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
                    {user.activeRoles.includes("company_admin") ? messages.roleAdmin : ""}
                    {user.activeRoles.includes("company_admin") && hasPm ? " · " : ""}
                    {hasPm ? messages.rolePm : ""}
                  </td>
                  <td>
                    {user.isActive ? messages.memberActive : messages.memberInactive}
                  </td>
                  <td className="flex gap-2 py-2">
                    {user.isActive ? (
                      <>
                        <form
                          action={togglePlatformPmAction.bind(
                            null,
                            companyId,
                            user.userId,
                            !hasPm,
                          )}
                        >
                          <button type="submit" className="ghost-btn-sm">
                            {hasPm ? messages.togglePmOff : messages.togglePmOn}
                          </button>
                        </form>
                        <form
                          action={deactivatePlatformMemberAction.bind(
                            null,
                            companyId,
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
      </section>
    </main>
  );
}
