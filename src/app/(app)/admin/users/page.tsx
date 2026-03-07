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
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>Admin - Users</h1>
        <p style={{ color: "crimson", fontWeight: 700 }}>
          Your profile is missing a tenant. Add your `profiles` row first.
        </p>
      </main>
    );
  }

  if (actorProfile.role !== "admin") {
    return (
      <main>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>Admin - Users</h1>
        <p style={{ color: "crimson", fontWeight: 700 }}>Only users with role `admin` can access this page.</p>
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
      <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 10 }}>Admin - Users</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Create new tenant users. They can sign in immediately with the password you set here.
      </p>

      {error && (
        <div
          style={{
            marginTop: 14,
            borderRadius: 10,
            border: "1px solid #f3b0b0",
            background: "#fff2f2",
            color: "#8e1414",
            padding: "10px 12px",
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            marginTop: 14,
            borderRadius: 10,
            border: "1px solid #b5e4c7",
            background: "#f1fff7",
            color: "#145d2f",
            padding: "10px 12px",
            fontWeight: 700,
          }}
        >
          User created.
        </div>
      )}

      <form action={createTenantUserAction} style={{ display: "grid", gap: 10, marginTop: 18, maxWidth: 560 }}>
        <input
          name="full_name"
          placeholder="Full name"
          required
          style={{ padding: 10, borderRadius: 12, border: "1px solid #ced7e3", background: "#fff" }}
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          style={{ padding: 10, borderRadius: 12, border: "1px solid #ced7e3", background: "#fff" }}
        />
        <input
          name="password"
          type="password"
          placeholder="Temporary password (min 6 chars)"
          minLength={6}
          required
          style={{ padding: 10, borderRadius: 12, border: "1px solid #ced7e3", background: "#fff" }}
        />
        <select
          name="role"
          defaultValue="supervisor"
          style={{ padding: 10, borderRadius: 12, border: "1px solid #ced7e3", background: "#fff" }}
        >
          <option value="supervisor">supervisor</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </select>

        <button
          type="submit"
          style={{
            marginTop: 4,
            width: "fit-content",
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #8f451f",
            background: "#b8642c",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Add user
        </button>
      </form>

      <h2 style={{ marginTop: 30, marginBottom: 8, fontSize: 20, fontWeight: 900 }}>Tenant users</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {(users || []).map((u) => (
          <div
            key={u.id}
            style={{
              border: "1px solid #cfd7e3",
              background: "#f9fbff",
              borderRadius: 14,
              padding: 14,
              display: "grid",
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 800 }}>{u.full_name}</div>
            <div style={{ color: "#555" }}>Role: {u.role || "n/a"}</div>
            <div style={{ color: "#777", fontSize: 12 }}>User ID: {u.id}</div>
          </div>
        ))}
        {(users || []).length === 0 && <div style={{ color: "#555" }}>No users found for this tenant yet.</div>}
      </div>
    </main>
  );
}
