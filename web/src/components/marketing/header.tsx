import type { ReactNode } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { messages } from "@/lib/messages";

function Mark() {
  return (
    <svg viewBox="0 0 34 39" fill="none" aria-hidden>
      <path
        d="M17 1.2 32.4 10.2v18.6L17 37.8 1.6 28.8V10.2L17 1.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M17 1.2V37.8M1.6 10.2h30.8M9.3 14.4V28.2M24.7 14.4V28.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function Dual({ children }: { children: string }) {
  return (
    <>
      <span className="hx-fill-bg" />
      <span className="hx-fill-label">
        <span className="hx-lab top">{children}</span>
        <span className="hx-lab bot">{children}</span>
      </span>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <div className="hx-nav-cell">
      <i className="hx-vline" />
      <Link href={href} className="hx-fill nav">
        <Dual>{children}</Dual>
      </Link>
    </div>
  );
}

function NavMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hx-nav-cell">
      <i className="hx-vline" />
      <details className="hx-nav-drop">
        <summary className="hx-fill nav">
          <Dual>{label}</Dual>
        </summary>
        <div className="hx-drop">{children}</div>
      </details>
    </div>
  );
}

export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="hx-header">
      <div className="hx-header-line top" />
      <div className="hx-header-inner">
        <Link href="/" className="hx-logo">
          <Mark />
          <span className="hx-wordmark">{messages.brandName}</span>
        </Link>
        <details className="hx-menu-toggle">
          <summary>{messages.landingMenu}</summary>
        </details>
        <nav className="hx-nav">
          <NavMenu label={messages.landingProduct}>
            <Link href="/#platform">{messages.landingPortal}</Link>
            <Link href="/#platform">{messages.landingWorkspace}</Link>
          </NavMenu>
          <NavLink href="/pricing">{messages.pricingTitle}</NavLink>
          <NavMenu label={messages.landingResources}>
            <Link href="/terms">{messages.termsTitle}</Link>
            <Link href="/privacy">{messages.privacyTitle}</Link>
          </NavMenu>
          <NavLink href="/#intro">{messages.landingAbout}</NavLink>
          <NavLink href="/contact">{messages.contactTitle}</NavLink>
          {signedIn ? (
            <div className="hx-nav-cell">
              <i className="hx-vline" />
              <LogoutButton className="hx-fill nav" />
            </div>
          ) : (
            <NavLink href="/login">{messages.loginTitle}</NavLink>
          )}
        </nav>
      </div>
      <div className="hx-header-line bot" />
    </header>
  );
}
