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
  "netflix.com":            { brand: "Netflix",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "spotify.com":            { brand: "Spotify",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "disneyplus.com":         { brand: "Disney+",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "hulu.com":               { brand: "Hulu",             category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "max.com":                { brand: "Max",              category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "hbomax.com":             { brand: "Max",              category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "primevideo.com":         { brand: "Prime Video",      category: "entertainment", typical_cycle: "annual",   kind: "subscription" },
  "crunchyroll.com":        { brand: "Crunchyroll",      category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "tidal.com":              { brand: "Tidal",            category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "deezer.com":             { brand: "Deezer",           category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "pandora.com":            { brand: "Pandora",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "twitch.tv":              { brand: "Twitch",           category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "youtube.com":            { brand: "YouTube",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "music.youtube.com":      { brand: "YouTube Music",    category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "paramountplus.com":      { brand: "Paramount+",       category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "peacocktv.com":          { brand: "Peacock",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "starz.com":              { brand: "Starz",            category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "showtime.com":           { brand: "Showtime",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "audible.com":            { brand: "Audible",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "masterclass.com":        { brand: "MasterClass",      category: "entertainment", typical_cycle: "annual",   kind: "subscription" },
  "funimation.com":         { brand: "Funimation",       category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "shudder.com":            { brand: "Shudder",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "mubi.com":               { brand: "MUBI",             category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "curiositystream.com":    { brand: "CuriosityStream",  category: "entertainment", typical_cycle: "annual",   kind: "subscription" },
  "britbox.com":            { brand: "BritBox",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "acorn.tv":               { brand: "Acorn TV",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "plex.tv":                { brand: "Plex",             category: "entertainment", typical_cycle: "annual",   kind: "subscription" },
  "siriusxm.com":           { brand: "SiriusXM",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "scribd.com":             { brand: "Scribd",           category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "blinkist.com":           { brand: "Blinkist",         category: "entertainment", typical_cycle: "annual",   kind: "subscription" },
  "medium.com":             { brand: "Medium",           category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "substack.com":           { brand: "Substack",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "readwise.io":            { brand: "Readwise",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "shortform.com":          { brand: "Shortform",        category: "entertainment", typical_cycle: "annual",   kind: "subscription" },
  "kindle.com":             { brand: "Kindle Unlimited", category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "viu.com":                { brand: "Viu",              category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "wetv.vip":               { brand: "WeTV",             category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "iqiyi.com":              { brand: "iQIYI",            category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "bilibili.com":           { brand: "Bilibili",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "xbox.com":               { brand: "Xbox",             category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "playstation.com":        { brand: "PlayStation",      category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "nintendo.com":           { brand: "Nintendo",         category: "entertainment", typical_cycle: "annual",   kind: "subscription" },
  "ea.com":                 { brand: "EA Play",          category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "ubisoft.com":            { brand: "Ubisoft+",         category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "trueid.net":             { brand: "TrueID",           category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },

  // ── Music ────────────────────────────────────────────────────────────────
  "applemusic.apple.com":   { brand: "Apple Music",      category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "soundcloud.com":         { brand: "SoundCloud",       category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },
  "bandcamp.com":           { brand: "Bandcamp",         category: "entertainment", typical_cycle: "one_time", kind: "retailer" },
  "qobuz.com":              { brand: "Qobuz",            category: "entertainment", typical_cycle: "annual",   kind: "subscription" },

  // ── Gaming ───────────────────────────────────────────────────────────────
  "store.steampowered.com": { brand: "Steam",            category: "entertainment", typical_cycle: "one_time", kind: "retailer" },
  "steampowered.com":       { brand: "Steam",            category: "entertainment", typical_cycle: "one_time", kind: "retailer" },
  "epicgames.com":          { brand: "Epic Games",       category: "entertainment", typical_cycle: "one_time", kind: "retailer" },
  "gog.com":                { brand: "GOG",              category: "entertainment", typical_cycle: "one_time", kind: "retailer" },
  "humblebundle.com":       { brand: "Humble Bundle",    category: "entertainment", typical_cycle: "monthly",  kind: "subscription" },

  // ── Core SaaS & Productivity ─────────────────────────────────────────────
  "anthropic.com":          { brand: "Anthropic",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "claude.ai":              { brand: "Anthropic",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "openai.com":             { brand: "OpenAI",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "chatgpt.com":            { brand: "OpenAI",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "github.com":             { brand: "GitHub",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "microsoft.com":          { brand: "Microsoft",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "notion.so":              { brand: "Notion",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "notion.com":             { brand: "Notion",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "slack.com":              { brand: "Slack",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "figma.com":              { brand: "Figma",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "linear.app":             { brand: "Linear",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "vercel.com":             { brand: "Vercel",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "dropbox.com":            { brand: "Dropbox",          category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "adobe.com":              { brand: "Adobe",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "zoom.us":                { brand: "Zoom",             category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "canva.com":              { brand: "Canva",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "loom.com":               { brand: "Loom",             category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "grammarly.com":          { brand: "Grammarly",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "airtable.com":           { brand: "Airtable",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "atlassian.com":          { brand: "Atlassian",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "hubspot.com":            { brand: "HubSpot",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "salesforce.com":         { brand: "Salesforce",       category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "intercom.com":           { brand: "Intercom",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "zendesk.com":            { brand: "Zendesk",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "mailchimp.com":          { brand: "Mailchimp",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "sendgrid.com":           { brand: "SendGrid",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "postmarkapp.com":        { brand: "Postmark",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "twilio.com":             { brand: "Twilio",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "cloudflare.com":         { brand: "Cloudflare",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "digitalocean.com":       { brand: "DigitalOcean",     category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "heroku.com":             { brand: "Heroku",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "evernote.com":           { brand: "Evernote",         category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "asana.com":              { brand: "Asana",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "monday.com":             { brand: "Monday.com",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "clickup.com":            { brand: "ClickUp",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "basecamp.com":           { brand: "Basecamp",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "trello.com":             { brand: "Trello",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "miro.com":               { brand: "Miro",             category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "superhuman.com":         { brand: "Superhuman",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "sentry.io":              { brand: "Sentry",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "datadog.com":            { brand: "Datadog",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "pagerduty.com":          { brand: "PagerDuty",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "newrelic.com":           { brand: "New Relic",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "dynatrace.com":          { brand: "Dynatrace",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "grafana.com":            { brand: "Grafana",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "splunk.com":             { brand: "Splunk",           category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "resend.com":             { brand: "Resend",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "supabase.com":           { brand: "Supabase",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "supabase.io":            { brand: "Supabase",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "railway.app":            { brand: "Railway",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "fly.io":                 { brand: "Fly.io",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "planetscale.com":        { brand: "PlanetScale",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "neon.tech":              { brand: "Neon",             category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "render.com":             { brand: "Render",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "netlify.com":            { brand: "Netlify",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "fastly.com":             { brand: "Fastly",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "retool.com":             { brand: "Retool",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "zapier.com":             { brand: "Zapier",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "make.com":               { brand: "Make",             category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "pipedream.com":          { brand: "Pipedream",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "segment.com":            { brand: "Segment",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "mixpanel.com":           { brand: "Mixpanel",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "amplitude.com":          { brand: "Amplitude",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "posthog.com":            { brand: "PostHog",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "hotjar.com":             { brand: "Hotjar",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "logrocket.com":          { brand: "LogRocket",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "fullstory.com":          { brand: "FullStory",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "typeform.com":           { brand: "Typeform",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "surveymonkey.com":       { brand: "SurveyMonkey",     category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "calendly.com":           { brand: "Calendly",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "cal.com":                { brand: "Cal.com",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "descript.com":           { brand: "Descript",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "otter.ai":               { brand: "Otter.ai",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "cursor.sh":              { brand: "Cursor",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "replit.com":             { brand: "Replit",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "jetbrains.com":          { brand: "JetBrains",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "postman.com":            { brand: "Postman",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "ngrok.com":              { brand: "ngrok",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "midjourney.com":         { brand: "Midjourney",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "elevenlabs.io":          { brand: "ElevenLabs",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "runwayml.com":           { brand: "Runway",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "stability.ai":           { brand: "Stability AI",     category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "webflow.com":            { brand: "Webflow",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "framer.com":             { brand: "Framer",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "sketch.com":             { brand: "Sketch",           category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "invisionapp.com":        { brand: "InVision",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "gusto.com":              { brand: "Gusto",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "rippling.com":           { brand: "Rippling",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "workday.com":            { brand: "Workday",          category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "okta.com":               { brand: "Okta",             category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "ringcentral.com":        { brand: "RingCentral",      category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "plausible.io":           { brand: "Plausible",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "fathom.com":             { brand: "Fathom",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "cloudinary.com":         { brand: "Cloudinary",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "algolia.com":            { brand: "Algolia",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "mongodb.com":            { brand: "MongoDB Atlas",    category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "elastic.co":             { brand: "Elastic",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "getstream.io":           { brand: "Stream",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "pusher.com":             { brand: "Pusher",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "vultr.com":              { brand: "Vultr",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "linode.com":             { brand: "Linode",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "wasabi.com":             { brand: "Wasabi",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "backblaze.com":          { brand: "Backblaze",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "box.com":                { brand: "Box",              category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "notion.new":             { brand: "Notion",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "ghost.org":              { brand: "Ghost",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "convertkit.com":         { brand: "ConvertKit",       category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "activecampaign.com":     { brand: "ActiveCampaign",   category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "klaviyo.com":            { brand: "Klaviyo",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "beehiiv.com":            { brand: "beehiiv",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "crisp.chat":             { brand: "Crisp",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "drift.com":              { brand: "Drift",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "liveChat.com":           { brand: "LiveChat",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "freshdesk.com":          { brand: "Freshdesk",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Cloud Providers ──────────────────────────────────────────────────────
  "aws.amazon.com":         { brand: "AWS",              category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "amazonaws.com":          { brand: "AWS",              category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "cloud.google.com":       { brand: "Google Cloud",     category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "azure.com":              { brand: "Azure",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "azure.microsoft.com":    { brand: "Azure",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Google Services ──────────────────────────────────────────────────────
  "accounts.google.com":    { brand: "Google",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "google.com":             { brand: "Google",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "play.google.com":        { brand: "Google Play",      category: "shopping", kind: "retailer" },

  // ── Apple ────────────────────────────────────────────────────────────────
  "apple.com":              { brand: "Apple",            category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Security & VPN ───────────────────────────────────────────────────────
  "1password.com":          { brand: "1Password",        category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "lastpass.com":           { brand: "LastPass",         category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "bitwarden.com":          { brand: "Bitwarden",        category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "dashlane.com":           { brand: "Dashlane",         category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "keeper.com":             { brand: "Keeper",           category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "keepersecurity.com":     { brand: "Keeper",           category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "nordvpn.com":            { brand: "NordVPN",          category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "expressvpn.com":         { brand: "ExpressVPN",       category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "surfshark.com":          { brand: "Surfshark",        category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "protonvpn.com":          { brand: "ProtonVPN",        category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "proton.me":              { brand: "Proton",           category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "protonmail.com":         { brand: "Proton",           category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "malwarebytes.com":       { brand: "Malwarebytes",     category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "avast.com":              { brand: "Avast",            category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "avg.com":                { brand: "AVG",              category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "norton.com":             { brand: "Norton",           category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "mcafee.com":             { brand: "McAfee",           category: "utilities", typical_cycle: "annual",   kind: "subscription" },
  "bitdefender.com":        { brand: "Bitdefender",      category: "utilities", typical_cycle: "annual",   kind: "subscription" },

  // ── Health & Fitness ─────────────────────────────────────────────────────
  "headspace.com":          { brand: "Headspace",        category: "health", typical_cycle: "annual",   kind: "subscription" },
  "calm.com":               { brand: "Calm",             category: "health", typical_cycle: "annual",   kind: "subscription" },
  "noom.com":               { brand: "Noom",             category: "health", typical_cycle: "monthly",  kind: "subscription" },
  "myfitnesspal.com":       { brand: "MyFitnessPal",     category: "health", typical_cycle: "monthly",  kind: "subscription" },
  "peloton.com":            { brand: "Peloton",          category: "health", typical_cycle: "monthly",  kind: "subscription" },
  "whoop.com":              { brand: "WHOOP",            category: "health", typical_cycle: "monthly",  kind: "subscription" },
  "ouraring.com":           { brand: "Oura",             category: "health", typical_cycle: "monthly",  kind: "subscription" },
  "strava.com":             { brand: "Strava",           category: "health", typical_cycle: "annual",   kind: "subscription" },
  "betterhelp.com":         { brand: "BetterHelp",       category: "health", typical_cycle: "monthly",  kind: "subscription" },
  "talkspace.com":          { brand: "Talkspace",        category: "health", typical_cycle: "monthly",  kind: "subscription" },
  "weightwatchers.com":     { brand: "WeightWatchers",   category: "health", typical_cycle: "monthly",  kind: "subscription" },
  "teladoc.com":            { brand: "Teladoc",          category: "health", typical_cycle: "monthly",  kind: "subscription" },

  // ── Finance & Crypto ─────────────────────────────────────────────────────
  "ynab.com":               { brand: "YNAB",             category: "finance", typical_cycle: "annual",   kind: "subscription" },
  "quickbooks.com":         { brand: "QuickBooks",       category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "xero.com":               { brand: "Xero",             category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "freshbooks.com":         { brand: "FreshBooks",       category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "coinbase.com":           { brand: "Coinbase",         category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "binance.com":            { brand: "Binance",          category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "kraken.com":             { brand: "Kraken",           category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "revolut.com":            { brand: "Revolut",          category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "monzo.com":              { brand: "Monzo",            category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "n26.com":                { brand: "N26",              category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "robinhood.com":          { brand: "Robinhood",        category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "betterment.com":         { brand: "Betterment",       category: "finance", typical_cycle: "annual",   kind: "subscription" },
  "wealthfront.com":        { brand: "Wealthfront",      category: "finance", typical_cycle: "annual",   kind: "subscription" },
  "acorns.com":             { brand: "Acorns",           category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "chime.com":              { brand: "Chime",            category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "expensify.com":          { brand: "Expensify",        category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "brex.com":               { brand: "Brex",             category: "finance", typical_cycle: "monthly",  kind: "subscription" },
  "ramp.com":               { brand: "Ramp",             category: "finance", typical_cycle: "monthly",  kind: "subscription" },

  // ── Education ────────────────────────────────────────────────────────────
  "coursera.org":           { brand: "Coursera",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "udemy.com":              { brand: "Udemy",            category: "saas", typical_cycle: "one_time", kind: "retailer" },
  "skillshare.com":         { brand: "Skillshare",       category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "duolingo.com":           { brand: "Duolingo",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "brilliant.org":          { brand: "Brilliant",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "pluralsight.com":        { brand: "Pluralsight",      category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "linkedin.com":           { brand: "LinkedIn",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "teamtreehouse.com":      { brand: "Treehouse",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "frontendmasters.com":    { brand: "Frontend Masters", category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "egghead.io":             { brand: "egghead",          category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "codecademy.com":         { brand: "Codecademy",       category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "udacity.com":            { brand: "Udacity",          category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "edx.org":                { brand: "edX",              category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "oreilly.com":            { brand: "O'Reilly",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "learning.oreilly.com":   { brand: "O'Reilly",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Domains, Hosting & Dev Tools ─────────────────────────────────────────
  "godaddy.com":            { brand: "GoDaddy",          category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "namecheap.com":          { brand: "Namecheap",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "porkbun.com":            { brand: "Porkbun",          category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "name.com":               { brand: "Name.com",         category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "hover.com":              { brand: "Hover",            category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "squarespace.com":        { brand: "Squarespace",      category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "wix.com":                { brand: "Wix",              category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "wordpress.com":          { brand: "WordPress.com",    category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "siteground.com":         { brand: "SiteGround",       category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "bluehost.com":           { brand: "Bluehost",         category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "hostgator.com":          { brand: "HostGator",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "dreamhost.com":          { brand: "DreamHost",        category: "saas", typical_cycle: "annual",   kind: "subscription" },
  "kinsta.com":             { brand: "Kinsta",           category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "wpengine.com":           { brand: "WP Engine",        category: "saas", typical_cycle: "monthly",  kind: "subscription" },
  "pantheon.io":            { brand: "Pantheon",         category: "saas", typical_cycle: "monthly",  kind: "subscription" },

  // ── Global Retailers ─────────────────────────────────────────────────────
  "amazon.com":             { brand: "Amazon",           category: "shopping", typical_cycle: "annual",   kind: "retailer" },
  "amazon.co.uk":           { brand: "Amazon",           category: "shopping", typical_cycle: "annual",   kind: "retailer" },
  "amazon.co.jp":           { brand: "Amazon",           category: "shopping", typical_cycle: "annual",   kind: "retailer" },
  "amazon.de":              { brand: "Amazon",           category: "shopping", typical_cycle: "annual",   kind: "retailer" },
  "amazon.fr":              { brand: "Amazon",           category: "shopping", typical_cycle: "annual",   kind: "retailer" },
  "amazon.com.au":          { brand: "Amazon",           category: "shopping", typical_cycle: "annual",   kind: "retailer" },
  "ebay.com":               { brand: "eBay",             category: "shopping", typical_cycle: "one_time", kind: "retailer" },
  "etsy.com":               { brand: "Etsy",             category: "shopping", typical_cycle: "one_time", kind: "retailer" },
  "shopify.com":            { brand: "Shopify",          category: "saas",     typical_cycle: "monthly",  kind: "subscription" },

  // ── Thai Telecom ─────────────────────────────────────────────────────────
  "ais.co.th":              { brand: "AIS",              category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "dtac.co.th":             { brand: "dtac",             category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "true.th":                { brand: "True",             category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "truecorp.co.th":         { brand: "True",             category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "ntplc.co.th":            { brand: "NT",               category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "tot.co.th":              { brand: "TOT",              category: "telecom", typical_cycle: "monthly", kind: "subscription" },
  "cat.net.th":             { brand: "CAT Telecom",      category: "telecom", typical_cycle: "monthly", kind: "subscription" },

  // ── Thai Wallets & Banks ─────────────────────────────────────────────────
  "truemoney.com":          { brand: "TrueMoney",        category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "kplus.co.th":            { brand: "K PLUS",           category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "kasikornbank.com":       { brand: "KBank",            category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "scb.co.th":              { brand: "SCB",              category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "krungthai.com":          { brand: "Krungthai",        category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "bangkokbank.com":        { brand: "Bangkok Bank",     category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "baac.or.th":             { brand: "BAAC",             category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "ttb.co.th":              { brand: "ttb",              category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "uob.co.th":              { brand: "UOB Thailand",     category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "cimbthai.com":           { brand: "CIMB Thai",        category: "finance", typical_cycle: "unknown", kind: "subscription" },
  "line.me":                { brand: "LINE",             category: "other",   typical_cycle: "monthly",  kind: "subscription" },

  // ── Thai Delivery, Food & Shopping ──────────────────────────────────────
  "lineman.co.th":          { brand: "LINE MAN",         category: "food",     typical_cycle: "unknown", kind: "retailer" },
  "grab.com":               { brand: "Grab",             category: "food",     typical_cycle: "unknown", kind: "retailer" },
  "foodpanda.co.th":        { brand: "foodpanda",        category: "food",     typical_cycle: "unknown", kind: "retailer" },
  "shopee.co.th":           { brand: "Shopee",           category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "shopee.com":             { brand: "Shopee",           category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "lazada.co.th":           { brand: "Lazada",           category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "lazada.com":             { brand: "Lazada",           category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "klook.com":              { brand: "Klook",            category: "other",    typical_cycle: "unknown", kind: "retailer" },
  "agoda.com":              { brand: "Agoda",            category: "other",    typical_cycle: "unknown", kind: "retailer" },
  "booking.com":            { brand: "Booking.com",      category: "other",    typical_cycle: "one_time", kind: "retailer" },
  "airbnb.com":             { brand: "Airbnb",           category: "other",    typical_cycle: "one_time", kind: "retailer" },
  "central.co.th":          { brand: "Central Online",   category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "jdcentral.com":          { brand: "JD Central",       category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "robinhood.co.th":        { brand: "Robinhood TH",     category: "food",     typical_cycle: "unknown", kind: "retailer" },
  "pandamart.com":          { brand: "pandamart",        category: "food",     typical_cycle: "unknown", kind: "retailer" },

  // ── Southeast Asian (non-Thai) ──────────────────────────────────────────
  "gojek.com":              { brand: "Gojek",            category: "food",     typical_cycle: "unknown", kind: "retailer" },
  "tokopedia.com":          { brand: "Tokopedia",        category: "shopping", typical_cycle: "unknown", kind: "retailer" },
  "traveloka.com":          { brand: "Traveloka",        category: "other",    typical_cycle: "unknown", kind: "retailer" },
  "sea.com":                { brand: "Sea / Garena",     category: "entertainment", typical_cycle: "monthly", kind: "subscription" },
  "seagroup.com":           { brand: "Sea / Garena",     category: "entertainment", typical_cycle: "monthly", kind: "subscription" },
  "maya.ph":                { brand: "Maya",             category: "finance",  typical_cycle: "unknown", kind: "subscription" },
  "gcash.com":              { brand: "GCash",            category: "finance",  typical_cycle: "unknown", kind: "subscription" },

  // ── Travel ───────────────────────────────────────────────────────────────
  "expedia.com":            { brand: "Expedia",          category: "other", typical_cycle: "one_time", kind: "retailer" },
  "hotels.com":             { brand: "Hotels.com",       category: "other", typical_cycle: "one_time", kind: "retailer" },
  "tripadvisor.com":        { brand: "Tripadvisor",      category: "other", typical_cycle: "one_time", kind: "retailer" },
  "skyscanner.net":         { brand: "Skyscanner",       category: "other", typical_cycle: "one_time", kind: "retailer" },

  // ── Payment Processors ───────────────────────────────────────────────────
  "stripe.com":             { brand: "Stripe",           category: "finance", kind: "processor" },
  "paypal.com":             { brand: "PayPal",           category: "finance", kind: "processor" },
  "square.com":             { brand: "Square",           category: "finance", kind: "processor" },
  "braintree.com":          { brand: "Braintree",        category: "finance", kind: "processor" },
  "gumroad.com":            { brand: "Gumroad",          category: "finance", kind: "processor" },
  "paddle.com":             { brand: "Paddle",           category: "finance", kind: "processor" },
  "chargebee.com":          { brand: "Chargebee",        category: "finance", kind: "processor" },
  "recurly.com":            { brand: "Recurly",          category: "finance", kind: "processor" },
  "fastspring.com":         { brand: "FastSpring",       category: "finance", kind: "processor" },
  "2checkout.com":          { brand: "2Checkout",        category: "finance", kind: "processor" },
  "checkout.com":           { brand: "Checkout.com",     category: "finance", kind: "processor" },
  "adyen.com":              { brand: "Adyen",            category: "finance", kind: "processor" },
  "mollie.com":             { brand: "Mollie",           category: "finance", kind: "processor" },
  "klarna.com":             { brand: "Klarna",           category: "finance", kind: "processor" },
  "afterpay.com":           { brand: "Afterpay",         category: "finance", kind: "processor" },
  "affirm.com":             { brand: "Affirm",           category: "finance", kind: "processor" },
  "zip.co":                 { brand: "Zip",              category: "finance", kind: "processor" },
  "gocardless.com":         { brand: "GoCardless",       category: "finance", kind: "processor" },
  "bluesnap.com":           { brand: "BlueSnap",         category: "finance", kind: "processor" },
  "razorpay.com":           { brand: "Razorpay",         category: "finance", kind: "processor" },
  "payu.com":               { brand: "PayU",             category: "finance", kind: "processor" },
  "omise.co":               { brand: "Omise",            category: "finance", kind: "processor" },
  "2c2p.com":               { brand: "2C2P",             category: "finance", kind: "processor" },
  "paymentwall.com":        { brand: "Paymentwall",      category: "finance", kind: "processor" },
  "xendit.co":              { brand: "Xendit",           category: "finance", kind: "processor" },
  "billplz.com":            { brand: "Billplz",          category: "finance", kind: "processor" },
  "wise.com":               { brand: "Wise",             category: "finance", kind: "processor" },
  "venmo.com":              { brand: "Venmo",            category: "finance", kind: "processor" },
  "cashapp.com":            { brand: "Cash App",         category: "finance", kind: "processor" },
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

export function isProcessor(domain: string): boolean {
  return lookupByDomain(domain)?.kind === "processor";
}
