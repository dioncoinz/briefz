import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatDateDDMMYYYY } from "@/lib/date";

export default async function ArchiveProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createSupabaseServer();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return <main style={{ color: "crimson" }}>Profile missing tenant.</main>;
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, start_date, end_date, archived_at")
    .eq("id", projectId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (projectError || !project) {
    return <main style={{ color: "crimson" }}>{projectError?.message || "Project not found."}</main>;
  }

  const { count: handoverCount } = await supabase
    .from("handovers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("project_id", project.id);

  const { count: prestartCount } = await supabase
    .from("prestarts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("project_id", project.id);

  return (
    <main style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Archive Export</h1>
      <div style={{ color: "#555", marginTop: 8 }}>{project.name}</div>
      <div style={{ color: "#555", marginTop: 4 }}>
        {formatDateDDMMYYYY(project.start_date)} - {formatDateDDMMYYYY(project.end_date)}
      </div>
      <div style={{ color: "#555", marginTop: 4 }}>
        Archived: {formatDateDDMMYYYY(project.archived_at)}
      </div>

      <div style={{ marginTop: 18, border: "1px solid #eee", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 900 }}>Included in export</div>
        <div style={{ color: "#555", marginTop: 8 }}>Handovers: {handoverCount || 0}</div>
        <div style={{ color: "#555", marginTop: 4 }}>Prestarts: {prestartCount || 0}</div>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <a
          href={`/api/archive/${project.id}/export?format=json`}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            background: "black",
            color: "white",
            fontWeight: 900,
            textDecoration: "none",
            width: "fit-content",
          }}
        >
          Download JSON export (MVP)
        </a>

        <div style={{ color: "#777" }}>DOCX export: planned next phase</div>
        <div style={{ color: "#777" }}>PDF export: planned next phase</div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/archive">Back to archive</Link>
      </div>
    </main>
  );
}
