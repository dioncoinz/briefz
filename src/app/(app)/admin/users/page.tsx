import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createTenantUserAction } from "./actions";

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const success = params.success === "1";

  const supabase = await createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin/users");
  }

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("tenant_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!actorProfile?.tenant_id) {
    return (
      <main>
        <h1 className="section-title">Admin - Users</h1>
        <p className="status-error" style={{ display: "inline-block" }}>
          Your profile is missing a tenant. Add your `profiles` row first.
        </p>
      </main>
    );
  }

  if (actorProfile.role !== "admin") {
    return (
      <main>
        <h1 className="section-title">Admin - Users</h1>
        <p className="status-error" style={{ display: "inline-block" }}>Only users with role `admin` can access this page.</p>
      </main>
    );
  }

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("tenant_id", actorProfile.tenant_id)
    .order("created_at", { ascending: false });

  return (
    <main>
      <h1 className="section-title">Admin - Users</h1>
      <p className="section-subtitle">
        Create new tenant users. They can sign in immediately with the password you set here.
      </p>

      {error && <div className="status-error">{error}</div>}

      {success && <div className="status-ok">User created.</div>}

      <form action={createTenantUserAction} className="panel form-card" style={{ display: "grid", gap: 10, marginTop: 18 }}>
        <input
          name="full_name"
          placeholder="Full name"
          required
          className="field"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="field"
        />
        <input
          name="password"
          type="password"
          placeholder="Temporary password (min 6 chars)"
          minLength={6}
          required
          className="field"
        />
        <select
          name="role"
          defaultValue="supervisor"
          className="field"
        >
          <option value="supervisor">supervisor</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </select>

        <button
          type="submit"
          className="action-button action-primary"
          style={{ marginTop: 4, width: "fit-content" }}
        >
          Add user
        </button>
      </form>

      <h2 style={{ marginTop: 30, marginBottom: 8, fontSize: 20, fontWeight: 900 }}>Tenant users</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {(users || []).map((u) => (
          <div key={u.id} className="panel" style={{ padding: 14, display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 800 }}>{u.full_name}</div>
            <div className="muted">Role: {u.role || "n/a"}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>User ID: {u.id}</div>
          </div>
        ))}
        {(users || []).length === 0 && <div className="muted">No users found for this tenant yet.</div>}
      </div>
    </main>
  );
}
