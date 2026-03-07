// src/app/(app)/layout.tsx
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 20px 28px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          padding: "14px 18px",
          border: "1px solid #cfd7e3",
          background: "#f8fafd",
          borderRadius: 16,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 24, letterSpacing: 0.2 }}>
          <Link href="/projects" style={{ textDecoration: "none", color: "inherit" }}>
            Breifz
          </Link>
        </div>

        <nav style={{ display: "flex", gap: 10, fontWeight: 700 }}>
          <Link
            href="/projects"
            style={{ textDecoration: "none", color: "#334661", border: "1px solid #ced7e3", padding: "8px 14px", borderRadius: 12, background: "#fff" }}
          >
            Projects
          </Link>
          <Link
            href="/archive"
            style={{ textDecoration: "none", color: "#334661", border: "1px solid #ced7e3", padding: "8px 14px", borderRadius: 12, background: "#fff" }}
          >
            Archive
          </Link>
          <Link
            href="/admin/users"
            style={{ textDecoration: "none", color: "white", border: "1px solid #8f451f", padding: "8px 14px", borderRadius: 12, background: "#b8642c" }}
          >
            Admin
          </Link>
        </nav>
      </header>

      {children}
    </div>
  );
}
