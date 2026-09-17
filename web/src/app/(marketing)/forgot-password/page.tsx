import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/auth-forms";
import { messages } from "@/lib/messages";

export default function Page() {
  return (
    <AuthShell title={messages.forgotTitle}>
      <p className="text-sm text-muted-foreground">{messages.forgotBody}</p>
      <ForgotForm />
    </AuthShell>
  );
}
