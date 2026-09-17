"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PortalNav({
  tabs,
}: {
  tabs: Array<{ href: string; label: string }>;
}) {
  const path = usePathname();
  return (
    <nav className="tab-scroll">
      {tabs.map((tab) => {
        const active = path === tab.href || path.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "nav-btn nav-btn-active" : "nav-btn"}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
