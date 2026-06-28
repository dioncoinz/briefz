"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import SpeechToTextButton from "@/components/SpeechToTextButton";
import MeetingRecorderButton from "@/components/MeetingRecorderButton";
import {
  appendBulletText,
  handleBulletTextareaChange,
  handleBulletTextareaKeyDown,
} from "@/lib/bullets";
import { formatDateDDMMYYYY } from "@/lib/date";

type HandoverItem = {
  id: string;
  notes: string;
  created_at: string;
};

function summarizeHandovers(items: HandoverItem[]) {
  if (!items.length) return "";

  const candidates = items
    .flatMap((item) =>
      item.notes
        .replace(/\s+/g, " ")
        .split(/[.!?]\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .map((s) => s.replace(/[.;:,]+$/g, ""))
    .filter((s) => s.length > 20);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const sentence of candidates) {
    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(sentence);
    if (unique.length >= 5) break;
  }

  if (!unique.length) return "";

  return unique.map((line) => `- ${line}`).join("\n");
}

function summarizeOrFallback(items: HandoverItem[]) {
  const summary = summarizeHandovers(items);
  if (summary.trim()) return summary;

  const fallback = items
    .slice(0, 3)
    .map((item) => item.notes.trim())
    .filter(Boolean)
    .join("\n\n");

  return fallback;
}

function summarizeTranscript(text: string) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
    if (unique.length >= 8) break;
  }

  if (!unique.length) return "";
  return unique.map((line) => `- ${line}`).join("\n");
}

