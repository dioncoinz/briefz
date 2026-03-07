"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function fail(message: string): never {
  redirect(`/admin/users?error=${encodeURIComponent(message)}`);
}

export async function createTenantUserAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "").trim().toLowerCase();

  if (!email || !password || !fullName || !role) fail("All fields are required.");
  if (password.length < 6) fail("Password must be at least 6 characters.");

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) fail("Please sign in again.");

  const { data: actorProfile, error: actorError } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (actorError || !actorProfile?.tenant_id) fail("Could not resolve your tenant profile.");
  if (actorProfile.role !== "admin") fail("Only admins can add users.");

  const admin = createSupabaseAdmin();

  const { data: createdUser, error: createAuthError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createAuthError || !createdUser.user) {
    fail(createAuthError?.message || "Failed to create auth user.");
  }

  const { error: createProfileError } = await admin.from("profiles").insert({
    id: createdUser.user.id,
    tenant_id: actorProfile.tenant_id,
    full_name: fullName,
    role,
  });

  if (createProfileError) {
    await admin.auth.admin.deleteUser(createdUser.user.id);
    fail(createProfileError.message);
  }

  revalidatePath("/admin/users");
  redirect("/admin/users?success=1");
}
