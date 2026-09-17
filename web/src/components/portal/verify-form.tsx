"use client";

import { useState } from "react";
import { messages } from "@/lib/messages";

export function VerifyForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; remaining: number }>;
}) {
  const [state, setState] = useState<{ ok: boolean; remaining: number } | null>(
    null,
  );
  return (
    <form
      className="flex flex-col gap-3"
      action={async (formData) => {
        setState(await action(formData));
      }}
    >
      <input
        name="code"
        required
        autoComplete="one-time-code"
        className="field text-center font-mono tracking-widest"
        placeholder={messages.verifyTitle}
      />
      <button
        type="submit"
        className="ink-btn"
      >
        {messages.verifySubmit}
      </button>
      {state && !state.ok ? (
        <p className="text-sm text-destructive">
          {state.remaining === 0
            ? messages.verifyLocked
            : `${messages.verifyRemaining}: ${state.remaining}`}
        </p>
      ) : null}
    </form>
  );
}
