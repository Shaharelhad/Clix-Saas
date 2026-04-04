import { supabase } from "@/services/supabase";
import type { TenantConfig } from "@/store/tenant.store";
import { useTenantStore } from "@/store/tenant.store";
import { applyBrandColors } from "@/lib/color-utils";

const CACHE_KEY = "clix_tenant_config";
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

/** Check if the current hostname is the main platform domain (not a tenant subdomain). */
export function isMainDomain(): boolean {
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  const baseDomain = import.meta.env.VITE_BASE_DOMAIN || "clix-bot.com";
  return hostname === baseDomain || hostname === `www.${baseDomain}`;
}

/** Extract tenant slug from the current hostname. */
export function getTenantSlug(): string {
  const hostname = window.location.hostname;

  // Local development — use env var or default to "clix"
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return import.meta.env.VITE_DEFAULT_TENANT_SLUG || "clix";
  }

  // Custom domain detection — if hostname doesn't contain the base domain,
  // it's a custom domain. Return null to trigger domain-based lookup.
  const baseDomain = import.meta.env.VITE_BASE_DOMAIN || "clix.com";
  if (!hostname.endsWith(baseDomain)) {
    return ""; // empty = custom domain, resolved separately
  }

  // Subdomain extraction: "acme.clix.com" → "acme"
  const subdomain = hostname.replace(`.${baseDomain}`, "");

  // If no subdomain (just "clix.com"), use default
  if (!subdomain || subdomain === hostname) return "clix";

  return subdomain;
}

/** Fetch tenant config from Supabase (with localStorage cache). */
async function fetchTenantConfig(slug: string): Promise<TenantConfig | null> {
  // Try cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (data.slug === slug && Date.now() - timestamp < CACHE_TTL) {
        return data as TenantConfig;
      }
    }
  } catch {
    // Cache miss or corrupt — continue to fetch
  }

  // Fetch by slug
  if (slug) {
    const { data, error } = await supabase.rpc("get_tenant_config", {
      p_slug: slug,
    });
    if (!error && data && data.length > 0) {
      const row = data[0];
      const config: TenantConfig = {
        id: row.id,
        slug: row.slug,
        name: row.name,
        logoUrl: row.logo_url,
        iconUrl: row.icon_url,
        primaryColor: row.primary_color,
        primaryHover: row.primary_hover,
        appTitle: row.app_title,
        defaultLanguage: row.default_language,
      };
      // Cache it
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: config, timestamp: Date.now() }),
      );
      return config;
    }
  }

  // Fetch by custom domain
  const hostname = window.location.hostname;
  const { data, error } = await supabase.rpc("get_tenant_by_domain", {
    p_domain: hostname,
  });
  if (!error && data && data.length > 0) {
    const row = data[0];
    const config: TenantConfig = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      logoUrl: row.logo_url,
      iconUrl: row.icon_url,
      primaryColor: row.primary_color,
      primaryHover: row.primary_hover,
      appTitle: row.app_title,
      defaultLanguage: row.default_language,
    };
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: config, timestamp: Date.now() }),
    );
    return config;
  }

  return null;
}

/** Apply tenant branding to the document (title, favicon, lang, CSS vars). */
function applyTenantBranding(config: TenantConfig) {
  // CSS custom properties
  applyBrandColors(config.primaryColor, config.primaryHover);

  // Document title
  document.title = config.appTitle || config.name;

  // Favicon
  if (config.iconUrl) {
    const link = document.querySelector(
      "link[rel='icon']",
    ) as HTMLLinkElement | null;
    if (link) link.href = config.iconUrl;
  }

  // Language & direction
  const lang = config.defaultLanguage || "he";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
}

/**
 * Initialize the tenant system. Call this BEFORE rendering React.
 * Returns the tenant config, or null if tenant not found.
 */
export async function initTenant(): Promise<TenantConfig | null> {
  const store = useTenantStore.getState();

  // Try cached config for instant paint (avoid FOUC)
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data } = JSON.parse(cached);
      if (data) applyTenantBranding(data as TenantConfig);
    }
  } catch {
    // no cache — first visit, will show defaults briefly
  }

  const slug = getTenantSlug();

  try {
    const config = await fetchTenantConfig(slug);
    if (!config) {
      store.setError("Tenant not found");
      return null;
    }
    applyTenantBranding(config);
    store.setConfig(config);
    return config;
  } catch (err) {
    store.setError("Failed to load tenant configuration");
    console.error("Tenant init error:", err);
    return null;
  }
}
