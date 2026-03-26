// src/app/(auth)/login/page.tsx
"use client";

import Image from "next/image";
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) return setError(error.message);

    router.push(next);
    router.refresh();
  }

  return (
    <main className="page-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: "100%", maxWidth: 460, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Image
            src="/gmrs-logo.png"
            alt="GMRS"
            width={220}
            height={110}
            priority
            style={{ width: "auto", height: "auto", maxWidth: "100%" }}
          />
        </div>

        <section className="panel form-card" style={{ maxWidth: 460, width: "100%" }}>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0 }}>Briefz</h1>
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
              autoComplete="current-password"
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
              {loading ? "Working..." : "Sign in"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
