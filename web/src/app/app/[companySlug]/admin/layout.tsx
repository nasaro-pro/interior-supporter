import type { ReactNode } from "react";
import Link from "next/link";
import { requireCompanyStaff } from "@/lib/authz";
import { hasRole, isFieldOnly } from "@/lib/tenancy/context";
import { messages } from "@/lib/messages";
import { redirect } from "next/navigation";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyStaff(companySlug);
  if (isFieldOnly(ctx.roles)) {
    redirect(`/app/${companySlug}/field`);
  }
  const admin = hasRole(ctx, "company_admin");
  const base = `/app/${companySlug}/admin`;
  const staffLinks = [
    { href: base, label: messages.dashboardTitle },
    { href: `${base}/customers`, label: messages.customersTitle },
    { href: `${base}/projects`, label: messages.projectsTitle },
    { href: `${base}/notifications`, label: messages.notificationsTitle },
  ];
  const adminLinks = [
    { href: `${base}/members`, label: messages.membersTitle },
    { href: `${base}/assignments`, label: messages.assignmentsTitle },
    { href: `${base}/settings`, label: messages.settingsTitle },
    { href: `${base}/audit-log`, label: messages.auditLogTitle },
    { href: `${base}/templates`, label: messages.templatesTitle },
    { href: `${base}/storage`, label: messages.storageTitle },
  ];
  return (
    <div className="admin-shell">
      <aside className="admin-aside">
        {staffLinks.map((link) => (
          <Link key={link.href} href={link.href} className="nav-btn">
            {link.label}
          </Link>
        ))}
        {admin
          ? adminLinks.map((link) => (
              <Link key={link.href} href={link.href} className="nav-btn">
                {link.label}
              </Link>
            ))
          : null}
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
