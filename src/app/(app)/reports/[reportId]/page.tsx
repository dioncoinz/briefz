import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function ReportDetailPage({
  params,
}: {
  params: { reportId: string };
}) {
  const supabase = await createSupabaseServer();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.tenant_id) {
    return <main style={{ color: "crimson" }}>Unable to load profile tenant.</main>;
  }

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("*")
    .eq("id", params.reportId)
    .eq("tenant_id", profile.tenant_id)
    .single();

  if (reportError && reportError.code !== "PGRST116") {
    return <main style={{ color: "crimson" }}>{reportError.message}</main>;
  }

  if (!report) {
    return (
      <main>
        <h1 className="section-title">Report not found</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          No report was found for id <code>{params.reportId}</code>.
        </p>
        <p style={{ marginTop: 14 }}>
          <Link href="/projects" className="action-link">
            Back to projects
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="section-title">Report {report.id}</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        This route is now live and loading data from <code>reports</code>.
      </p>

      <pre className="content-pre" style={{ marginTop: 16 }}>
        {JSON.stringify(report, null, 2)}
      </pre>
    </main>
  );
}
