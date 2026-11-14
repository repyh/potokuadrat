import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="folio-frame">
      <header className="site-navbar">
        <div className="navbar-inner">
          <Link className="navbar-brand" href="/" aria-label="Potokuadrat home">
            <span className="brand-stamp" aria-hidden="true">
              P
            </span>
            <span>Potokuadrat</span>
          </Link>
          <span className="navbar-user">Organizer access</span>
        </div>
      </header>

      <div className="folio-page auth-page">{children}</div>
    </main>
  );
}
