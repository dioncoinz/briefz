// src/app/(app)/layout.tsx
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <header className="topbar">
        <Link href="/projects" className="brand-link">
          <span className="brand-mark" aria-hidden="true" />
          Breifz
        </Link>

        <nav className="nav-actions">
          <Link href="/projects" className="action-link">
            Projects
          </Link>
          <Link href="/archive" className="action-link">
            Archive
          </Link>
          <Link href="/admin/users" className="action-link action-accent">
            Admin
          </Link>
        </nav>
      </header>

      {children}
    </div>
  );
}
