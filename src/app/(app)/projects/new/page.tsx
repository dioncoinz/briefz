"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function NewProjectPage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setLoading(false);
      setError("Not logged in.");
      return;
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) {
      setLoading(false);
      setError(pErr.message);
      return;
    }

    if (!profile?.tenant_id) {
      setLoading(false);
      setError("Profile missing tenant. Create a profiles row for your user first.");
      return;
    }

    const { data, error } = await supabase
      .from("projects")
      .insert({
        tenant_id: profile.tenant_id,
        name,
        start_date: startDate,
        end_date: endDate || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error) return setError(error.message);

    router.push(`/projects/${data.id}`);
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 560, border: "1px solid #cfd7e3", background: "#f9fbff", borderRadius: 16, padding: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>New project</h1>

      <form onSubmit={createProject} style={{ display: "grid", gap: 10, marginTop: 14 }}>
        <input
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ced7e3", background: "#fff" }}
        />
        <label style={{ fontWeight: 800 }}>
          Start date
          <input
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            type="date"
            required
            style={{ display: "block", width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ced7e3", background: "#fff", marginTop: 6 }}
          />
        </label>
        <label style={{ fontWeight: 800 }}>
          End date (optional)
          <input
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            type="date"
            style={{ display: "block", width: "100%", padding: 10, borderRadius: 10, border: "1px solid #ced7e3", background: "#fff", marginTop: 6 }}
          />
        </label>

        {error && <div style={{ color: "crimson", fontWeight: 800 }}>{error}</div>}

        <button
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #8f451f",
            background: "#b8642c",
            color: "white",
            fontWeight: 900,
          }}
        >
          {loading ? "Creating..." : "Create project"}
        </button>
      </form>
    </main>
  );
}
