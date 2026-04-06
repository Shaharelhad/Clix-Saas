import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "https://*.clix-bot.com,https://clix-bot.com,https://www.clix-bot.com,http://localhost:5173").split(",");

// --- In-memory cache for tenant custom domains ---
let cachedDomains: Set<string> = new Set();
let cacheTimestamp = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function fetchCustomDomains(): Promise<Set<string>> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("tenants")
      .select("custom_domain")
      .not("custom_domain", "is", null)
      .eq("status", "approved");

    const domains = new Set<string>();
    if (data) {
      for (const row of data) {
        if (row.custom_domain) {
          domains.add(`https://${row.custom_domain}`);
        }
      }
    }
    return domains;
  } catch {
    return cachedDomains; // on error, keep using stale cache
  }
}

/** Check if an origin matches static patterns (wildcard subdomains, exact matches). */
function isStaticAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some((pattern) => {
    if (pattern === origin) return true;
    if (pattern.startsWith("https://*.")) {
      const domain = pattern.slice(8); // ".clix-bot.com"
      return origin.endsWith(domain) || origin === `https://${domain.slice(1)}`;
    }
    return false;
  });
}

/**
 * Returns CORS headers with origin restricted to allowed domains.
 * Checks static patterns first, then tenant custom domains from DB (cached 5 min).
 * Use this for all user-facing edge functions.
 */
export async function getCorsHeaders(req: Request): Promise<Record<string, string>> {
  const origin = req.headers.get("origin") || "";

  // Fast path: check static patterns (wildcard subdomains, localhost, exact matches)
  if (isStaticAllowedOrigin(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };
  }

  // Slow path: check tenant custom domains from DB (cached)
  if (Date.now() - cacheTimestamp > CACHE_TTL) {
    cachedDomains = await fetchCustomDomains();
    cacheTimestamp = Date.now();
  }

  const allowedOrigin = cachedDomains.has(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

/**
 * Wide-open CORS headers for external webhook endpoints (flow-webhook, inngest).
 * These receive calls from third-party services, not browsers.
 */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
