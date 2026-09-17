import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/auth-forms";
import { messages } from "@/lib/messages";

export default function Page() {
  return (
    <AuthShell title={messages.signupTitle}>
      <SignupForm />
      <Link href="/login" className="ghost-btn">
        {messages.toLogin}
      </Link>
    </AuthShell>
  );
}
