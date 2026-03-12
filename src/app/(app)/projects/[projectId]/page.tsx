import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatDateDDMMYYYY } from "@/lib/date";

const CURRENT_HANDOVER_MARKER = "[[CURRENT_HANDOVER]]";

export default async function ProjectDetailPage({
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

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, start_date, end_date, archived_at")
    .eq("id", projectId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (!project) return <main>Project not found.</main>;

  const { data: prestarts } = await supabase
    .from("prestarts")
    .select("id, notes, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: handovers } = await supabase
    .from("handovers")
    .select("id, notes, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("project_id", project.id)
    .not("notes", "like", `${CURRENT_HANDOVER_MARKER}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: currentRows } = await supabase
    .from("handovers")
    .select("id, notes, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("project_id", project.id)
    .like("notes", `${CURRENT_HANDOVER_MARKER}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  const currentHandover = (currentRows || [])[0];

  return (
    <main>
      <h1 className="section-title">{project.name}</h1>
      <div className="section-subtitle">
        {formatDateDDMMYYYY(project.start_date)} - {formatDateDDMMYYYY(project.end_date)}
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 18, maxWidth: 520 }}>
        <Link href={`/projects/${project.id}/handover`} className="action-link block-link action-soft">
          Supervisor Handover
        </Link>

        <Link href={`/projects/${project.id}/prestart`} className="action-link block-link">
          Prestart Meeting
        </Link>
      </div>

      {currentHandover && (
        <section style={{ marginTop: 20, maxWidth: 760 }}>
          <Link
            href={`/projects/${project.id}/handover`}
            className="action-link block-link"
            style={{ background: "var(--success-bg)", borderColor: "var(--success-border)" }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#1dbf50",
                display: "inline-block",
              }}
            />
            Current handover in progress
          </Link>
        </section>
      )}

      <section style={{ marginTop: 24, maxWidth: 760 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Prestart log</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {(prestarts || []).map((entry) => {
            const notesText = typeof entry.notes === "string" ? entry.notes : "";
            const firstLine = notesText.split("\n").find((line: string) => line.trim()) || "";
            const match = firstLine.match(
              /prestart[:\s-]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})\s*-\s*(days|nights)/i
            );

            const dateValue = match?.[1] || entry.created_at;
            const shiftValue = match?.[2]
              ? match[2][0].toUpperCase() + match[2].slice(1).toLowerCase()
              : "Days";
            const label = `${formatDateDDMMYYYY(dateValue)} - ${shiftValue}`;

            return (
              <div key={entry.id} className="list-row">
                <Link
                  href={`/projects/${project.id}/prestart/${entry.id}`}
                  className="action-link block-link"
                  style={{
                    flex: 1,
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{label}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Saved {new Date(entry.created_at).toLocaleString()}
                  </div>
                </Link>

                <form
                  action={`/api/projects/${project.id}/prestart/${entry.id}/delete`}
                  method="post"
                >
                  <button
                    aria-label="Delete prestart"
                    title="Delete prestart"
                    className="action-button action-danger"
                    style={{ width: 66, minHeight: 42, padding: 0, fontSize: 13, lineHeight: 1 }}
                  >
                    Delete
                  </button>
                </form>
              </div>
            );
          })}

          {(prestarts || []).length === 0 && (
            <div className="muted">No prestarts logged yet.</div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 24, maxWidth: 760 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Handover log</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {(handovers || []).map((entry) => {
            const notesText = typeof entry.notes === "string" ? entry.notes : "";
            const firstLine = notesText.split("\n").find((line: string) => line.trim()) || "";
            const match = firstLine.match(
              /handover[:\s-]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})\s*-\s*(days|nights)/i
            );

            const dateValue = match?.[1] || entry.created_at;
            const shiftValue = match?.[2]
              ? match[2][0].toUpperCase() + match[2].slice(1).toLowerCase()
              : "Days";
            const label = `${formatDateDDMMYYYY(dateValue)} - ${shiftValue}`;

            return (
              <div key={entry.id} className="list-row">
                <Link
                  href={`/projects/${project.id}/handover/${entry.id}`}
                  className="action-link block-link"
                  style={{
                    flex: 1,
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{label}</div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    Saved {new Date(entry.created_at).toLocaleString()}
                  </div>
                </Link>

                <form
                  action={`/api/projects/${project.id}/handover/${entry.id}/delete`}
                  method="post"
                >
                  <button
                    aria-label="Delete handover"
                    title="Delete handover"
                    className="action-button action-danger"
                    style={{ width: 66, minHeight: 42, padding: 0, fontSize: 13, lineHeight: 1 }}
                  >
                    Delete
                  </button>
                </form>
              </div>
            );
          })}

          {(handovers || []).length === 0 && (
            <div className="muted">No handovers logged yet.</div>
          )}
        </div>
      </section>

      {!project.archived_at && (
        <div style={{ marginTop: 18 }}>
          <form action={`/api/projects/${project.id}/archive`} method="post">
            <button className="action-button">Archive project</button>
          </form>
        </div>
      )}

      {project.archived_at && (
        <div style={{ marginTop: 18 }}>
          <Link href={`/archive/${project.id}`} className="action-link">
            View archive exports
          </Link>
        </div>
      )}
    </main>
  );
}
