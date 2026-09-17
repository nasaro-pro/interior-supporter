import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/auth";
import { postLoginPath } from "@/lib/authz";
import { messages } from "@/lib/messages";

export default async function Page() {
  const session = await getSession();
  if (session?.emailVerified) {
    redirect(await postLoginPath(session.userId));
  }
  return (
    <AuthShell title={messages.verifyEmailTitle}>
      <p className="text-sm text-muted-foreground">{messages.verifyEmailBody}</p>
    </AuthShell>
  );
}