export default function ProjectPrestartPage() {
  const params = useParams<{ projectId: string | string[] }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const supabase = createSupabaseBrowser();
  const router = useRouter();

  const [projectName, setProjectName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [handoverSummary, setHandoverSummary] = useState("");
  const [prestartDate, setPrestartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [shift, setShift] = useState<"days" | "nights">("days");
  const [enteringSupervisor, setEnteringSupervisor] = useState("");
  const [exitingSupervisor, setExitingSupervisor] = useState("");
  const [safetyPrimary, setSafetyPrimary] = useState("");
  const [progressUpdate, setProgressUpdate] = useState("");
  const [currentShift, setCurrentShift] = useState("");
  const [roundTheRoom, setRoundTheRoom] = useState("");
  const [safetySecondary, setSafetySecondary] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [meetingTranscript, setMeetingTranscript] = useState("");

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString();
  }, []);

  async function generateSummary() {
    if (!projectId) return;
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(authError?.message || "Not logged in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      setError(profileError?.message || "Profile missing tenant.");
      return;
    }

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("tenant_id", profile.tenant_id)
      .eq("id", projectId)
      .maybeSingle();

    if (project?.name) setProjectName(project.name);

    const { data, error: handoverError } = await supabase
      .from("handovers")
      .select("id, notes, created_at")
      .eq("tenant_id", profile.tenant_id)
      .eq("project_id", projectId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(12);

    if (handoverError) {
      setError(handoverError.message);
      return;
    }

    let rows = data || [];
    if (rows.length === 0) {
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("handovers")
        .select("id, notes, created_at")
        .eq("tenant_id", profile.tenant_id)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (fallbackError) {
        setError(fallbackError.message);
        return;
      }

      rows = fallbackRows || [];
    }

    if (rows.length === 0) {
      setHandoverSummary("No supervisor handovers found for this project yet.");
      return;
    }

    setHandoverSummary(summarizeOrFallback(rows));
  }

  useEffect(() => {
    if (!projectId) return;
    if (!handoverSummary) {
      generateSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      setError("Missing project id from route.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSaving(false);
      setError(authError?.message || "Not logged in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      setSaving(false);
      setError(profileError?.message || "Profile missing tenant.");
      return;
    }

    const prestartTitle = `${formatDateDDMMYYYY(prestartDate)} - ${shift === "days" ? "Days" : "Nights"}`;

    const notes = [
      `Prestart: ${prestartTitle}`,
      enteringSupervisor ? `Entering Supervisor: ${enteringSupervisor}` : null,
      exitingSupervisor ? `Exiting Supervisor: ${exitingSupervisor}` : null,
      safetyPrimary ? `Safety: ${safetyPrimary}` : null,
      progressUpdate ? `Progress update: ${progressUpdate}` : null,
      currentShift ? `Current shift: ${currentShift}` : null,
      roundTheRoom ? `Quick round the room to ensure everyone knows whats going on or any concerns: ${roundTheRoom}` : null,
      safetySecondary ? `Safety: ${safetySecondary}` : null,
      meetingTranscript ? `Meeting transcript: ${meetingTranscript}` : null,
      extraNotes ? `Extra notes: ${extraNotes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const { error: insertError } = await supabase.from("prestarts").insert({
      tenant_id: profile.tenant_id,
      project_id: projectId,
      created_by: user.id,
      handover_summary: handoverSummary,
      notes,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess("Prestart saved.");
    setEnteringSupervisor("");
    setExitingSupervisor("");
    setSafetyPrimary("");
    setProgressUpdate("");
    setCurrentShift("");
    setRoundTheRoom("");
    setSafetySecondary("");
    setExtraNotes("");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 900 }}>Prestart Meeting</h1>
      <p style={{ color: "#555", marginTop: 8 }}>Project: {projectName || projectId || "..."}</p>
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
          Prestart: {formatDateDDMMYYYY(prestartDate)} - {shift === "days" ? "Days" : "Nights"}
        </div>
        <label style={{ fontWeight: 700 }}>
          Date
          <input
            type="date"
            required
            value={prestartDate}
            onChange={(e) => setPrestartDate(e.target.value)}
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
        <label style={{ fontWeight: 700 }}>
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
        <label style={{ fontWeight: 700 }}>
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
        <label style={{ fontWeight: 700 }}>
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
        <label style={{ fontWeight: 700 }}>
          Handover summary
          <textarea
            required
            rows={6}
            value={handoverSummary}
            onChange={(e) => handleBulletTextareaChange(e, setHandoverSummary)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setHandoverSummary)}
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
        </label>

        <label style={{ fontWeight: 700 }}>
          Safety
          <textarea
            rows={4}
            value={safetyPrimary}
            onChange={(e) => handleBulletTextareaChange(e, setSafetyPrimary)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setSafetyPrimary)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
            placeholder="Capture key safety items, hazards, controls, and critical reminders..."
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setSafetyPrimary, text)}
            disabled={saving}
          />
        </label>

        <label style={{ fontWeight: 700 }}>
          Progress update
          <textarea
            rows={4}
            value={progressUpdate}
            onChange={(e) => handleBulletTextareaChange(e, setProgressUpdate)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setProgressUpdate)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
            placeholder="Summarize progress made, completed work, and outstanding items..."
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setProgressUpdate, text)}
            disabled={saving}
          />
        </label>

        <label style={{ fontWeight: 700 }}>
          Current shift
          <textarea
            rows={4}
            value={currentShift}
            onChange={(e) => handleBulletTextareaChange(e, setCurrentShift)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setCurrentShift)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
            placeholder="Note what this shift is responsible for, key work areas, and priorities..."
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setCurrentShift, text)}
            disabled={saving}
          />
        </label>

        <label style={{ fontWeight: 700 }}>
          Quick round the room to ensure everyone knows whats going on or any concerns
          <textarea
            rows={4}
            value={roundTheRoom}
            onChange={(e) => handleBulletTextareaChange(e, setRoundTheRoom)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setRoundTheRoom)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
            placeholder="Capture team understanding, questions raised, and any concerns shared..."
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setRoundTheRoom, text)}
            disabled={saving}
          />
        </label>

        <label style={{ fontWeight: 700 }}>
          Safety
          <textarea
            rows={4}
            value={safetySecondary}
            onChange={(e) => handleBulletTextareaChange(e, setSafetySecondary)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setSafetySecondary)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
            placeholder="Add any final safety reminders, checks, or escalation items..."
          />
          <SpeechToTextButton
            onTranscript={(text) => appendBulletText(setSafetySecondary, text)}
            disabled={saving}
          />
        </label>

        <label style={{ fontWeight: 700 }}>
          Meeting transcript (speech-to-text)
          <textarea
            rows={6}
            value={meetingTranscript}
            onChange={(e) => handleBulletTextareaChange(e, setMeetingTranscript)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setMeetingTranscript)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "#fff",
              marginTop: 6,
              resize: "vertical",
            }}
            placeholder="Capture your 15-minute meeting conversation here..."
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <MeetingRecorderButton
              onTranscript={(text) => appendBulletText(setMeetingTranscript, text)}
              disabled={saving}
              maxMinutes={15}
            />
            <SpeechToTextButton
              onTranscript={(text) => appendBulletText(setMeetingTranscript, text)}
              disabled={saving}
            />
            <button
              type="button"
              onClick={() => {
                const summary = summarizeTranscript(meetingTranscript);
                if (!summary.trim()) {
                  setError("No transcript content to summarize yet.");
                  return;
                }
                setError(null);
                setHandoverSummary(summary);
              }}
              className="action-button"
              style={{
                marginLeft: "auto",
                minHeight: 42,
                padding: "8px 12px",
                lineHeight: 1.2,
                background: "linear-gradient(180deg, #eefbf2 0%, #daf3e3 100%)",
                borderColor: "#a8d5b5",
                color: "#1f5a31",
              }}
            >
              Summarize meeting
            </button>
          </div>
        </label>

        <label style={{ fontWeight: 700 }}>
          Extra notes
          <textarea
            rows={4}
            value={extraNotes}
            onChange={(e) => handleBulletTextareaChange(e, setExtraNotes)}
            onKeyDown={(e) => handleBulletTextareaKeyDown(e, setExtraNotes)}
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
            onTranscript={(text) => appendBulletText(setExtraNotes, text)}
            disabled={saving}
          />
        </label>

        {error && <div style={{ color: "crimson", fontWeight: 700 }}>{error}</div>}
        {success && <div style={{ color: "green", fontWeight: 700 }}>{success}</div>}

        <button
          disabled={saving}
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
          {saving ? "Saving..." : "Save prestart"}
        </button>
      </form>
    </main>
  );
}

