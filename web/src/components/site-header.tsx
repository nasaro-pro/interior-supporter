import type { ReactNode } from "react";
import Link from "next/link";
import { messages } from "@/lib/messages";

export function SiteHeader({
  brandHref = "/",
  brand,
  children,
  trailing,
}: {
  brandHref?: string;
  brand?: ReactNode;
  children?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href={brandHref} className="brand-mark">
          {brand ?? messages.brandName}
        </Link>
        {children ? <div className="tab-scroll">{children}</div> : null}
        <div className="site-header-actions">{trailing}</div>
      </div>
    </header>
  );
}
