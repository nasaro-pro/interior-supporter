import type { ReactNode } from "react";
import { messages } from "@/lib/messages";
import { HX } from "@/lib/visuals";

export function AuthShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="hx-auth">
      <aside className="hx-auth-visual" aria-hidden>
        <img src={HX.heroDetail} alt="" />
      </aside>
      <div className="hx-auth-panel">
        <p className="hx-kicker">{messages.landingKicker}</p>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  );
}
