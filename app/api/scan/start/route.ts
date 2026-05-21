import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { inngest } from "@/lib/inngest";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: job, error } = await db
    .from("scan_jobs")
    .insert({
      user_id: userId,
      status: "pending",
      latest_stage: "Queued. Waiting for scan worker pickup…",
      progress: { current: 0, total: 0, filtered: 0 },
    })
    .select("id")
    .single();

  if (error || !job) {
    return Response.json({ error: "Failed to create scan job" }, { status: 500 });
  }

  void inngest
    .send({
      name: "scan/run",
      data: {
        userId,
        jobId: job.id,
        userEmail: session.user?.email ?? "",
      },
    })
    .catch(async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .from("scan_jobs")
        .update({
          status: "error",
          latest_stage: "Failed to queue scan",
          error_message: message.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    });

  return Response.json({ jobId: job.id });
}
