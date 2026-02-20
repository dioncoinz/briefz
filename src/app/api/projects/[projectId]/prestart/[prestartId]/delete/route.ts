import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; prestartId: string }> }
) {
  const { projectId, prestartId } = await params;
  const supabase = await createSupabaseServer();

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
    return NextResponse.json(
      { error: profileError?.message || "Profile missing tenant." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("prestarts")
    .delete()
    .eq("tenant_id", profile.tenant_id)
    .eq("project_id", projectId)
    .eq("id", prestartId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/projects/${projectId}`, req.url), 303);
}
