import { corsHeaders } from "../_shared/cors.ts";
import { callLLMEngine } from "../_shared/llm-engine.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, message, conversation_id } = await req.json();

    if (!user_id || !message) {
      return new Response(
        JSON.stringify({ error: "user_id and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const convId = conversation_id || crypto.randomUUID();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch conversation history
    const { data: history } = await supabase
      .from("demo_conversations")
      .select("user_message, bot_response")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(10);

    const conversationHistory: { role: string; content: string }[] = [];
    if (history) {
      for (const row of history) {
        conversationHistory.push({ role: "user", content: row.user_message });
        conversationHistory.push({ role: "assistant", content: row.bot_response });
      }
    }

    // Call shared LLM engine (useDraft=true for preview)
    const result = await callLLMEngine(
      supabase,
      user_id,
      message,
      conversationHistory,
      undefined, // no config overrides — use defaults
      undefined, // no trigger context — bot-demo has no flows
      true,      // useDraft — preview uses draft_bot_prompt
    );

    // Save conversation turn
    await supabase.from("demo_conversations").insert({
      user_id,
      conversation_id: convId,
      user_message: message,
      bot_response: result.response,
    });

    return new Response(
      JSON.stringify({ response: result.response, conversation_id: convId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bot-demo error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
