import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FLOW_WEBHOOK_BASE =
  "https://gctijcljpjtmpyuzaohm.supabase.co/functions/v1/flow-webhook";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, instance_id, api_token } = await req.json();

    // ── Validate input ────────────────────────────────────────
    if (!user_id || !instance_id || !api_token) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "חסרים שדות חובה: user_id, instance_id, api_token",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Validate GreenAPI credentials ─────────────────────────
    const stateRes = await fetch(
      `https://api.green-api.com/waInstance${instance_id}/getStateInstance/${api_token}`
    );

    if (!stateRes.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "לא ניתן לאמת את פרטי GreenAPI. בדוק את ה-Instance ID ואת ה-API Token.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stateData = await stateRes.json();

    if (stateData.stateInstance !== "authorized") {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "ה-Instance לא מאושר. ודא שסרקת את קוד ה-QR בלוח הבקרה של GreenAPI.",
          state: stateData.stateInstance,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Store credentials in profiles table ───────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        greenapi_instance_id: instance_id,
        greenapi_token: api_token,
        bot_status: "connected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user_id);

    if (updateErr) {
      throw new Error(`Failed to save credentials: ${updateErr.message}`);
    }

    // ── Auto-configure webhook on GreenAPI ────────────────────
    const userWebhookUrl = `${FLOW_WEBHOOK_BASE}?user_id=${user_id}`;
    const setSettingsRes = await fetch(
      `https://api.green-api.com/waInstance${instance_id}/setSettings/${api_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: userWebhookUrl,
          webhookUrlToken: "",
          incomingWebhook: "yes",
          outgoingWebhook: "no",
          outgoingMessageWebhook: "no",
          outgoingAPIMessageWebhook: "no",
          stateWebhook: "no",
          deviceWebhook: "no",
        }),
      }
    );

    let webhookConfigured = false;
    if (setSettingsRes.ok) {
      const settingsData = await setSettingsRes.json();
      webhookConfigured = settingsData.saveSettings === true;
    }

    // ── Return success ────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        message: "הבוט מחובר לוואטסאפ בהצלחה!",
        webhook_url: userWebhookUrl,
        webhook_configured: webhookConfigured,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("greenapi-connect error:", err);
    return new Response(
      JSON.stringify({ success: false, message: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
