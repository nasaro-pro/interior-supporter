import type { ReactNode } from "react";
import Link from "next/link";
import { requireCompanyStaff } from "@/lib/authz";
import { messages } from "@/lib/messages";

export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  await requireCompanyStaff(companySlug);
  const base = `/app/${companySlug}/field`;
  return (
    <div className="has-dock">
      <nav className="dock-tabs tab-scroll px-3 py-3 md:px-5">
        <Link href={base} className="nav-btn">
          {messages.fieldTodayTitle}
        </Link>
        <Link href={`${base}/projects`} className="nav-btn">
          {messages.fieldSitesTitle}
        </Link>
        <Link href={`${base}/notifications`} className="nav-btn">
          {messages.notificationsBell}
        </Link>
      </nav>
      {children}
    </div>
  );
}
