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
      progress: { current: 0, total: 0, filtered: 0 },
    })
    .select("id")
    .single();

  if (error || !job) {
    return Response.json({ error: "Failed to create scan job" }, { status: 500 });
  }

  await inngest.send({
    name: "scan/run",
    data: {
      userId,
      jobId: job.id,
      userEmail: session.user?.email ?? "",
    },
  });

  return Response.json({ jobId: job.id });
}
