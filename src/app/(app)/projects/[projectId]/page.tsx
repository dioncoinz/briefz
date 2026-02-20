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
      <div style={{ fontSize: 24, fontWeight: 900 }}>{project.name}</div>
      <div style={{ color: "#555", marginTop: 6 }}>
        {formatDateDDMMYYYY(project.start_date)} - {formatDateDDMMYYYY(project.end_date)}
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 18, maxWidth: 520 }}>
        <Link
          href={`/projects/${project.id}/handover`}
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 14,
            textDecoration: "none",
            color: "inherit",
            fontWeight: 900,
          }}
        >
          Supervisor Handover
        </Link>

        <Link
          href={`/projects/${project.id}/prestart`}
          style={{
            border: "1px solid #eee",
            borderRadius: 14,
            padding: 14,
            textDecoration: "none",
            color: "inherit",
            fontWeight: 900,
          }}
        >
          Prestart Meeting
        </Link>
      </div>

      {currentHandover && (
        <section style={{ marginTop: 20, maxWidth: 760 }}>
          <Link
            href={`/projects/${project.id}/handover`}
            style={{
              border: "1px solid #b8eac9",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "inherit",
              background: "#f1fcf5",
              fontWeight: 900,
            }}
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
            const firstLine = entry.notes?.split("\n").find((line) => line.trim()) || "";
            const match = firstLine.match(
              /prestart[:\s-]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})\s*-\s*(days|nights)/i
            );

            const dateValue = match?.[1] || entry.created_at;
            const shiftValue = match?.[2]
              ? match[2][0].toUpperCase() + match[2].slice(1).toLowerCase()
              : "Days";
            const label = `${formatDateDDMMYYYY(dateValue)} - ${shiftValue}`;

            return (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Link
                  href={`/projects/${project.id}/prestart/${entry.id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block", flex: 1 }}
                >
                  <div style={{ fontWeight: 900 }}>{label}</div>
                  <div style={{ color: "#666", marginTop: 4 }}>
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
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "white",
                      fontSize: 16,
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    🗑
                  </button>
                </form>
              </div>
            );
          })}

          {(prestarts || []).length === 0 && (
            <div style={{ color: "#666" }}>No prestarts logged yet.</div>
          )}
        </div>
      </section>

      <section style={{ marginTop: 24, maxWidth: 760 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>Handover log</div>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          {(handovers || []).map((entry) => {
            const firstLine = entry.notes?.split("\n").find((line) => line.trim()) || "";
            const match = firstLine.match(
              /handover[:\s-]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})\s*-\s*(days|nights)/i
            );

            const dateValue = match?.[1] || entry.created_at;
            const shiftValue = match?.[2]
              ? match[2][0].toUpperCase() + match[2].slice(1).toLowerCase()
              : "Days";
            const label = `${formatDateDDMMYYYY(dateValue)} - ${shiftValue}`;

            return (
              <div
                key={entry.id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: 10,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Link
                  href={`/projects/${project.id}/handover/${entry.id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block", flex: 1 }}
                >
                  <div style={{ fontWeight: 900 }}>{label}</div>
                  <div style={{ color: "#666", marginTop: 4 }}>
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
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "white",
                      fontSize: 16,
                      lineHeight: 1,
                      cursor: "pointer",
                    }}
                  >
                    🗑
                  </button>
                </form>
              </div>
            );
          })}

          {(handovers || []).length === 0 && (
            <div style={{ color: "#666" }}>No handovers logged yet.</div>
          )}
        </div>
      </section>

      {!project.archived_at && (
        <div style={{ marginTop: 18 }}>
          <form action={`/api/projects/${project.id}/archive`} method="post">
            <button
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #ddd",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Archive project
            </button>
          </form>
        </div>
      )}

      {project.archived_at && (
        <div style={{ marginTop: 18 }}>
          <Link href={`/archive/${project.id}`}>View archive exports</Link>
        </div>
      )}
    </main>
  );
}
