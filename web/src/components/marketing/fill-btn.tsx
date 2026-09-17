import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M11.875 14.375L16.25 9.93818L11.875 5.625M16.25 9.93818H2.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function FillBtn({
  href,
  children,
  outline,
  variant,
  className,
}: {
  href: string;
  children: ReactNode;
  outline?: boolean;
  variant?: "solid" | "outline" | "hero" | "nav";
  className?: string;
}) {
  const kind = variant ?? (outline ? "outline" : "solid");
  const label = typeof children === "string" ? children : null;
  return (
    <Link href={href} className={cn("hx-fill", kind, className)}>
      <span className="hx-fill-bg" />
      <span className="hx-fill-label">
        {label ? (
          <>
            <span className="hx-lab top">{label}</span>
            <span className="hx-lab bot">{label}</span>
          </>
        ) : (
          children
        )}
      </span>
      {kind !== "nav" ? (
        <span className="hx-fill-icon">
          <span className="hx-ico top">
            <Arrow />
          </span>
          <span className="hx-ico bot">
            <Arrow />
          </span>
        </span>
      ) : null}
    </Link>
  );
}
