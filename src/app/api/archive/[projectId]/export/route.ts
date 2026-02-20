import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const format = new URL(req.url).searchParams.get("format") || "json";

  if (format !== "json") {
    return NextResponse.json({ error: "Only json export is available in MVP." }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    return NextResponse.json({ error: profileError?.message || "Profile missing tenant." }, { status: 400 });
  }

  const tenantId = profile.tenant_id;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, start_date, end_date, archived_at, created_at")
    .eq("tenant_id", tenantId)
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message || "Project not found." }, { status: 404 });
  }

  const { data: handovers, error: handoversError } = await supabase
    .from("handovers")
    .select("id, notes, created_by, created_at")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (handoversError) {
    return NextResponse.json({ error: handoversError.message }, { status: 400 });
  }

  const handoverIds = (handovers || []).map((h) => h.id);
  let photos: Array<{
    id: string;
    handover_id: string;
    storage_path: string;
    caption: string | null;
    created_at: string;
  }> = [];

  if (handoverIds.length) {
    const { data: handoverPhotos, error: photosError } = await supabase
      .from("handover_photos")
      .select("id, handover_id, storage_path, caption, created_at")
      .eq("tenant_id", tenantId)
      .in("handover_id", handoverIds)
      .order("created_at", { ascending: true });

    if (photosError) {
      return NextResponse.json({ error: photosError.message }, { status: 400 });
    }

    photos = handoverPhotos || [];
  }

  const { data: prestarts, error: prestartsError } = await supabase
    .from("prestarts")
    .select("id, handover_summary, notes, created_by, created_at")
    .eq("tenant_id", tenantId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (prestartsError) {
    return NextResponse.json({ error: prestartsError.message }, { status: 400 });
  }

  const payload = {
    exported_at: new Date().toISOString(),
    tenant_id: tenantId,
    project,
    handovers: (handovers || []).map((handover) => ({
      ...handover,
      photos: photos.filter((photo) => photo.handover_id === handover.id),
    })),
    prestarts: prestarts || [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="project-${projectId}-export.json"`,
    },
  });
}