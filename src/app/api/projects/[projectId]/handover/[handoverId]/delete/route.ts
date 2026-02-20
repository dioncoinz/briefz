import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string; handoverId: string }> }
) {
  const { projectId, handoverId } = await params;
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

  const tenantId = profile.tenant_id;

  const { data: photos } = await supabase
    .from("handover_photos")
    .select("storage_path")
    .eq("tenant_id", tenantId)
    .eq("handover_id", handoverId);

  if ((photos || []).length > 0) {
    const paths = photos!.map((p) => p.storage_path).filter(Boolean);
    if (paths.length) {
      await supabase.storage.from("breifz-photos").remove(paths);
    }
  }

  await supabase
    .from("handover_photos")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("handover_id", handoverId);

  const { error } = await supabase
    .from("handovers")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .eq("id", handoverId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/projects/${projectId}`, req.url), 303);
}
