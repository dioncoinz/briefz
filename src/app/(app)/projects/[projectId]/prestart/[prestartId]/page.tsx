import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function PrestartLogDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; prestartId: string }>;
}) {
  const { projectId, prestartId } = await params;
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

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("tenant_id", profile.tenant_id)
    .eq("id", projectId)
    .single();

  if (!project) {
    return <main style={{ color: "crimson" }}>Project not found.</main>;
  }

  const { data: prestart } = await supabase
    .from("prestarts")
    .select("id, handover_summary, notes, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("project_id", project.id)
    .eq("id", prestartId)
    .single();

  if (!prestart) {
    return <main style={{ color: "crimson" }}>Prestart log entry not found.</main>;
  }

  const notesText = typeof prestart.notes === "string" ? prestart.notes : "";
  const titleLine = notesText
    .split("\n")
    .find((line: string) => line.trim().startsWith("Prestart:"));
  const title = titleLine ? titleLine.replace("Prestart:", "").trim() : "Prestart log";

  return (
    <main style={{ maxWidth: 860 }}>
      <h1 className="section-title">{title}</h1>
      <div className="section-subtitle">{project.name}</div>
      <div className="muted" style={{ marginTop: 4 }}>
        Saved {new Date(prestart.created_at).toLocaleString()}
      </div>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>Handover summary</div>
        <pre className="content-pre">
          {prestart.handover_summary}
        </pre>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>Prestart notes</div>
        <pre className="content-pre">
          {notesText}
        </pre>
      </section>

      <div style={{ marginTop: 18 }}>
        <Link href={`/projects/${project.id}`} className="action-link">
          Back to project
        </Link>
      </div>
    </main>
  );
}
