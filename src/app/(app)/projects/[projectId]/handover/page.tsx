"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import SpeechToTextButton from "@/components/SpeechToTextButton";
import {
  appendBulletText,
  handleBulletTextareaChange,
  handleBulletTextareaKeyDown,
} from "@/lib/bullets";
import { formatDateDDMMYYYY, formatLogEntryDateDDMMYYYY } from "@/lib/date";

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

type HandoverSaveContext = {
  handoverId?: string | null;
  userId?: string | null;
  tenantId?: string | null;
  rowTenantId?: string | null;
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

function getSupabaseErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: null, message: error instanceof Error ? error.message : null };
  }

  const maybeError = error as { code?: unknown; message?: unknown };
  return {
    code: typeof maybeError.code === "string" ? maybeError.code : null,
    message: typeof maybeError.message === "string" ? maybeError.message : null,
  };
}

export default function ProjectHandoverPage() {
  const params = useParams<{ projectId: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editHandoverId = searchParams.get("edit");

  const [projectName, setProjectName] = useState("");
  const [enteringSupervisor, setEnteringSupervisor] = useState("");
  const [exitingSupervisor, setExitingSupervisor] = useState("");
  const [safetyFocus, setSafetyFocus] = useState("");
  const [issuesConcernsPriorities, setIssuesConcernsPriorities] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [general, setGeneral] = useState("");
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
          .from("briefz-photos")
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

  function logFailedHandoverSave(
    operation: string,
    context: HandoverSaveContext,
    error: unknown
  ) {
    const details = getSupabaseErrorDetails(error);

    console.error("Handover save/update failed", {
      operation,
      handoverId: context.handoverId || null,
      currentUserId: context.userId || null,
      currentTenantId: context.tenantId || null,
      rowTenantId: context.rowTenantId || null,
      supabaseErrorCode: details.code,
      supabaseErrorMessage: details.message,
    });
  }

  async function getVisibleHandoverTenantId(handoverId: string, tenantId: string) {
    const { data } = await supabase
      .from("handovers")
      .select("tenant_id")
      .eq("id", handoverId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    return data?.tenant_id || null;
  }

  function extractSection(cleaned: string, label: string, knownLabels: string[]) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const otherLabels = knownLabels
      .filter((item) => item !== label)
      .map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");

    const pattern = otherLabels
      ? new RegExp(`${escapedLabel}:\\s*([\\s\\S]*?)(?=\\n(?:${otherLabels}):|\\n\\[Photo |$)`)
      : new RegExp(`${escapedLabel}:\\s*([\\s\\S]*?)(?=\\n\\[Photo |$)`);

    const match = cleaned.match(pattern);
    return match?.[1]?.trim() || "";
  }

  function hydrateHandoverForm(
    rawNotes: string,
    projectStartDate?: string | null,
    projectEndDate?: string | null
  ) {
    const cleaned = typeof rawNotes === "string" ? rawNotes.replace(`${CURRENT_HANDOVER_MARKER}\n`, "") : "";
    const lines = cleaned.split("\n");
    const headerLine = lines.find((line: string) => line.startsWith("Handover:"));
    const sectionLabels = [
      "Entering Supervisor",
      "Exiting Supervisor",
      "Safety / focus for the shift / incidents",
      "Issues / concerns / priorities",
      "Work status",
      "General",
      "Delays",
      "Follow-up required",
    ];

    if (headerLine) {
      const match = headerLine.match(
        /Handover:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})\s*-\s*(Days|Nights)/i
      );
      if (match) {
        const formattedDate = formatLogEntryDateDDMMYYYY(match[1], projectStartDate, projectEndDate);
        const [dd, mm, yyyy] = formattedDate.includes("/")
          ? formattedDate.split("/")
          : [match[1].slice(8, 10), match[1].slice(5, 7), match[1].slice(0, 4)];
        setHandoverDate(`${yyyy}-${mm}-${dd}`);
        setShift(match[2].toLowerCase() === "nights" ? "nights" : "days");
      }
    }

    const newEnteringSupervisor = extractSection(cleaned, "Entering Supervisor", sectionLabels);
    const newExitingSupervisor = extractSection(cleaned, "Exiting Supervisor", sectionLabels);
    const newSafetyFocus = extractSection(cleaned, "Safety / focus for the shift / incidents", sectionLabels);
    const newIssuesConcernsPriorities = extractSection(cleaned, "Issues / concerns / priorities", sectionLabels);
    const newWorkStatus = extractSection(cleaned, "Work status", sectionLabels);
    const newGeneral = extractSection(cleaned, "General", sectionLabels);
    const legacyDelays = extractSection(cleaned, "Delays", sectionLabels);
    const legacyFollowUpRequired = extractSection(cleaned, "Follow-up required", sectionLabels);

    setEnteringSupervisor(newEnteringSupervisor);
    setExitingSupervisor(newExitingSupervisor);
    setSafetyFocus(newSafetyFocus);
    setIssuesConcernsPriorities(newIssuesConcernsPriorities || legacyFollowUpRequired);
    setWorkStatus(newWorkStatus || legacyDelays);
    setGeneral(newGeneral);
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
        .select("name, start_date, end_date")
        .eq("tenant_id", profile.tenant_id)
        .eq("id", projectId)
        .maybeSingle();

      if (project?.name && active) setProjectName(project.name);

      if (editHandoverId) {
        const { data: existing, error: existingError } = await supabase
          .from("handovers")
          .select("id, notes, tenant_id")
          .eq("tenant_id", profile.tenant_id)
          .eq("project_id", projectId)
          .eq("id", editHandoverId)
          .maybeSingle();

        if (existingError) {
          logFailedHandoverSave(
            "load_edit_handover",
            {
              handoverId: editHandoverId,
              userId: user.id,
              tenantId: profile.tenant_id,
              rowTenantId: null,
            },
            existingError
          );
          if (active) setError(existingError.message);
          return;
        }

        if (!existing) {
          logFailedHandoverSave(
            "load_edit_handover",
            {
              handoverId: editHandoverId,
              userId: user.id,
              tenantId: profile.tenant_id,
              rowTenantId: null,
            },
            new Error("Handover was not visible to the current tenant.")
          );
          if (active) setError("You do not have permission to update this handover or it no longer exists.");
          return;
        }

        if (!active) return;

        setCurrentHandoverId(existing.id);
        hydrateHandoverForm(existing.notes || "", project?.start_date, project?.end_date);
        await loadSavedPhotos(profile.tenant_id, existing.id);
        return;
      }

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
      hydrateHandoverForm(current.notes || "", project?.start_date, project?.end_date);

      await loadSavedPhotos(profile.tenant_id, current.id);
    }

    loadProjectName();
    return () => {
      active = false;
    };
  }, [editHandoverId, projectId, supabase]);

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

    if (enteringSupervisor.trim()) {
      lines.push(`Entering Supervisor: ${enteringSupervisor.trim()}`);
    }

    if (exitingSupervisor.trim()) {
      lines.push(`Exiting Supervisor: ${exitingSupervisor.trim()}`);
    }

    if (safetyFocus.trim()) {
      lines.push(`Safety / focus for the shift / incidents: ${safetyFocus.trim()}`);
    }

    if (issuesConcernsPriorities.trim()) {
      lines.push(`Issues / concerns / priorities: ${issuesConcernsPriorities.trim()}`);
    }

    if (workStatus.trim()) {
      lines.push(`Work status: ${workStatus.trim()}`);
    }

    if (general.trim()) {
      lines.push(`General: ${general.trim()}`);
    }

    savedPhotos.forEach((photo, idx) => {
      lines.push(`[Photo ${idx + 1}] ${photo.caption?.trim() || photo.storagePath.split("/").pop() || "photo"}`);
    });

    photos.forEach((photo, idx) => {
      const photoNumber = savedPhotos.length + idx + 1;
      lines.push(`[Photo ${photoNumber}] ${photo.caption.trim() || photo.file.name}`);
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
      const { error: uploadError } = await supabase.storage.from("briefz-photos").upload(path, photo.file);

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
    if (editHandoverId) return;

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
        const rowTenantId = await getVisibleHandoverTenantId(currentHandoverId, tenantId);
        const { data: updated, error: updateError } = await supabase
          .from("handovers")
          .update({ notes: draftNotes })
          .eq("id", currentHandoverId)
          .eq("tenant_id", tenantId)
          .eq("project_id", projectId)
          .select("id, tenant_id")
          .maybeSingle();

        if (updateError || !updated) {
          const errorToLog =
            updateError || new Error("Handover update returned zero rows.");
          logFailedHandoverSave(
            "save_current_handover",
            {
              handoverId: currentHandoverId,
              userId: user.id,
              tenantId,
              rowTenantId: updated?.tenant_id || rowTenantId,
            },
            errorToLog
          );
          throw new Error(
            "You do not have permission to update this handover or it no longer exists."
          );
        }
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
          .maybeSingle();

        if (insertError || !inserted) {
          logFailedHandoverSave(
            "insert_current_handover",
            {
              handoverId: inserted?.id || null,
              userId: user.id,
              tenantId,
              rowTenantId: tenantId,
            },
            insertError || new Error("Handover insert returned zero rows.")
          );
          throw new Error(insertError?.message || "Failed to save current.");
        }
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

    if (
      !safetyFocus.trim() &&
      !issuesConcernsPriorities.trim() &&
      !workStatus.trim() &&
      !general.trim() &&
      photos.length === 0
    ) {
      setLoading(false);
      setError("Add notes or photos before saving.");
      return;
    }

    const narrative = buildNarrative();

    let handover: { id: string; tenant_id?: string | null } | null = null;
    let handoverError;

    if (currentHandoverId) {
      const rowTenantId = await getVisibleHandoverTenantId(currentHandoverId, tenantId);
      const result = await supabase
        .from("handovers")
        .update({ notes: narrative })
        .eq("id", currentHandoverId)
        .eq("tenant_id", tenantId)
        .eq("project_id", projectId)
        .select("id, tenant_id")
        .maybeSingle();
      handover = result.data;
      handoverError =
        result.error || (!handover ? new Error("Handover update returned zero rows.") : null);

      if (handoverError || !handover) {
        logFailedHandoverSave(
          "finalize_or_update_handover",
          {
            handoverId: currentHandoverId,
            userId: user.id,
            tenantId,
            rowTenantId: handover?.tenant_id || rowTenantId,
          },
          handoverError
        );
      }
    } else {
      const result = await supabase
        .from("handovers")
        .insert({
          tenant_id: tenantId,
          project_id: projectId,
          created_by: user.id,
          notes: narrative,
        })
        .select("id, tenant_id")
        .maybeSingle();
      handover = result.data;
      handoverError =
        result.error || (!handover ? new Error("Handover insert returned zero rows.") : null);

      if (handoverError || !handover) {
        logFailedHandoverSave(
          "insert_handover",
          {
            handoverId: handover?.id || null,
            userId: user.id,
            tenantId,
            rowTenantId: handover?.tenant_id || tenantId,
          },
          handoverError
        );
      }
    }

    if (handoverError || !handover) {
      setLoading(false);
      setError(
        currentHandoverId
          ? "You do not have permission to update this handover or it no longer exists."
          : handoverError?.message || "Failed to create handover."
      );
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
    setEnteringSupervisor("");
    setExitingSupervisor("");
    setSafetyFocus("");
    setIssuesConcernsPriorities("");
    setWorkStatus("");
    setGeneral("");
    setPhotos([]);
    setCurrentHandoverId(null);
    setSavedPhotos([]);
    setSuccess("Handover saved.");
    router.push(`/projects/${projectId}`);
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Supervisor Handover</h1>
      <p style={{ color: "#555", marginTop: 8 }}>Project: {projectName || projectId || "..."}</p>
      {currentHandoverId && (
        <div style={{ color: "#116611", fontWeight: 800, marginTop: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#1dbf50", marginRight: 8 }} />
          {editHandoverId ? "Editing saved handover" : "Current handover in progress"}
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
              background: "#fff",
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
              background: "#fff",
              marginTop: 6,
            }}
          >
            <option value="days">Days</option>
            <option value="nights">Nights</option>
          </select>
        </label>
        <label style={{ fontWeight: 800 }}>
          Entering Supervisor
          <input
            type="text"
            value={enteringSupervisor}
            onChange={(e) => setEnteringSupervisor(e.target.value)}
            placeholder="Enter incoming supervisor name"
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
            }}
          />
        </label>
        <label style={{ fontWeight: 800 }}>
          Exiting Supervisor
          <input
            type="text"
            value={exitingSupervisor}
            onChange={(e) => setExitingSupervisor(e.target.value)}
            placeholder="Enter outgoing supervisor name"
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
            }}
          />
        </label>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ fontWeight: 900 }}>
          Safety / focus for the shift / incidents
          <textarea
            value={safetyFocus}
            onChange={(e) => handleBulletTextareaChange(e, setSafetyFocus)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setSafetyFocus)}
            rows={3}
            placeholder="Highlight any safety points, shift focus items, incidents, or critical watch-outs..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setSafetyFocus, text)}
            disabled={loading || currentLoading}
          />
        </label>

        <label style={{ fontWeight: 900 }}>
          Issues / concerns / priorities
          <textarea
            value={issuesConcernsPriorities}
            onChange={(e) => handleBulletTextareaChange(e, setIssuesConcernsPriorities)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setIssuesConcernsPriorities)}
            rows={3}
            placeholder="Capture the main issues, concerns, and priority items for the incoming shift..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setIssuesConcernsPriorities, text)}
            disabled={loading || currentLoading}
          />
        </label>

        <label style={{ fontWeight: 900 }}>
          Work status
          <textarea
            value={workStatus}
            onChange={(e) => handleBulletTextareaChange(e, setWorkStatus)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setWorkStatus)}
            rows={4}
            placeholder="Summarize what has been completed, what is underway, and what is still outstanding..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setWorkStatus, text)}
            disabled={loading || currentLoading}
          />
        </label>

        <label style={{ fontWeight: 900 }}>
          General
          <textarea
            value={general}
            onChange={(e) => handleBulletTextareaChange(e, setGeneral)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setGeneral)}
            rows={6}
            placeholder="Add any other handover notes, context, or general updates here..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setGeneral, text)}
            disabled={loading || currentLoading}
          />
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
          {!editHandoverId && (
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
          )}

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
            {loading ? "Saving..." : editHandoverId ? "Update handover" : currentHandoverId ? "Finalize handover" : "Save handover"}
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
