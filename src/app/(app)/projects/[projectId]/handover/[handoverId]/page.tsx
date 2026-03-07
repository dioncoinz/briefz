import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function HandoverLogDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; handoverId: string }>;
}) {
  const { projectId, handoverId } = await params;
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

  const { data: handover } = await supabase
    .from("handovers")
    .select("id, notes, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("project_id", project.id)
    .eq("id", handoverId)
    .single();

  if (!handover) {
    return <main style={{ color: "crimson" }}>Handover log entry not found.</main>;
  }

  const notesText = typeof handover.notes === "string" ? handover.notes : "";
  const titleLine = notesText
    .split("\n")
    .find((line) => line.trim().startsWith("Handover:"));
  const title = titleLine ? titleLine.replace("Handover:", "").trim() : "Handover log";

  const { data: photos } = await supabase
    .from("handover_photos")
    .select("id, storage_path, caption, created_at")
    .eq("tenant_id", profile.tenant_id)
    .eq("handover_id", handover.id)
    .order("created_at", { ascending: true });

  const signedMap = new Map<string, string>();
  if ((photos || []).length > 0) {
    const signed = await Promise.all(
      (photos || []).map(async (photo) => {
        const { data } = await supabase.storage
          .from("breifz-photos")
          .createSignedUrl(photo.storage_path, 60 * 60);
        return { id: photo.id, url: data?.signedUrl || null };
      })
    );

    signed.forEach((s) => {
      if (s.url) signedMap.set(s.id, s.url);
    });
  }

  return (
    <main style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>{title}</h1>
      <div style={{ color: "#555", marginTop: 6 }}>{project.name}</div>
      <div style={{ color: "#555", marginTop: 4 }}>
        Saved {new Date(handover.created_at).toLocaleString()}
      </div>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>Handover notes</div>
        <pre
          style={{
            marginTop: 8,
            whiteSpace: "pre-wrap",
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 12,
            background: "#fafafa",
          }}
        >
          {notesText}
        </pre>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>Photo records</div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {(photos || []).map((photo) => (
            <div
              key={photo.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 10,
                background: "#fafafa",
              }}
            >
              {signedMap.get(photo.id) ? (
                <img
                  src={signedMap.get(photo.id)}
                  alt={photo.caption || "Handover photo"}
                  style={{
                    width: "100%",
                    maxHeight: 420,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid #eee",
                  }}
                />
              ) : (
                <div style={{ color: "#666" }}>Unable to load image preview.</div>
              )}
              <div style={{ fontWeight: 800 }}>{photo.caption || "(No caption)"}</div>
            </div>
          ))}
          {(photos || []).length === 0 && <div style={{ color: "#666" }}>No photos recorded.</div>}
        </div>
      </section>

      <div style={{ marginTop: 18 }}>
        <Link href={`/projects/${project.id}`}>Back to project</Link>
      </div>
    </main>
  );
}
