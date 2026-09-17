import type { ReactNode } from "react";
import Link from "next/link";
import { requireCompanyStaff } from "@/lib/authz";
import { isFieldOnly } from "@/lib/tenancy/context";
import { findCompanyBySlug } from "@/modules/company";
import { LogoutButton } from "@/components/logout-button";
import { SiteHeader } from "@/components/site-header";
import { messages } from "@/lib/messages";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const ctx = await requireCompanyStaff(companySlug);
  const company = await findCompanyBySlug(ctx, companySlug);
  const fieldOnly = isFieldOnly(ctx.roles);
  const home = fieldOnly
    ? `/app/${companySlug}/field`
    : `/app/${companySlug}/admin`;
  return (
    <div className="min-h-full">
      <SiteHeader
        brandHref={home}
        brand={company?.name ?? messages.brandName}
        trailing={<LogoutButton />}
      >
        {fieldOnly ? (
          <Link href={`/app/${companySlug}/field`} className="ghost-btn">
            {messages.fieldTodayTitle}
          </Link>
        ) : (
          <>
            <Link href={`/app/${companySlug}/projects`} className="ghost-btn">
              {messages.projectsTitle}
            </Link>
            <Link href={`/app/${companySlug}/admin`} className="ghost-btn">
              {messages.dashboardTitle}
            </Link>
          </>
        )}
      </SiteHeader>
      {children}
    </div>
  );
}
