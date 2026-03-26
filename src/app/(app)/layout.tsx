// src/app/(app)/layout.tsx
import Link from "next/link";
import { signOutAction } from "./actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <header className="topbar">
        <Link href="/projects" className="brand-link">
          Briefz
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
          <form action={signOutAction}>
            <button type="submit" className="action-button">
              Log out
            </button>
          </form>
        </nav>
      </header>

      {children}
    </div>
  );
}
