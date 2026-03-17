import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";

/* ── URL safety check (block private/internal addresses) ── */

function isUrlSafe(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("172.") ||
      host.endsWith(".local") ||
      host === "metadata.google.internal"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/* ── Handler ── */

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();
    await getAuthenticatedUserId(req, body);

    const { integration_type, config } = body;

    if (!integration_type || !config) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing integration_type or config" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    let testUrl: string;
    const headers: Record<string, string> = {};

    if (integration_type === "cloudbeds") {
      if (!config.apiKey) {
        return new Response(
          JSON.stringify({ success: false, error: "API Key is required" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      testUrl = "https://api.cloudbeds.com/api/v1.2/getHotelDetails";
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    } else if (integration_type === "custom_api") {
      if (!config.baseUrl) {
        return new Response(
          JSON.stringify({ success: false, error: "Base URL is required" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      testUrl = config.baseUrl;

      if (config.authType === "bearer" && config.authValue) {
        headers["Authorization"] = `Bearer ${config.authValue}`;
      } else if (config.authType === "api_key" && config.authValue) {
        headers["x-api-key"] = config.authValue;
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Unknown integration type" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Block private/internal URLs
    if (!isUrlSafe(testUrl)) {
      return new Response(
        JSON.stringify({ success: false, error: "URL targets a private or internal address" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Make test request with 10s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(testUrl, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ success: false, error: "Authentication failed — check your credentials" }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      if (!response.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Server returned ${response.status}` }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // For Cloudbeds, extract propertyID from getHotelDetails response
      const result: Record<string, unknown> = { success: true };
      if (integration_type === "cloudbeds") {
        try {
          const json = await response.json();
          const propertyId = json?.data?.propertyID || json?.data?.hotelID;
          if (propertyId) {
            result.propertyId = String(propertyId);
          }
        } catch {
          // Response parsing failed — connection still succeeded
        }
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    } catch (err) {
      clearTimeout(timeout);
      const msg = err instanceof Error && err.name === "AbortError"
        ? "Request timed out — could not reach the server"
        : "Could not reach the server";
      return new Response(
        JSON.stringify({ success: false, error: msg }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
