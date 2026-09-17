"use client";

import { useActionState } from "react";
import { submitContactAction } from "@/modules/page-builder/actions";
import { messages } from "@/lib/messages";
import { HX } from "@/lib/visuals";

export default function Page() {
  const [state, action] = useActionState(submitContactAction, null);
  return (
    <main className="hx-auth">
      <aside className="hx-auth-visual" aria-hidden>
        <img src={HX.cta} alt="" />
      </aside>
      <div className="hx-auth-panel">
        <p className="hx-kicker">{messages.contactTitle}</p>
        <h1>{messages.contactTitle}</h1>
        {state?.ok ? <p>{messages.contactSent}</p> : null}
        <form action={action} className="flex flex-col gap-4">
          <input name="title" required placeholder="제목" className="field" />
          <input name="contact" required placeholder={messages.emailLabel} className="field" />
          <textarea name="body" required className="field min-h-32" />
          {state && !state.ok ? <p className="text-destructive">{state.error}</p> : null}
          <button type="submit" className="ink-btn">
            {messages.contactSubmit}
          </button>
        </form>
      </div>
    </main>
  );
}
