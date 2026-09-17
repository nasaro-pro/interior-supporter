import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/auth";
import { acceptInvitation, lookupInvitation, postLoginPath } from "@/lib/authz";
import { messages } from "@/lib/messages";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await lookupInvitation(token);
  if (!invite || invite.expired) {
    return (
      <AuthShell title={messages.inviteExpired}>
        <p className="text-sm text-muted-foreground">{messages.inviteExpired}</p>
      </AuthShell>
    );
  }
  const session = await getSession();
  if (!session) {
    (await cookies()).set("invite_token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return (
      <AuthShell title={messages.inviteLoginNeeded}>
        <p className="text-sm text-muted-foreground">
          {messages.inviteLoginNeeded}
        </p>
        <Link href="/signup" className="ghost-btn">
          {messages.signupTitle}
        </Link>
        <Link href="/login" className="ghost-btn">
          {messages.loginTitle}
        </Link>
      </AuthShell>
    );
  }
  const result = await acceptInvitation(session.userId, token);
  if (!result.ok) {
    const reason =
      result.reason === "email_mismatch"
        ? messages.inviteEmailMismatch
        : messages.inviteExpired;
    return (
      <AuthShell title={reason}>
        <p className="text-sm text-muted-foreground">{reason}</p>
      </AuthShell>
    );
  }
  if (!result.invite) redirect("/login");
  if (result.invite.kind === "project_customer" && result.invite.projectId) {
    redirect(`/portal/${result.invite.projectId}/home`);
  }
  redirect(await postLoginPath(session.userId));
}
