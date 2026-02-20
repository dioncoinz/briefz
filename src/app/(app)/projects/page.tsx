import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatDateDDMMYYYY } from "@/lib/date";

export default async function ProjectsPage() {
  const supabase = await createSupabaseServer();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, full_name")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, start_date, end_date, archived_at, created_at")
    .eq("tenant_id", tenantId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  return (
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>Projects</div>
          <div style={{ color: "#555" }}>
            {profile?.full_name ? `Welcome, ${profile.full_name}` : "Welcome"}
          </div>
        </div>
        <Link
          href="/projects/new"
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "black",
            color: "white",
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          + New project
        </Link>
      </div>

      {error && <div style={{ color: "crimson", marginTop: 12 }}>{error.message}</div>}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {(projects || []).map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            style={{
              border: "1px solid #eee",
              borderRadius: 14,
              padding: 14,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>{p.name}</div>
            <div style={{ color: "#555", marginTop: 4 }}>
              {formatDateDDMMYYYY(p.start_date)} - {formatDateDDMMYYYY(p.end_date)}
            </div>
          </Link>
        ))}

        {(projects || []).length === 0 && (
          <div style={{ marginTop: 18, color: "#555" }}>No active projects yet - create one.</div>
        )}
      </div>
    </main>
  );
}
