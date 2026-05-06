// Cloudbeds-specific response post-processing.
//
// Background: getAvailableRoomTypes returns each room twice when the property
// has Rate Plans configured — once as the "Base Rate" (ratePlanNamePublic
// === "default") and once per applicable Rate Plan. The Booking Engine UI
// hides the Base Rate, so quoting it in the bot creates pricing mismatches.
// Cloudbeds support (Ticket #3338025) instructed us to filter Base Rate
// entries client-side and surface the Rate Plan price instead.

export interface CloudbedsRoom {
  roomTypeID?: string;
  roomTypeName?: string;
  roomRate?: number | string;
  roomRateID?: string;
  ratePlanNamePublic?: string;
  ratePlanNamePrivate?: string;
  derivedType?: string;
  derivedValue?: string | number;
  adultsExtraCharge?: Record<string, number | string>;
  [key: string]: unknown;
}

const BASE_RATE_NAMES = new Set(["default", "base rate", "base"]);

export function isCloudbedsBaseRate(room: CloudbedsRoom | null | undefined): boolean {
  if (!room) return false;
  const pub = String(room.ratePlanNamePublic ?? "").toLowerCase().trim();
  const priv = String(room.ratePlanNamePrivate ?? "").toLowerCase().trim();
  if (BASE_RATE_NAMES.has(pub) || BASE_RATE_NAMES.has(priv)) return true;
  // Heuristic fallback: if there's no rate plan name AND no derivedType/derivedValue,
  // it's almost certainly the raw Base Rate.
  if (!pub && !priv && room.derivedType == null && room.derivedValue == null) return true;
  return false;
}

export function pickCheapestNonBaseRate(
  propertyRooms: CloudbedsRoom[] | null | undefined,
): CloudbedsRoom | null {
  if (!Array.isArray(propertyRooms) || propertyRooms.length === 0) return null;
  const nonBase = propertyRooms.filter((r) => !isCloudbedsBaseRate(r));
  if (nonBase.length === 0) return null;
  return nonBase.reduce((min, r) => {
    const minRate = parseFloat(String(min.roomRate ?? "Infinity"));
    const rRate = parseFloat(String(r.roomRate ?? "Infinity"));
    return rRate < minRate ? r : min;
  });
}

// Path-segment language codes Cloudbeds reservation URLs use. The stored
// bookingUrl typically embeds one of these (e.g. ".../en/reservation/...").
// Extend cautiously — adding a code here means we'll swap it out when the
// node's outputLanguage requests a different one.
const LANG_PATH_RE = /\/(en|he|es|fr|de|it|pt|ja|zh|ru|ar)\//;

// Fetch a USD→<target> exchange rate, preferring openexchangerates.org (the
// same provider Cloudbeds' booking engine uses), with open.er-api.com as a
// fallback so the bot doesn't break if openexchangerates fails or the app_id
// is missing. Returns `null` if both sources fail — callers should skip
// conversion in that case.
//
// openexchangerates is hourly-updated and free for up to 1000 req/month
// on the "Forever Free" plan; USD is the only allowed base currency on
// that tier. open.er-api.com supports any base currency.
export async function fetchExchangeRate(
  from: "USD" | "EUR",
  to: string,
): Promise<number | null> {
  const target = to.toUpperCase();
  const appId = Deno.env.get("OPENEXCHANGE_APP_ID");
  // openexchangerates.org — preferred, only supports USD base on free tier
  if (appId && from === "USD") {
    try {
      const r = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=${target}`,
      );
      if (r.ok) {
        const j = await r.json();
        const rate = j?.rates?.[target];
        if (typeof rate === "number" && rate > 0) return rate;
      }
    } catch { /* fall through */ }
  }
  // open.er-api.com — fallback (also free, supports any base)
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (r.ok) {
      const j = await r.json();
      const rate = j?.rates?.[target];
      if (typeof rate === "number" && rate > 0) return rate;
    }
  } catch { /* fall through */ }
  return null;
}

// Apply per-node language and currency to a Cloudbeds reservation URL.
//
// Behavior:
// - Both opts undefined → URL returned unchanged (backward compat).
// - outputLanguage set → swap the language path segment if the URL has a
//   recognized one; URLs without a recognized segment are returned unchanged
//   (no accidental mangling for custom URL layouts).
// - outputCurrency set → set/replace the `currency` query param (lowercased).
// - On any parse failure, return the original URL.
export function applyBookingLinkLocale(
  url: string,
  opts: { outputLanguage?: string; outputCurrency?: string },
): string {
  if (!url) return url;
  const lang = opts.outputLanguage?.toLowerCase().trim();
  const currency = opts.outputCurrency?.toLowerCase().trim();
  if (!lang && !currency) return url;
  try {
    const u = new URL(url);
    if (lang && LANG_PATH_RE.test(u.pathname)) {
      u.pathname = u.pathname.replace(LANG_PATH_RE, `/${lang}/`);
    }
    if (currency) {
      u.searchParams.set("currency", currency);
    }
    return u.toString();
  } catch {
    return url;
  }
}
