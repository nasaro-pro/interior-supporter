import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth-forms";
import { messages } from "@/lib/messages";

export default function Page() {
  return (
    <AuthShell title={messages.loginTitle}>
      <LoginForm />
      <Link href="/forgot-password" className="ghost-btn">
        {messages.toForgot}
      </Link>
      <Link href="/signup" className="ghost-btn">
        {messages.toSignup}
      </Link>
    </AuthShell>
  );
}
