export type Category =
  | "entertainment"
  | "saas"
  | "health"
  | "food"
  | "finance"
  | "utilities"
  | "telecom"
  | "shopping"
  | "other";

export type Cycle =
  | "monthly"
  | "annual"
  | "weekly"
  | "quarterly"
  | "one_time"
  | "unknown";

export interface BrandRecord {
  brand: string;
  category: Category;
  typical_cycle?: Cycle;
  kind: "subscription" | "retailer" | "processor";
}

export const BRANDS: Record<string, BrandRecord> = {
  // ── Streaming & Entertainment ────────────────────────────────────────────
  "netflix.com":            { brand: "Netflix",        category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "spotify.com":            { brand: "Spotify",        category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "disneyplus.com":         { brand: "Disney+",        category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "hulu.com":               { brand: "Hulu",           category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "max.com":                { brand: "Max",            category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "hbomax.com":             { brand: "Max",            category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "primevideo.com":         { brand: "Prime Video",    category: "entertainment", typical_cycle: "annual",   kind: "subscription" },
  "crunchyroll.com":        { brand: "Crunchyroll",    category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "tidal.com":              { brand: "Tidal",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "deezer.com":             { brand: "Deezer",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "pandora.com":            { brand: "Pandora",        category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "twitch.tv":              { brand: "Twitch",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "youtube.com":            { brand: "YouTube",        category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "music.youtube.com":      { brand: "YouTube Music",  category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "paramountplus.com":      { brand: "Paramount+",     category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "peacocktv.com":          { brand: "Peacock",        category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "starz.com":              { brand: "Starz",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "audible.com":            { brand: "Audible",        category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "kindle.com":             { brand: "Kindle Unlimited", category: "entertainment", typical_cycle: "monthly", kind: "subscription" },
  "masterclass.com":        { brand: "MasterClass",    category: "entertainment", typical_cycle: "annual",   kind: "subscription" },

  // ── SaaS & Productivity ──────────────────────────────────────────────────
  "anthropic.com":          { brand: "Anthropic",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "claude.ai":              { brand: "Anthropic",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "openai.com":             { brand: "OpenAI",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "chatgpt.com":            { brand: "OpenAI",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "github.com":             { brand: "GitHub",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "microsoft.com":          { brand: "Microsoft",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "notion.so":              { brand: "Notion",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "notion.com":             { brand: "Notion",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "slack.com":              { brand: "Slack",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "figma.com":              { brand: "Figma",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "linear.app":             { brand: "Linear",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "vercel.com":             { brand: "Vercel",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "dropbox.com":            { brand: "Dropbox",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "adobe.com":              { brand: "Adobe",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "zoom.us":                { brand: "Zoom",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "canva.com":              { brand: "Canva",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "loom.com":               { brand: "Loom",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "grammarly.com":          { brand: "Grammarly",      category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "airtable.com":           { brand: "Airtable",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "atlassian.com":          { brand: "Atlassian",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "hubspot.com":            { brand: "HubSpot",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "salesforce.com":         { brand: "Salesforce",     category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "intercom.com":           { brand: "Intercom",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "zendesk.com":            { brand: "Zendesk",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "mailchimp.com":          { brand: "Mailchimp",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "sendgrid.com":           { brand: "SendGrid",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "postmarkapp.com":        { brand: "Postmark",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "twilio.com":             { brand: "Twilio",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "cloudflare.com":         { brand: "Cloudflare",     category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "digitalocean.com":       { brand: "DigitalOcean",   category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "heroku.com":             { brand: "Heroku",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "1password.com":          { brand: "1Password",      category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "lastpass.com":           { brand: "LastPass",       category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "bitwarden.com":          { brand: "Bitwarden",      category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "nordvpn.com":            { brand: "NordVPN",        category: "utilities", typical_cycle: "annual", kind: "subscription" },
  "expressvpn.com":         { brand: "ExpressVPN",     category: "utilities", typical_cycle: "annual", kind: "subscription" },
  "evernote.com":           { brand: "Evernote",       category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "asana.com":              { brand: "Asana",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "monday.com":             { brand: "Monday.com",     category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "clickup.com":            { brand: "ClickUp",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "basecamp.com":           { brand: "Basecamp",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "trello.com":             { brand: "Trello",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "miro.com":               { brand: "Miro",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "superhuman.com":         { brand: "Superhuman",     category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "fastly.com":             { brand: "Fastly",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "sentry.io":              { brand: "Sentry",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "datadog.com":            { brand: "Datadog",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "pagerduty.com":          { brand: "PagerDuty",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "segment.com":            { brand: "Segment",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "mixpanel.com":           { brand: "Mixpanel",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "amplitude.com":          { brand: "Amplitude",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "resend.com":             { brand: "Resend",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "supabase.com":           { brand: "Supabase",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "supabase.io":            { brand: "Supabase",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "railway.app":            { brand: "Railway",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "fly.io":                 { brand: "Fly.io",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "planetscale.com":        { brand: "PlanetScale",    category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "neon.tech":              { brand: "Neon",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Cloud Providers ──────────────────────────────────────────────────────
  "aws.amazon.com":         { brand: "AWS",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "amazonaws.com":          { brand: "AWS",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "cloud.google.com":       { brand: "Google Cloud",   category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "azure.com":              { brand: "Azure",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Google Services ──────────────────────────────────────────────────────
  "accounts.google.com":    { brand: "Google",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "google.com":             { brand: "Google",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "play.google.com":        { brand: "Google Play",    category: "shopping", kind: "retailer" },

  // ── Apple ────────────────────────────────────────────────────────────────
  "apple.com":              { brand: "Apple",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Health & Fitness ─────────────────────────────────────────────────────
  "headspace.com":          { brand: "Headspace",      category: "health", typical_cycle: "annual",  kind: "subscription" },
  "calm.com":               { brand: "Calm",           category: "health", typical_cycle: "annual",  kind: "subscription" },
  "noom.com":               { brand: "Noom",           category: "health", typical_cycle: "monthly", kind: "subscription" },
  "myfitnesspal.com":       { brand: "MyFitnessPal",   category: "health", typical_cycle: "monthly", kind: "subscription" },
  "peloton.com":            { brand: "Peloton",        category: "health", typical_cycle: "monthly", kind: "subscription" },

  // ── Finance ──────────────────────────────────────────────────────────────
  "mint.com":               { brand: "Mint",           category: "finance", typical_cycle: "monthly", kind: "subscription" },
  "ynab.com":               { brand: "YNAB",           category: "finance", typical_cycle: "annual",  kind: "subscription" },
  "quickbooks.com":         { brand: "QuickBooks",     category: "finance", typical_cycle: "monthly", kind: "subscription" },
  "xero.com":               { brand: "Xero",           category: "finance", typical_cycle: "monthly", kind: "subscription" },

  // ── Thai Telecom ─────────────────────────────────────────────────────────
  "ais.co.th":              { brand: "AIS",            category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "dtac.co.th":             { brand: "dtac",           category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "true.th":                { brand: "True",           category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "truecorp.co.th":         { brand: "True",           category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "ntplc.co.th":            { brand: "NT",             category: "telecom", typical_cycle: "monthly", kind: "subscription" },

  // ── Thai Wallets & Payments ──────────────────────────────────────────────
  "truemoney.com":          { brand: "TrueMoney",      category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "kplus.co.th":            { brand: "K PLUS",         category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "kasikornbank.com":       { brand: "KBank",          category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "scb.co.th":              { brand: "SCB",            category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "krungthai.com":          { brand: "Krungthai",      category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "bangkokbank.com":        { brand: "Bangkok Bank",   category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "line.me":                { brand: "LINE",           category: "other",   typical_cycle: "monthly", kind: "subscription" },

  // ── Thai Delivery & Shopping ─────────────────────────────────────────────
  "lineman.co.th":          { brand: "LINE MAN",       category: "food",     typical_cycle: "unknown", kind: "retailer" },
  "grab.com":               { brand: "Grab",           category: "food",     typical_cycle: "unknown", kind: "retailer" },
  "foodpanda.co.th":        { brand: "foodpanda",      category: "food",     typical_cycle: "unknown", kind: "retailer" },
  "shopee.co.th":           { brand: "Shopee",         category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "lazada.co.th":           { brand: "Lazada",         category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "klook.com":              { brand: "Klook",          category: "other",    typical_cycle: "unknown", kind: "retailer" },
  "agoda.com":              { brand: "Agoda",          category: "other",    typical_cycle: "unknown", kind: "retailer" },

  // ── Global Retailers ─────────────────────────────────────────────────────
  "amazon.com":             { brand: "Amazon",         category: "shopping", typical_cycle: "annual", kind: "retailer" },
  "amazon.co.uk":           { brand: "Amazon",         category: "shopping", typical_cycle: "annual", kind: "retailer" },
  "store.steampowered.com": { brand: "Steam",          category: "entertainment", typical_cycle: "one_time", kind: "retailer" },
  "epicgames.com":          { brand: "Epic Games",     category: "entertainment", typical_cycle: "one_time", kind: "retailer" },

  // ── Education ────────────────────────────────────────────────────────────
  "coursera.org":           { brand: "Coursera",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "udemy.com":              { brand: "Udemy",          category: "saas", typical_cycle: "one_time", kind: "retailer" },
  "skillshare.com":         { brand: "Skillshare",     category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "duolingo.com":           { brand: "Duolingo",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "brilliant.org":          { brand: "Brilliant",      category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "khanacademy.org":        { brand: "Khan Academy",   category: "saas", typical_cycle: "unknown",  kind: "subscription" },

  // ── Domains & Hosting ────────────────────────────────────────────────────
  "godaddy.com":            { brand: "GoDaddy",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "namecheap.com":          { brand: "Namecheap",      category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "squarespace.com":        { brand: "Squarespace",    category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "wix.com":                { brand: "Wix",            category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "wordpress.com":          { brand: "WordPress.com",  category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "webflow.com":            { brand: "Webflow",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "ghost.org":              { brand: "Ghost",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "substack.com":           { brand: "Substack",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Payment Processors (kind = "processor") ──────────────────────────────
  "stripe.com":             { brand: "Stripe",         category: "finance", kind: "processor" },
  "paypal.com":             { brand: "PayPal",         category: "finance", kind: "processor" },
  "square.com":             { brand: "Square",         category: "finance", kind: "processor" },
  "braintree.com":          { brand: "Braintree",      category: "finance", kind: "processor" },
  "gumroad.com":            { brand: "Gumroad",        category: "finance", kind: "processor" },
  "paddle.com":             { brand: "Paddle",         category: "finance", kind: "processor" },
  "chargebee.com":          { brand: "Chargebee",      category: "finance", kind: "processor" },
  "recurly.com":            { brand: "Recurly",        category: "finance", kind: "processor" },
  "fastspring.com":         { brand: "FastSpring",     category: "finance", kind: "processor" },
  "2checkout.com":          { brand: "2Checkout",      category: "finance", kind: "processor" },
  "checkout.com":           { brand: "Checkout.com",   category: "finance", kind: "processor" },
  "adyen.com":              { brand: "Adyen",          category: "finance", kind: "processor" },
  "wise.com":               { brand: "Wise",           category: "finance", kind: "processor" },
  "venmo.com":              { brand: "Venmo",          category: "finance", kind: "processor" },
  "cashapp.com":            { brand: "Cash App",       category: "finance", kind: "processor" },
};

const LEGAL_SUFFIX_RE = /\s*[,.]?\s*\b(inc|llc|ltd|limited|corp|corporation|ab|gmbh|co|company|plc|s\.a|sas|bv|ag|pty|nv)\b\.?$/i;

export function normalizeBrandName(raw: string): string {
  return raw.replace(LEGAL_SUFFIX_RE, "").trim();
}

export function lookupByDomain(domain: string): BrandRecord | null {
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (BRANDS[d]) return BRANDS[d];
  // Parent-domain fallback: mail.stripe.com → stripe.com
  const parts = d.split(".");
  if (parts.length > 2) {
    const parent = parts.slice(-2).join(".");
    if (BRANDS[parent]) return BRANDS[parent];
  }
  return null;
}
