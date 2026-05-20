import { supabaseAdmin } from "@/lib/supabase";
import { lookupByDomain, normalizeBrandName } from "./brands";

function logoCdnUrl(domain: string): string {
  return `https://cdn.brandfetch.io/${domain}/w/256/h/256`;
}

export interface BrandInfo {
  brand_name: string;
  logo_url: string | null;
  category: string | null;
}

export async function resolveBrand(
  senderDomain: string,
  serviceNameRaw: string | null,
): Promise<BrandInfo> {
  const domain = senderDomain.toLowerCase().replace(/^www\./, "");
  const db = supabaseAdmin();

  const record = lookupByDomain(domain);

  if (record?.kind === "processor") {
    // Processor domain — skip to service_name_raw so merchant name surfaces
    const brand = serviceNameRaw ? normalizeBrandName(serviceNameRaw) : domain.split(".")[0];
    return { brand_name: brand, logo_url: null, category: null };
  }

  if (record) {
    return {
      brand_name: record.brand,
      logo_url: logoCdnUrl(domain),
      category: record.category,
    };
  }

  // brand_cache lookup
  const { data: cached } = await db
    .from("brand_cache")
    .select("brand_name, logo_url, category")
    .eq("domain", domain)
    .maybeSingle();
  if (cached) {
    return {
      brand_name: cached.brand_name ?? serviceNameRaw ?? domain,
      logo_url: cached.logo_url,
      category: cached.category,
    };
  }

  // Fall back to extracted name, cache it for next time
  const brand = serviceNameRaw ? normalizeBrandName(serviceNameRaw) : domain.split(".")[0];
  await db.from("brand_cache").upsert({
    domain,
    brand_name: brand,
    logo_url: logoCdnUrl(domain),
    category: null,
  });
  return { brand_name: brand, logo_url: logoCdnUrl(domain), category: null };
}

export async function enrichUnresolvedEvents(userId: string): Promise<number> {
  const db = supabaseAdmin();
  const { data: events } = await db
    .from("email_events")
    .select("id, sender_domain, service_name_raw")
    .eq("user_id", userId)
    .is("service_brand", null);

  if (!events?.length) return 0;

  let enriched = 0;
  for (const ev of events) {
    if (!ev.sender_domain) continue;
    const brand = await resolveBrand(ev.sender_domain, ev.service_name_raw);
    const { error } = await db
      .from("email_events")
      .update({ service_brand: brand.brand_name })
      .eq("id", ev.id);
    if (!error) enriched++;
  }
  return enriched;
}
