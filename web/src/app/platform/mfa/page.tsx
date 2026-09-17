import { requirePlatformIdentity } from "@/lib/authz";
import {
  hasEnrolledPlatformMfa,
  loadPendingPlatformMfa,
} from "@/lib/auth/platform-mfa";
import { confirmPlatformMfaAction } from "@/lib/auth/platform-mfa-actions";
import { messages } from "@/lib/messages";

export default async function Page() {
  const session = await requirePlatformIdentity();
  const enrolled = await hasEnrolledPlatformMfa(session.userId);
  const pending = enrolled
    ? null
    : await loadPendingPlatformMfa(
        session.userId,
        session.email,
        messages.platformTitle,
      );
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-6">
      <h1 className="text-3xl">{messages.mfaTitle}</h1>
      {pending ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>{messages.mfaSecretHint}</p>
          <code className="break-all rounded-md border border-input px-3 py-2">
            {pending.secret}
          </code>
          <p className="break-all text-muted-foreground">{pending.uri}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{messages.mfaCodeLabel}</p>
      )}
      <form action={confirmPlatformMfaAction} className="flex flex-col gap-3">
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          minLength={6}
          maxLength={6}
          placeholder={messages.mfaCodeLabel}
          className="h-11 rounded-md border border-input px-3"
        />
        <button type="submit" className="ink-btn">
          {messages.mfaSubmit}
        </button>
      </form>
    </main>
  );
}
