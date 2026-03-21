import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const user_id = await getAuthenticatedUserId(req);
    const { document_id } = body as { document_id?: string };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch document — either by specific ID or the file-type document
    let query = supabase
      .from("user_documents")
      .select("id, storage_path, source_type")
      .eq("user_id", user_id);

    if (document_id) {
      query = query.eq("id", document_id);
    } else {
      query = query.eq("source_type", "file");
    }

    const { data: doc } = await query.maybeSingle();

    if (!doc) {
      return new Response(
        JSON.stringify({ success: true, message: "No document found" }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Delete storage file (only file-type documents have storage)
    if (doc.storage_path) {
      await supabase.storage.from("rag-documents").remove([doc.storage_path]);
    }

    // Delete document row (CASCADE deletes chunks)
    await supabase.from("user_documents").delete().eq("id", doc.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("rag-delete error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
