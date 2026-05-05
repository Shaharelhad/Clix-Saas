// custom-agent — dispatcher for per-customer custom agents.
//
// Routing: customerId (from request body) → AGENT_REGISTRY → agent module.
// Adding a new custom-agent customer:
//   1) Add a line to AGENT_REGISTRY below.
//   2) Append the customer UUID to the CUSTOM_AGENT_CUSTOMER_IDS secret on flow-webhook.
//
// flow-webhook owns the dispatch decision (via env-var). This function is
// stateless: if it receives a payload for a customerId we don't have an
// agent for, it returns 200 with skipped=no_agent (intentional — never
// errors back at flow-webhook so a misconfig can't break upstream).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { morTherapyAgent } from "./agents/mor-therapy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export type AgentContext = {
  supabase: SupabaseClient;
  body: {
    type?: "incoming" | "outgoing";
    customerId: string;
    from?: string;
    message?: string;
    isGroup?: boolean;
    [k: string]: unknown;
  };
};

type AgentModule = {
  run: (ctx: AgentContext) => Promise<void>;
};

// Registry of customerId → agent module.
// Populated from env so a deploy isn't required to onboard a new customer —
// just set MOR_CUSTOMER_ID (and the corresponding flow-webhook dispatch list).
const AGENT_REGISTRY: Record<string, AgentModule> = {
  [Deno.env.get("MOR_CUSTOMER_ID") ?? ""]: morTherapyAgent,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const customerId = body?.customerId as string | undefined;

    if (!customerId) {
      return new Response(JSON.stringify({ error: "missing customerId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agent = AGENT_REGISTRY[customerId];
    if (!agent) {
      console.warn("[custom-agent] no agent registered for customerId:", customerId);
      return new Response(
        JSON.stringify({ ok: true, skipped: "no_agent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await agent.run({ supabase, body });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[custom-agent] error:", err);
    return new Response(
      JSON.stringify({ error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
