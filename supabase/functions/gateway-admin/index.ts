import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const WA_GATEWAY_BASE = "https://wa.clixwapp.online";
const WA_GATEWAY_API_KEY = Deno.env.get("WA_GATEWAY_API_KEY")!;

/** Verify the caller is an admin */
async function requireAdmin(userId: string): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (data?.role !== "admin") {
    throw new Error("Forbidden: admin role required");
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const body = await req.json();
    const userId = await getAuthenticatedUserId(req, body);
    await requireAdmin(userId);

    const { action } = body;

    // ── LIST ─────────────────────────────────────────────────
    if (action === "list") {
      const { data, error } = await supabase
        .from("gateway_instances")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(cors, { instances: data ?? [] });
    }

    // ── HEALTH ───────────────────────────────────────────────
    if (action === "health") {
      try {
        const res = await fetch(`${WA_GATEWAY_BASE}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        const d = await res.json();
        return json(cors, { healthy: d.status === "ok" });
      } catch {
        return json(cors, { healthy: false });
      }
    }

    // ── CREATE ───────────────────────────────────────────────
    if (action === "create") {
      const { instance_id, label, webhook_url } = body;
      if (!instance_id || typeof instance_id !== "string") {
        return json(cors, { error: "instance_id is required" }, 400);
      }
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(instance_id)) {
        return json(cors, { error: "instance_id must be lowercase alphanumeric with hyphens" }, 400);
      }

      // Insert into DB (no session start — user generates QR manually)
      const { error: insertErr } = await supabase
        .from("gateway_instances")
        .insert({
          instance_id,
          label: label || instance_id,
          webhook_url: webhook_url || null,
          created_by: userId,
          status: "not_found",
        });
      if (insertErr) {
        if (insertErr.code === "23505") {
          return json(cors, { error: "instance_id already exists" }, 409);
        }
        throw insertErr;
      }

      return json(cors, { success: true, instance_id });
    }

    // ── START (get QR for existing instance) ─────────────────
    if (action === "start") {
      const { instance_id } = body;
      if (!instance_id) return json(cors, { error: "instance_id required" }, 400);

      const startRes = await fetch(
        `${WA_GATEWAY_BASE}/api/session/start/${instance_id}`,
        {
          method: "POST",
          headers: { "x-api-key": WA_GATEWAY_API_KEY },
        }
      );
      const startData = await startRes.json();

      const newStatus = startData.status === "already_connected" ? "connected" : (startData.status || "qr_generated");
      await supabase
        .from("gateway_instances")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("instance_id", instance_id);

      return json(cors, startData);
    }

    // ── STATUS ───────────────────────────────────────────────
    if (action === "status") {
      const { instance_id } = body;
      if (!instance_id) return json(cors, { error: "instance_id required" }, 400);

      const statusRes = await fetch(
        `${WA_GATEWAY_BASE}/api/session/status/${instance_id}`,
        { headers: { "x-api-key": WA_GATEWAY_API_KEY } }
      );
      const statusData = await statusRes.json();

      // Sync status back to DB
      const updates: Record<string, unknown> = {
        status: statusData.status || "not_found",
        updated_at: new Date().toISOString(),
      };
      if (statusData.phoneNumber) {
        updates.phone_number = statusData.phoneNumber;
      }
      await supabase
        .from("gateway_instances")
        .update(updates)
        .eq("instance_id", instance_id);

      return json(cors, statusData);
    }

    // ── DISCONNECT ───────────────────────────────────────────
    if (action === "disconnect") {
      const { instance_id } = body;
      if (!instance_id) return json(cors, { error: "instance_id required" }, 400);

      const delRes = await fetch(
        `${WA_GATEWAY_BASE}/api/session/${instance_id}`,
        {
          method: "DELETE",
          headers: { "x-api-key": WA_GATEWAY_API_KEY },
        }
      );
      const delData = await delRes.json();

      await supabase
        .from("gateway_instances")
        .update({ status: "not_found", phone_number: null, updated_at: new Date().toISOString() })
        .eq("instance_id", instance_id);

      return json(cors, delData);
    }

    // ── DELETE ────────────────────────────────────────────────
    if (action === "delete") {
      const { instance_id } = body;
      if (!instance_id) return json(cors, { error: "instance_id required" }, 400);

      // Disconnect first (ignore errors)
      try {
        await fetch(
          `${WA_GATEWAY_BASE}/api/session/${instance_id}`,
          {
            method: "DELETE",
            headers: { "x-api-key": WA_GATEWAY_API_KEY },
          }
        );
      } catch { /* ignore */ }

      const { error } = await supabase
        .from("gateway_instances")
        .delete()
        .eq("instance_id", instance_id);
      if (error) throw error;

      return json(cors, { success: true });
    }

    // ── SET WEBHOOK ──────────────────────────────────────────
    if (action === "set_webhook") {
      const { instance_id, webhook_url } = body;
      if (!instance_id) return json(cors, { error: "instance_id required" }, 400);

      const { error } = await supabase
        .from("gateway_instances")
        .update({ webhook_url: webhook_url || null, updated_at: new Date().toISOString() })
        .eq("instance_id", instance_id);
      if (error) throw error;

      return json(cors, { success: true });
    }

    // ── SEND TEST MESSAGE ────────────────────────────────────
    if (action === "send_test") {
      const { instance_id, to, message } = body;
      if (!instance_id || !to || !message) {
        return json(cors, { error: "instance_id, to, and message required" }, 400);
      }

      const sendRes = await fetch(
        `${WA_GATEWAY_BASE}/api/session/send/${instance_id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": WA_GATEWAY_API_KEY,
          },
          body: JSON.stringify({ to, message }),
        }
      );
      const sendData = await sendRes.json();
      return json(cors, sendData);
    }

    // ── SEND BUTTONS ─────────────────────────────────────────
    if (action === "send_buttons") {
      const { instance_id, to, body: msgBody, buttons, header, footer } = body;
      if (!instance_id || !to || !msgBody || !buttons?.length) {
        return json(cors, { error: "instance_id, to, body, and buttons required" }, 400);
      }

      const sendRes = await fetch(
        `${WA_GATEWAY_BASE}/api/session/send-buttons/${instance_id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": WA_GATEWAY_API_KEY,
          },
          body: JSON.stringify({ to, body: msgBody, buttons, header, footer }),
        }
      );
      const sendData = await sendRes.json();
      return json(cors, sendData);
    }

    return json(cors, { error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[gateway-admin] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Forbidden") ? 403
      : message.includes("Authorization") || message.includes("token") ? 401
      : 500;
    return json(cors, { error: message }, status);
  }
});

function json(
  cors: Record<string, string>,
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
