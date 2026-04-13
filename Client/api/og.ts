export const config = {
  runtime: "edge",
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const BASE_DOMAIN = process.env.VITE_BASE_DOMAIN || "clix-bot.com";

interface TenantOG {
  name: string;
  app_title: string;
  logo_url: string | null;
  icon_url: string | null;
  slug: string;
}

function extractSlugFromHost(hostname: string): string {
  if (!hostname.endsWith(BASE_DOMAIN)) return "";
  const subdomain = hostname.replace(`.${BASE_DOMAIN}`, "");
  if (!subdomain || subdomain === hostname) return "clix";
  return subdomain;
}

async function fetchTenantByDomain(hostname: string): Promise<TenantOG | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_tenant_by_domain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_domain: hostname }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return data[0] as TenantOG;
}

async function fetchTenantConfig(slug: string): Promise<TenantOG | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_tenant_config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_slug: slug }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  return data[0] as TenantOG;
}

function buildOGHtml(tenant: TenantOG, url: string): string {
  const title = tenant.app_title || tenant.name;
  const image = tenant.logo_url || `https://${BASE_DOMAIN}/clix-logo-full.png`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${tenant.name}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body><p>Redirecting...</p></body>
</html>`;
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const hostname = request.headers.get("host") || url.hostname;

  const slug = extractSlugFromHost(hostname);

  // Try subdomain lookup, then custom domain lookup
  const tenant = slug
    ? await fetchTenantConfig(slug)
    : await fetchTenantByDomain(hostname);
  if (!tenant) {
    return new Response(null, { status: 302, headers: { Location: url.toString() } });
  }

  const originalUrl = `https://${hostname}${url.pathname}${url.search}`;
  const html = buildOGHtml(tenant, originalUrl);

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
