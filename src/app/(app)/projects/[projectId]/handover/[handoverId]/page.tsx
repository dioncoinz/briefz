import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatDateTimeAU, formatLogEntryDateDDMMYYYY } from "@/lib/date";

const HANDOVER_SECTION_LABELS = [
  "Handover",
  "Entering Supervisor",
  "Exiting Supervisor",
  "Safety / focus for the shift / incidents",
  "Issues / concerns / priorities",
  "Work status",
  "General",
  "Delays",
  "Follow-up required",
];

type HandoverSection = {
  label: string | null;
  value: string;
};

function formatHandoverNotes(notes: string): HandoverSection[] {
  const sections: HandoverSection[] = [];
  let current: HandoverSection = { label: null, value: "" };

  const saveCurrent = () => {
    const value = current.value.trim();
    if (current.label || value) sections.push({ ...current, value });
  };

  notes
    .replace(/^\[\[CURRENT_HANDOVER\]\]\r?\n?/, "")
    .split(/\r?\n/)
    .forEach((line) => {
      const sectionLabel = HANDOVER_SECTION_LABELS.find((label) =>
        line.toLowerCase().startsWith(`${label.toLowerCase()}:`)
      );
      const photoMatch = line.match(/^(\[Photo \d+\])\s*(.*)$/i);

      if (sectionLabel) {
        saveCurrent();
        current = {
          label: sectionLabel,
          value: line.slice(sectionLabel.length + 1).trimStart(),
        };
        return;
      }

      if (photoMatch) {
        saveCurrent();
        current = { label: photoMatch[1], value: photoMatch[2] };
        return;
      }

      current.value += `${current.value ? "\n" : ""}${line}`;
    });

  saveCurrent();
  return sections;
}

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
    .select("id, name, start_date, end_date")
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
  const noteSections = formatHandoverNotes(notesText);
  const titleLine = notesText
    .split("\n")
    .find((line: string) => line.trim().startsWith("Handover:"));
  const titleMatch = titleLine?.match(
    /handover[:\s-]*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}\/[0-9]{2}\/[0-9]{4})\s*-\s*(days|nights)/i
  );
  const title = titleMatch
    ? `${formatLogEntryDateDDMMYYYY(titleMatch[1], project.start_date, project.end_date)} - ${
        titleMatch[2][0].toUpperCase() + titleMatch[2].slice(1).toLowerCase()
      }`
    : titleLine ? titleLine.replace("Handover:", "").trim() : "Handover log";

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
          .from("briefz-photos")
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
      <h1 className="section-title">{title}</h1>
      <div className="section-subtitle">{project.name}</div>
      <div className="muted" style={{ marginTop: 4 }}>
        Saved {formatDateTimeAU(handover.created_at)}
      </div>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>Handover notes</div>
        <div className="content-pre" style={{ display: "grid", gap: 18 }}>
          {noteSections.map((section, index) => (
            <div key={`${section.label || "note"}-${index}`}>
              {section.label && (
                <div style={{ fontWeight: 900 }}>{section.label}:</div>
              )}
              {section.value && (
                <div style={{ marginTop: section.label ? 4 : 0, whiteSpace: "pre-wrap" }}>
                  {section.value}
                </div>
              )}
            </div>
          ))}
          {noteSections.length === 0 && <div className="muted">No notes recorded.</div>}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>Photo records</div>
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {(photos || []).map((photo) => (
            <div
              key={photo.id}
              className="panel-soft"
              style={{ padding: 10 }}
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
                    border: "1px solid var(--border)",
                  }}
                />
              ) : (
                <div className="muted">Unable to load image preview.</div>
              )}
              <div style={{ fontWeight: 400 }}>{photo.caption || "(No caption)"}</div>
            </div>
          ))}
          {(photos || []).length === 0 && <div className="muted">No photos recorded.</div>}
        </div>
      </section>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/projects/${project.id}/handover?edit=${handover.id}`} className="action-link action-primary">
          Edit handover
        </Link>
        <Link href={`/projects/${project.id}`} className="action-link">
          Back to project
        </Link>
      </div>
    </main>
  );
}
