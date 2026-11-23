import { revalidatePath } from "next/cache";
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

  const { data: project, error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", projectId)
    .eq("tenant_id", profile.tenant_id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  revalidatePath("/projects");
  revalidatePath("/archive");
  revalidatePath(`/projects/${project.id}`);
  revalidatePath(`/archive/${project.id}`);

  return NextResponse.redirect(new URL(`/projects/${project.id}`, req.url), 303);
}
