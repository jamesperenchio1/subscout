import { supabaseAdmin } from "@/lib/supabase";
import { randomUUID } from "crypto";

/**
 * Groups unclustered email_events by sender_domain (one cluster per domain per user).
 * All emails from the same domain are treated as the same service — simple and reliable
 * without requiring vector embeddings or ONNX/WASM at runtime.
 */
export async function clusterPendingEvents(userId: string): Promise<{ assigned: number; clusters: number }> {
  const db = supabaseAdmin();

  const { data: pending, error } = await db
    .from("email_events")
    .select("id, sender_domain")
    .eq("user_id", userId)
    .is("cluster_id", null);

  if (error) throw error;
  if (!pending?.length) return { assigned: 0, clusters: 0 };

  // Assign a stable UUID per domain (within this batch — not persisted separately).
  // Existing clustered events already have their cluster_ids, so new events from the
  // same domain will get a fresh cluster. The classify step handles dedup via service_brand.
  const domainToCluster = new Map<string, string>();
  let assigned = 0;

  for (const row of pending) {
    const domain = (row.sender_domain ?? "unknown").toLowerCase();
    if (!domainToCluster.has(domain)) {
      domainToCluster.set(domain, randomUUID());
    }
    const clusterId = domainToCluster.get(domain)!;

    const { error: updateErr } = await db
      .from("email_events")
      .update({ cluster_id: clusterId })
      .eq("id", row.id);
    if (!updateErr) assigned++;
  }

  return { assigned, clusters: domainToCluster.size };
}
