import type { ReactNode } from "react";
import Link from "next/link";
import { requirePlatformIdentity } from "@/lib/authz";
import { LogoutButton } from "@/components/logout-button";
import { SiteHeader } from "@/components/site-header";
import { messages } from "@/lib/messages";

export default async function Layout({ children }: { children: ReactNode }) {
  await requirePlatformIdentity();
  const links = [
    { href: "/platform/companies", label: messages.companiesTitle },
    { href: "/platform/templates", label: messages.templatesTitle },
    { href: "/platform/audit-log", label: messages.auditLogTitle },
    { href: "/platform/settings", label: messages.settingsTitle },
    { href: "/platform/billing", label: messages.billingTitle },
  ];
  return (
    <div className="min-h-full">
      <SiteHeader
        brandHref="/platform"
        brand={messages.platformTitle}
        trailing={<LogoutButton />}
      >
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="ghost-btn">
            {link.label}
          </Link>
        ))}
      </SiteHeader>
      {children}
    </div>
  );
}
