import { supabaseAdmin } from "@/lib/supabase";
import { THAILAND_BRANDS } from "@/lib/thailand";
import { PROCESSOR_DOMAINS, DOMAIN_CANONICAL } from "./brand-aliases";

// Free Brandfetch CDN — no API key needed for logo URLs
function logoCdnUrl(domain: string): string {
  return `https://cdn.brandfetch.io/${domain}/w/256/h/256`;
}

const DOMAIN_TO_BRAND: Record<string, string> = {
  "anthropic.com": "Anthropic",
  "apple.com": "Apple",
  "netflix.com": "Netflix",
  "spotify.com": "Spotify",
  "github.com": "GitHub",
  "microsoft.com": "Microsoft",
  "amazon.com": "Amazon",
  "adobe.com": "Adobe",
  "dropbox.com": "Dropbox",
  "notion.so": "Notion",
  "slack.com": "Slack",
  "figma.com": "Figma",
  "linear.app": "Linear",
  "vercel.com": "Vercel",
  "openai.com": "OpenAI",
  ...THAILAND_BRANDS,
};

const KNOWN_CATEGORIES: Record<string, string> = {
  Netflix: "entertainment",
  Spotify: "entertainment",
  "Apple Music": "entertainment",
  Anthropic: "saas",
  OpenAI: "saas",
  GitHub: "saas",
  Notion: "saas",
  Slack: "saas",
  Figma: "saas",
  Linear: "saas",
  Vercel: "saas",
  Dropbox: "saas",
  Adobe: "saas",
  Microsoft: "saas",
  Apple: "saas",
};

export interface BrandInfo {
  brand_name: string;
  logo_url: string | null;
  category: string | null;
}

/**
 * Resolve a canonical brand from a sender domain and (optional) raw service name.
 * Strategy:
 *   1. Static domain map (hard-coded for known SaaS + Thai brands)
 *   2. brand_cache table (previously discovered brands)
 *   3. Fall back to extracted service_name_raw
 *   4. Always set a CDN logo URL (Brandfetch free CDN)
 */
export async function resolveBrand(
  senderDomain: string,
  serviceNameRaw: string | null,
): Promise<BrandInfo> {
  const domain = senderDomain.toLowerCase();
  const db = supabaseAdmin();

  // 0. If domain is a payment processor, skip to service_name_raw immediately
  //    (Stripe/PayPal receipts should resolve to the merchant, not the processor)
  if (!PROCESSOR_DOMAINS.has(domain)) {
    // 1a. DOMAIN_CANONICAL aliases (higher priority than static map)
    if (DOMAIN_CANONICAL[domain]) {
      const name = DOMAIN_CANONICAL[domain];
      return {
        brand_name: name,
        logo_url: logoCdnUrl(domain),
        category: KNOWN_CATEGORIES[name] ?? null,
      };
    }

    // 1b. Static map
    if (DOMAIN_TO_BRAND[domain]) {
      const name = DOMAIN_TO_BRAND[domain];
      return {
        brand_name: name,
        logo_url: logoCdnUrl(domain),
        category: KNOWN_CATEGORIES[name] ?? null,
      };
    }

    // 2. brand_cache
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
  }

  // 3. Fall back to raw extracted name + cache it for next time (domain-based logo URL)
  const brand = serviceNameRaw?.trim() || domain.split(".")[0];
  const logoForDomain = PROCESSOR_DOMAINS.has(domain) ? null : logoCdnUrl(domain);
  if (!PROCESSOR_DOMAINS.has(domain)) {
    await db.from("brand_cache").upsert({
      domain,
      brand_name: brand,
      logo_url: logoForDomain,
      category: null,
    });
  }
  return { brand_name: brand, logo_url: logoForDomain, category: null };
}

/**
 * Enrich all email_events for a user that have service_name_raw but no service_brand.
 */
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
