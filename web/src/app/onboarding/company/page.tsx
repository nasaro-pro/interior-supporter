import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { CompanyForm } from "@/components/auth-forms";
import { messages } from "@/lib/messages";

export default async function Page() {
  const session = await requireSession();
  if (session.isPlatformAdmin) redirect("/platform");
  return (
    <AuthShell title={messages.onboardingTitle}>
      <CompanyForm />
    </AuthShell>
  );
}
