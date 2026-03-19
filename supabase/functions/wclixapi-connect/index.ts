import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const WA_GATEWAY_BASE = "https://wa.clixwapp.online";
const WA_GATEWAY_API_KEY = Deno.env.get("WA_GATEWAY_API_KEY")!;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req);
    const { action } = body;

    // Action: "status" — poll session status
    if (action === "status") {
      const statusRes = await fetch(
        `${WA_GATEWAY_BASE}/api/session/status/${user_id}`,
        { headers: { "x-api-key": WA_GATEWAY_API_KEY } }
      );
      const statusData = await statusRes.json();

      // If connected, update profile (but respect "paused" state)
      if (statusData.status === "connected") {
        await supabase
          .from("profiles")
          .update({ bot_status: "connected" })
          .eq("id", user_id)
          .neq("bot_status", "paused");
        // Publish draft bot prompt → live on successful connection
        await supabase.rpc("publish_bot_changes", { p_user_id: user_id });
      }

      return new Response(JSON.stringify(statusData), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Action: "disconnect" — delete session
    if (action === "disconnect") {
      const delRes = await fetch(
        `${WA_GATEWAY_BASE}/api/session/${user_id}`,
        {
          method: "DELETE",
          headers: { "x-api-key": WA_GATEWAY_API_KEY },
        }
      );
      const delData = await delRes.json();

      await supabase
        .from("profiles")
        .update({ bot_status: "not_created" })
        .eq("id", user_id);

      // Reset all active sessions so stale conversations don't block the next connection
      const { data: userWorkflows } = await supabase
        .from("workflows")
        .select("id")
        .eq("user_id", user_id);

      if (userWorkflows?.length) {
        const workflowIds = userWorkflows.map((w: { id: string }) => w.id);
        const { data: activeSessions } = await supabase
          .from("subscriber_sessions")
          .select("id")
          .in("workflow_id", workflowIds)
          .neq("status", "completed");

        if (activeSessions?.length) {
          await Promise.allSettled(
            activeSessions.map((s: { id: string }) =>
              supabase.rpc("reset_conversation_session", { p_session_id: s.id })
            )
          );
          console.log("[wclixapi-connect] Reset", activeSessions.length, "active sessions on disconnect");
        }
      }

      return new Response(JSON.stringify(delData), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Default action: start session (get QR code)
    const startRes = await fetch(
      `${WA_GATEWAY_BASE}/api/session/start/${user_id}`,
      {
        method: "POST",
        headers: { "x-api-key": WA_GATEWAY_API_KEY },
      }
    );
    const startData = await startRes.json();

    // If already connected, update profile
    if (startData.status === "already_connected") {
      await supabase
        .from("profiles")
        .update({ bot_status: "connected" })
        .eq("id", user_id);
      // Publish draft bot prompt → live on successful connection
      await supabase.rpc("publish_bot_changes", { p_user_id: user_id });
    }

    return new Response(JSON.stringify(startData), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[wclixapi-connect] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  }
});
