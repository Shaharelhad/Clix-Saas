import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Returns the authenticated user's ID.
 *
 * Supports two modes:
 * 1. User JWT — verified via supabase.auth.getUser()
 * 2. Service role key — for internal server-to-server calls (cron jobs,
 *    Inngest schedulers). Requires `user_id` in the parsed body and
 *    must be explicitly enabled per-endpoint via `options.allowServiceRole`.
 *
 * Service role mode defaults to DENIED. Admin or destructive endpoints
 * should never opt in: a leaked service role key would bypass auth
 * entirely. Only opt in for endpoints that genuinely need server-to-server
 * access (e.g. internal cron jobs).
 *
 * Throws an error if the token is missing or invalid.
 */
export async function getAuthenticatedUserId(
  req: Request,
  body?: Record<string, unknown>,
  options: { allowServiceRole?: boolean } = {},
): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");

  // If the token is the service role key, only honor it when the endpoint
  // has explicitly opted in. This prevents a leaked service role key from
  // spoofing arbitrary user_id on admin/destructive endpoints.
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey && token === serviceRoleKey) {
    if (!options.allowServiceRole) {
      throw new Error("Service role tokens are not accepted on this endpoint");
    }
    const userId = body?.user_id as string | undefined;
    if (!userId) {
      throw new Error("Service role call requires user_id in body");
    }
    return userId;
  }

  // Otherwise verify as a user JWT
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Invalid or expired token");
  }

  return user.id;
}
