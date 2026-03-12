// src/app/(auth)/login/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page-shell"><div className="panel form-card">Loading...</div></main>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/projects";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) return setError(error.message);

    router.push(next);
    router.refresh();
  }

  return (
    <main className="page-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <section className="panel form-card" style={{ maxWidth: 460, width: "100%" }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Breifz</h1>
      <p className="section-subtitle">
        Prestarts + Supervisor handovers, project-based.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
        />

        <input
          type="password"
          placeholder="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
        />

        {error && <div className="status-error" style={{ marginTop: 0 }}>{error}</div>}

        <button
          disabled={loading}
          className="action-button action-primary"
        >
          {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="action-button"
        >
          Switch to {mode === "signin" ? "Create account" : "Sign in"}
        </button>
      </form>

      <div style={{ marginTop: 14, color: "var(--text-muted)", fontSize: 12 }}>
        Tip: Create your first user, then add a profile row in Supabase pointing to your tenant.
      </div>
      </section>
    </main>
  );
}
