import type { ReactNode } from "react";
import { getSession } from "@/lib/auth";
import { MarketingHeader } from "@/components/marketing/header";
import { MotionRoot } from "@/components/marketing/motion";
import { HX } from "@/lib/visuals";
import "./marketing.css";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <div className="is-marketing is-hx" style={{ ["--hx-bg" as string]: `url(${HX.bg})` }}>
      <MotionRoot>
        <div className="hx-shell">
          <MarketingHeader signedIn={Boolean(session)} />
          {children}
        </div>
      </MotionRoot>
    </div>
  );
}
