// src/app/(app)/layout.tsx
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>
          <Link href="/projects" style={{ textDecoration: "none", color: "inherit" }}>
            Breifz
          </Link>
        </div>

        <nav style={{ display: "flex", gap: 14, fontWeight: 800 }}>
          <Link href="/projects">Projects</Link>
          <Link href="/archive">Archive</Link>
        </nav>
      </header>

      {children}
    </div>
  );
}
