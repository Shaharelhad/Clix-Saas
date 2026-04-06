import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Custom Access Token Hook for Supabase Auth.
 *
 * This hook runs every time a JWT is issued (login, token refresh).
 * It injects the user's `tenant_id` into the JWT claims so that:
 *   1. RLS policies can use `current_tenant_id()` without a DB lookup
 *   2. Edge functions get tenant context from the token automatically
 *   3. tenant_id is never trusted from client input
 *
 * Setup in Supabase Dashboard:
 *   Auth → Hooks → Custom Access Token → Enable → Point to this edge function
 *
 * Expected input (from Supabase Auth):
 *   { "user_id": "uuid", "claims": { ...existing JWT claims } }
 *
 * Expected output:
 *   { "claims": { ...existing claims, "tenant_id": "uuid" } }
 */

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const userId = payload.user_id;
    const claims = payload.claims || {};

    if (!userId) {
      // Return claims unchanged if no user_id
      return new Response(JSON.stringify({ claims }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Look up the user's tenant_id from profiles
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id, role")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      // User has no profile yet (might be mid-signup) — return claims unchanged
      console.warn(`No profile found for user ${userId}:`, error?.message);
      return new Response(JSON.stringify({ claims }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Inject tenant_id and role into the JWT claims
    const enrichedClaims = {
      ...claims,
      tenant_id: profile.tenant_id,
      user_role: profile.role,
    };

    return new Response(JSON.stringify({ claims: enrichedClaims }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Custom access token hook error:", err);
    // On error, return the original claims to avoid breaking auth
    try {
      const payload = await req.clone().json();
      return new Response(JSON.stringify({ claims: payload.claims || {} }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ claims: {} }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }
});
