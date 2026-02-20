import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const supabase = await createSupabaseServer();
  const { projectId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url), 303);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    return NextResponse.json({ error: profileError?.message || "Profile missing tenant." }, { status: 400 });
  }

  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/archive", req.url), 303);
}