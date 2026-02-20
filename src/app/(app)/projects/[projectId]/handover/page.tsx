"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import SpeechToTextButton from "@/components/SpeechToTextButton";
import { formatDateDDMMYYYY } from "@/lib/date";

const CURRENT_HANDOVER_MARKER = "[[CURRENT_HANDOVER]]";

type PhotoItem = {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
};

type SavedPhotoItem = {
  id: string;
  caption: string | null;
  storagePath: string;
  signedUrl: string | null;
};

function safeFileName(name: string) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";

  const cleanBase = base
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, "");
  return cleanExt ? `${cleanBase || "file"}.${cleanExt}` : cleanBase || "file";
}

export default function ProjectHandoverPage() {
  const params = useParams<{ projectId: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const supabase = createSupabaseBrowser();
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [savedPhotos, setSavedPhotos] = useState<SavedPhotoItem[]>([]);
  const [handoverDate, setHandoverDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<"days" | "nights">("days");
  const [currentHandoverId, setCurrentHandoverId] = useState<string | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, [photos]);

  async function loadSavedPhotos(tenantId: string, handoverId: string) {
    const { data: rows } = await supabase
      .from("handover_photos")
      .select("id, caption, storage_path")
      .eq("tenant_id", tenantId)
      .eq("handover_id", handoverId)
      .order("created_at", { ascending: true });

    if (!rows || rows.length === 0) {
      setSavedPhotos([]);
      return;
    }

    const signed = await Promise.all(
      rows.map(async (row) => {
        const { data } = await supabase.storage
          .from("breifz-photos")
          .createSignedUrl(row.storage_path, 60 * 60);

        return {
          id: row.id,
          caption: row.caption,
          storagePath: row.storage_path,
          signedUrl: data?.signedUrl || null,
        } satisfies SavedPhotoItem;
      })
    );

    setSavedPhotos(signed);
  }

  useEffect(() => {
    if (!projectId) return;
    let active = true;

    async function loadProjectName() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile?.tenant_id || !active) return;

      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("tenant_id", profile.tenant_id)
        .eq("id", projectId)
        .maybeSingle();

      if (project?.name && active) setProjectName(project.name);

      // Load in-progress current handover draft for this user/project if one exists.
      const { data: currentRows } = await supabase
        .from("handovers")
        .select("id, notes")
        .eq("tenant_id", profile.tenant_id)
        .eq("project_id", projectId)
        .eq("created_by", user.id)
        .like("notes", `${CURRENT_HANDOVER_MARKER}%`)
        .order("created_at", { ascending: false })
        .limit(1);

      const current = (currentRows || [])[0];
      if (!current || !active) {
        setSavedPhotos([]);
        return;
      }

      setCurrentHandoverId(current.id);

      const cleaned = current.notes.replace(`${CURRENT_HANDOVER_MARKER}\n`, "");
      const lines = cleaned.split("\n");
      const headerLine = lines.find((line) => line.startsWith("Handover:"));
      if (headerLine) {
        const match = headerLine.match(
          /Handover:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})\s*-\s*(Days|Nights)/i
        );
        if (match) {
          const [dd, mm, yyyy] = match[1].includes("/")
            ? match[1].split("/")
            : [match[1].slice(8, 10), match[1].slice(5, 7), match[1].slice(0, 4)];
          setHandoverDate(`${yyyy}-${mm}-${dd}`);
          setShift(match[2].toLowerCase() === "nights" ? "nights" : "days");
        }
      }

      const body = cleaned
        .split("\n")
        .filter((line) => !line.startsWith("Handover:") && !line.startsWith("[Photo "))
        .join("\n")
        .trim();
      setNotes(body);

      await loadSavedPhotos(profile.tenant_id, current.id);
    }

    loadProjectName();
    return () => {
      active = false;
    };
  }, [projectId, supabase]);

  function appendTranscript(text: string) {
    setNotes((prev) => (prev ? `${prev}${prev.endsWith(" ") ? "" : " "}${text}` : text));
  }

  function addPhotos(list: FileList | null) {
    if (!list?.length) return;
    const items: PhotoItem[] = Array.from(list).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: "",
    }));
    setPhotos((prev) => [...prev, ...items]);
  }

  function updatePhotoCaption(photoId: string, value: string) {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, caption: value } : p)));
  }

  function removePhoto(photoId: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === photoId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== photoId);
    });
  }

  function buildNarrative() {
    const handoverTitle = `${formatDateDDMMYYYY(handoverDate)} - ${shift === "days" ? "Days" : "Nights"}`;
    const lines: string[] = [`Handover: ${handoverTitle}`];

    const body = notes.trim();
    if (body) lines.push(body);

    photos.forEach((photo, idx) => {
      lines.push(`[Photo ${idx + 1}] ${photo.caption.trim() || photo.file.name}`);
    });

    return lines.join("\n\n");
  }

  async function uploadPhotosForHandover(args: {
    handoverId: string;
    tenantId: string;
    userId: string;
    projectId: string;
    photosToUpload: PhotoItem[];
  }) {
    const { handoverId, tenantId, userId, projectId, photosToUpload } = args;

    for (const photo of photosToUpload) {
      const sanitized = safeFileName(photo.file.name);
      const path = `tenant/${tenantId}/projects/${projectId}/handover/${handoverId}/${crypto.randomUUID()}-${sanitized}`;
      const { error: uploadError } = await supabase.storage.from("breifz-photos").upload(path, photo.file);

      if (uploadError) {
        throw new Error(`Photo upload failed: ${uploadError.message}`);
      }

      let { error: photoRowError } = await supabase.from("handover_photos").insert({
        handover_id: handoverId,
        project_id: projectId,
        tenant_id: tenantId,
        created_by: userId,
        storage_path: path,
        caption: photo.caption.trim(),
      });

      if (photoRowError?.message?.includes("project_id")) {
        const retry = await supabase.from("handover_photos").insert({
          handover_id: handoverId,
          tenant_id: tenantId,
          created_by: userId,
          storage_path: path,
          caption: photo.caption.trim(),
        });
        photoRowError = retry.error;
      }

      if (photoRowError) {
        throw new Error(`Photo record failed: ${photoRowError.message}`);
      }
    }
  }

  async function getContext() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(authError?.message || "Not logged in.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      throw new Error(profileError?.message || "Profile missing tenant.");
    }

    return { user, tenantId: profile.tenant_id };
  }

  async function onSaveCurrent() {
    if (!projectId) return;

    setCurrentLoading(true);
    setError(null);
    setSuccess(null);

    const missingCaption = photos.find((photo) => !photo.caption.trim());
    if (missingCaption) {
      setCurrentLoading(false);
      setError("Please add a caption for every photo before saving.");
      return;
    }

    try {
      const { user, tenantId } = await getContext();
      const narrative = buildNarrative();
      const draftNotes = `${CURRENT_HANDOVER_MARKER}\n${narrative}`;

      let handoverId = currentHandoverId;

      if (currentHandoverId) {
        const { error: updateError } = await supabase
          .from("handovers")
          .update({ notes: draftNotes })
          .eq("id", currentHandoverId)
          .eq("tenant_id", tenantId)
          .eq("project_id", projectId)
          .eq("created_by", user.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("handovers")
          .insert({
            tenant_id: tenantId,
            project_id: projectId,
            created_by: user.id,
            notes: draftNotes,
          })
          .select("id")
          .single();

        if (insertError || !inserted) throw new Error(insertError?.message || "Failed to save current.");
        handoverId = inserted.id;
        setCurrentHandoverId(inserted.id);
      }

      if (photos.length > 0 && handoverId) {
        await uploadPhotosForHandover({
          handoverId,
          tenantId,
          userId: user.id,
          projectId,
          photosToUpload: photos,
        });

        photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
        setPhotos([]);
        await loadSavedPhotos(tenantId, handoverId);
      }

      setSuccess("Current handover saved.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save current.");
    } finally {
      setCurrentLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      setError("Missing project id from route.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const missingCaption = photos.find((photo) => !photo.caption.trim());
    if (missingCaption) {
      setLoading(false);
      setError("Please add a caption for every photo before saving.");
      return;
    }

    let user;
    let tenantId;
    try {
      const ctx = await getContext();
      user = ctx.user;
      tenantId = ctx.tenantId;
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Auth error.");
      return;
    }

    if (!notes.trim() && photos.length === 0) {
      setLoading(false);
      setError("Add notes or photos before saving.");
      return;
    }

    const narrative = buildNarrative();

    let handover;
    let handoverError;

    if (currentHandoverId) {
      const result = await supabase
        .from("handovers")
        .update({ notes: narrative })
        .eq("id", currentHandoverId)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .eq("created_by", user.id)
        .select("id")
        .single();
      handover = result.data;
      handoverError = result.error;
    } else {
      const result = await supabase
        .from("handovers")
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          created_by: user.id,
          notes: narrative,
        })
        .select("id")
        .single();
      handover = result.data;
      handoverError = result.error;
    }

    if (handoverError || !handover) {
      setLoading(false);
      setError(handoverError?.message || "Failed to create handover.");
      return;
    }

    try {
      if (photos.length > 0) {
        await uploadPhotosForHandover({
          handoverId: handover.id,
          tenantId,
          userId: user.id,
          projectId,
          photosToUpload: photos,
        });
      }
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Failed to save photos.");
      return;
    }

    photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    setLoading(false);
    setNotes("");
    setPhotos([]);
    setCurrentHandoverId(null);
    setSuccess("Handover saved.");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Supervisor Handover</h1>
      <p style={{ color: "#555", marginTop: 8 }}>Project: {projectName || projectId || "..."}</p>
      {currentHandoverId && (
        <div style={{ color: "#116611", fontWeight: 800, marginTop: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#1dbf50", marginRight: 8 }} />
          Current handover in progress
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
          display: "grid",
          gap: 10,
          maxWidth: 520,
        }}
      >
        <div style={{ fontWeight: 900 }}>
          Handover: {formatDateDDMMYYYY(handoverDate)} - {shift === "days" ? "Days" : "Nights"}
        </div>
        <label style={{ fontWeight: 800 }}>
          Date
          <input
            type="date"
            required
            value={handoverDate}
            onChange={(e) => setHandoverDate(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
            }}
          />
        </label>
        <label style={{ fontWeight: 800 }}>
          Shift
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value as "days" | "nights")}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
            }}
          >
            <option value="days">Days</option>
            <option value="nights">Nights</option>
          </select>
        </label>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ fontWeight: 900 }}>
          Running log
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={10}
            placeholder="Write your running handover log here..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              marginTop: 6,
              resize: "vertical",
            }}
          />
          <SpeechToTextButton onTranscript={appendTranscript} disabled={loading} />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            + Photos (files)
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => addPhotos(e.target.files)}
              style={{ display: "none" }}
            />
          </label>

          <label
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            + Photo (camera)
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => addPhotos(e.target.files)}
              style={{ display: "none" }}
            />
          </label>
        </div>

        {error && <div style={{ color: "crimson", fontWeight: 800 }}>{error}</div>}
        {success && <div style={{ color: "green", fontWeight: 800 }}>{success}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onSaveCurrent}
            disabled={currentLoading || loading}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #1dbf50",
              background: "#e9f9ef",
              color: "#116611",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {currentLoading ? "Saving current..." : "Save current"}
          </button>

          <button
            disabled={loading || currentLoading}
            style={{
              padding: 12,
              borderRadius: 12,
              border: 0,
              background: "black",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {loading ? "Saving..." : currentHandoverId ? "Finalize handover" : "Save handover"}
          </button>
        </div>

        <section
          style={{
            marginTop: 8,
            border: "1px solid #eee",
            borderRadius: 12,
            padding: 10,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>Attached photos (reference)</div>

          {savedPhotos.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              {savedPhotos.map((photo) => (
                <div key={photo.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
                  {photo.signedUrl ? (
                    <img
                      src={photo.signedUrl}
                      alt={photo.caption || "Saved photo"}
                      style={{
                        width: "100%",
                        maxHeight: 300,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid #eee",
                      }}
                    />
                  ) : (
                    <div style={{ color: "#666" }}>Unable to load saved photo preview.</div>
                  )}
                  <div style={{ marginTop: 8, color: "#444", fontWeight: 700 }}>
                    {photo.caption || "(No caption)"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {photos.length > 0 && (
          <section
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ color: "#555", fontWeight: 800 }}>New photos (not saved yet)</div>
            {photos.map((photo) => (
              <div key={photo.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
                <img
                  src={photo.previewUrl}
                  alt={photo.file.name}
                  style={{
                    width: "100%",
                    maxHeight: 300,
                    objectFit: "cover",
                    borderRadius: 8,
                    border: "1px solid #eee",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input
                    value={photo.caption}
                    onChange={(e) => updatePhotoCaption(photo.id, e.target.value)}
                    placeholder="Photo caption (required)"
                    required
                    style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #ddd",
                      background: "white",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </section>
          )}

          {savedPhotos.length === 0 && photos.length === 0 && (
            <div style={{ color: "#666" }}>No photos attached yet.</div>
          )}
        </section>
      </form>
    </main>
  );
}
