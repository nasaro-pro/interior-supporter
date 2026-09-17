import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/auth-forms";
import { messages } from "@/lib/messages";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell title={messages.resetTitle}>
      <ResetForm token={token ?? ""} />
    </AuthShell>
  );
}
