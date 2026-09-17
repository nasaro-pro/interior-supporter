import { requireProjectInCompany } from "@/lib/authz";
import {
  createCustomerInviteAction,
  issueCodeAction,
  listProjectParticipants,
  revokeAccessAction,
  updateAccessLabelAction,
} from "@/modules/access";
import { InvitePanel } from "@/components/portal/invite-panel";
import { IssueCodePanel } from "@/components/portal/issue-code";
import { formatSeoul } from "@/lib/datetime";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ companySlug: string; projectId: string }>;
}) {
  const { companySlug, projectId } = await params;
  const ctx = await requireProjectInCompany(companySlug, projectId);
  const rows = await listProjectParticipants(ctx, projectId);
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <h2 className="text-2xl">{messages.accessTitle}</h2>
      <InvitePanel action={createCustomerInviteAction.bind(null, companySlug, projectId)} />
      <IssueCodePanel action={issueCodeAction.bind(null, companySlug, projectId)} />
      <ul className="flex flex-col gap-4">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{messages.noItems}</p> : null}
        {rows.map(({ access, user, verified }) => (
          <li key={access.id} className="border-t pt-3 text-sm">
            <p>
              {user.name} · {user.email}
              {verified ? ` · ${messages.accessVerified}` : ""}
            </p>
            <p className="text-muted-foreground">
              {messages.accessGrantedAt}: {formatSeoul(access.grantedAt)}
            </p>
            <form
              className="mt-2 flex flex-wrap gap-2"
              action={updateAccessLabelAction.bind(null, companySlug, projectId, access.id)}
            >
              <input
                name="label"
                defaultValue={access.label ?? ""}
                placeholder={messages.accessLabel}
                className="h-8 rounded-md border border-input px-2"
              />
              <button type="submit" className="ghost-btn-sm">
                {messages.saveSettings}
              </button>
            </form>
            <form action={revokeAccessAction.bind(null, companySlug, projectId, access.id)}>
              <button type="submit" className="danger-btn mt-1">
                {messages.accessRevoke}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
