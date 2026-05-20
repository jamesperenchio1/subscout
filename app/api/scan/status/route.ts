import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return Response.json({ error: "Missing jobId" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: job, error } = await db
    .from("scan_jobs")
    .select("id, status, latest_stage, progress, summary, error_message, created_at, updated_at")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  return Response.json(job);
}
