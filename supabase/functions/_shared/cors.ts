const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "https://*.clix-bot.com,https://clix-bot.com,https://www.clix-bot.com,http://localhost:5173").split(",");

/** Check if an origin matches the allowed list (supports wildcard patterns like *.clix-bot.com). */
function isAllowedOrigin(origin: string): boolean {
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
 * Supports wildcard subdomain patterns (e.g. *.clix-bot.com).
 * Use this for all user-facing edge functions.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
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
