import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatDateDDMMYYYY } from "@/lib/date";

export default async function ArchivePage() {
  const supabase = await createSupabaseServer();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.tenant_id;

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, start_date, end_date, archived_at")
    .eq("tenant_id", tenantId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });

  return (
    <main>
      <div style={{ fontSize: 24, fontWeight: 900 }}>Archive</div>

      {error && <div style={{ color: "crimson", marginTop: 12 }}>{error.message}</div>}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {(projects || []).map((p) => (
          <Link
            key={p.id}
            href={`/archive/${p.id}`}
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
            <div style={{ color: "#555", marginTop: 4 }}>
              Archived: {formatDateDDMMYYYY(p.archived_at)}
            </div>
          </Link>
        ))}

        {(projects || []).length === 0 && (
          <div style={{ marginTop: 18, color: "#555" }}>No archived projects yet.</div>
        )}
      </div>
    </main>
  );
}
