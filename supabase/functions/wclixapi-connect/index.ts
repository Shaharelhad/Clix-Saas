import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const WA_GATEWAY_BASE = "https://wa.clixwapp.online";
const WA_GATEWAY_API_KEY = Deno.env.get("WA_GATEWAY_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, action } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: "status" — poll session status
    if (action === "status") {
      const statusRes = await fetch(
        `${WA_GATEWAY_BASE}/api/session/status/${user_id}`,
        { headers: { "x-api-key": WA_GATEWAY_API_KEY } }
      );
      const statusData = await statusRes.json();

      // If connected, update profile
      if (statusData.status === "connected") {
        await supabase
          .from("profiles")
          .update({ bot_status: "connected" })
          .eq("id", user_id);
      }

      return new Response(JSON.stringify(statusData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

      return new Response(JSON.stringify(delData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    }

    return new Response(JSON.stringify(startData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[wclixapi-connect] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
