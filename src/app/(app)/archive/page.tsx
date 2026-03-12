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
      <h1 className="section-title">Archive</h1>

      {error && <div className="status-error">{error.message}</div>}

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {(projects || []).map((p) => (
          <Link key={p.id} href={`/archive/${p.id}`} className="card-link">
            <div className="card-link-title">{p.name}</div>
            <div className="muted" style={{ marginTop: 4 }}>
              {formatDateDDMMYYYY(p.start_date)} - {formatDateDDMMYYYY(p.end_date)}
            </div>
            <div className="muted" style={{ marginTop: 4 }}>
              Archived: {formatDateDDMMYYYY(p.archived_at)}
            </div>
          </Link>
        ))}

        {(projects || []).length === 0 && (
          <div className="muted" style={{ marginTop: 18 }}>No archived projects yet.</div>
        )}
      </div>
    </main>
  );
}
