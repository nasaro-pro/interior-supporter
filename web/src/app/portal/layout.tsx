import type { ReactNode } from "react";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/authz/portal";
import { listInbox } from "@/modules/notification";
import { InboxBell } from "@/components/portal/inbox-bell";
import { LogoutButton } from "@/components/logout-button";
import { SiteHeader } from "@/components/site-header";
import { messages } from "@/lib/messages";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await requireCustomerSession();
  const inbox = await listInbox(session.userId);
  return (
    <div className="min-h-full overflow-x-hidden">
      <SiteHeader
        brandHref="/portal"
        brand={messages.portalHome}
        trailing={
          <>
            <InboxBell items={inbox} />
            <Link href="/portal/me" className="ghost-btn">
              {messages.portalMe}
            </Link>
            <LogoutButton />
          </>
        }
      />
      {children}
    </div>
  );
}
