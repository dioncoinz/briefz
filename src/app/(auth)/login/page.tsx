// src/app/(auth)/login/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: 420, margin: "70px auto", padding: 20 }}>Loading...</main>}>
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
    <main style={{ maxWidth: 420, margin: "70px auto", padding: 20 }}>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Breifz</h1>
      <p style={{ color: "#555", marginTop: 6 }}>
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
          style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
        />

        <input
          type="password"
          placeholder="Password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, borderRadius: 12, border: "1px solid #ddd" }}
        />

        {error && <div style={{ color: "crimson", fontWeight: 800 }}>{error}</div>}

        <button
          disabled={loading}
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
          {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid #ddd",
            background: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Switch to {mode === "signin" ? "Create account" : "Sign in"}
        </button>
      </form>

      <div style={{ marginTop: 14, color: "#777", fontSize: 12 }}>
        Tip: Create your first user, then add a profile row in Supabase pointing to your tenant.
      </div>
    </main>
  );
}
