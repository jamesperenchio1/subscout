import { supabaseAdmin } from "@/lib/supabase";
import { toPgVector } from "./embed";
import { randomUUID } from "crypto";

const SIMILARITY_THRESHOLD = 0.85;

/**
 * For each new (cluster_id IS NULL) email_event for this user, find the nearest
 * existing email_event by cosine similarity. If similarity >= threshold, adopt
 * its cluster_id. Otherwise assign a brand-new cluster_id.
 *
 * Uses pgvector's `<=>` cosine distance operator (lower = more similar).
 */
export async function clusterPendingEvents(userId: string): Promise<{ assigned: number; clusters: number }> {
  const db = supabaseAdmin();

  // Fetch unclustered events with their embeddings
  const { data: pending, error } = await db
    .from("email_events")
    .select("id, embedding")
    .eq("user_id", userId)
    .is("cluster_id", null);

  if (error) throw error;
  if (!pending?.length) return { assigned: 0, clusters: 0 };

  let newClusters = 0;
  let assigned = 0;

  for (const row of pending) {
    const embedding = row.embedding as unknown as number[] | string | null;
    if (!embedding) continue;
    const vec = typeof embedding === "string" ? embedding : toPgVector(embedding);

    // Find nearest already-clustered event for this user
    const { data: neighbors } = await db.rpc("nearest_clustered_event", {
      p_user_id: userId,
      p_query_embedding: vec,
      p_limit: 1,
    });

    let clusterId: string | null = null;
    if (neighbors?.length) {
      const top = neighbors[0] as { cluster_id: string; similarity: number };
      if (top.similarity >= SIMILARITY_THRESHOLD) {
        clusterId = top.cluster_id;
      }
    }

    if (!clusterId) {
      clusterId = randomUUID();
      newClusters++;
    }

    const { error: updateError } = await db
      .from("email_events")
      .update({ cluster_id: clusterId })
      .eq("id", row.id);
    if (!updateError) assigned++;
  }

  return { assigned, clusters: newClusters };
}
