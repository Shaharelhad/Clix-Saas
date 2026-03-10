import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch existing document
    const { data: doc } = await supabase
      .from("user_documents")
      .select("id, storage_path")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!doc) {
      return new Response(
        JSON.stringify({ success: true, message: "No document found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete storage file
    await supabase.storage.from("rag-documents").remove([doc.storage_path]);

    // Delete document row (CASCADE deletes chunks)
    await supabase.from("user_documents").delete().eq("id", doc.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("rag-delete error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
