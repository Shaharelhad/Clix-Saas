import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Returns the authenticated user's ID.
 *
 * Supports two modes:
 * 1. User JWT — verified via supabase.auth.getUser()
 * 2. Service role key — for internal server-to-server calls, requires
 *    `user_id` in the parsed body as a fallback
 *
 * Throws an error if the token is missing or invalid.
 */
export async function getAuthenticatedUserId(
  req: Request,
  body?: Record<string, unknown>,
): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.replace("Bearer ", "");

  // If the token is the service role key, trust user_id from body (internal call)
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRoleKey && token === serviceRoleKey) {
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
