import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { embedTexts, lastEmbedError } from "../_shared/embeddings.ts";
import { chunkText } from "../_shared/chunking.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // We'll use this to update status on error
  let documentId: string | null = null;

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req);
    const { file_name, file_size, file_type, extracted_text, storage_path } = body;

    if (!file_name || !extracted_text || !storage_path) {
      return new Response(
        JSON.stringify({ error: "file_name, extracted_text, and storage_path are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Sanitize extracted text — remove null bytes and invalid Unicode escape sequences
    const sanitizedText = extracted_text
      .replace(/\u0000/g, "")
      .replace(/\\u0000/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

    // 1. Delete existing file document if any (CASCADE deletes chunks)
    const { data: existing } = await supabase
      .from("user_documents")
      .select("id, storage_path")
      .eq("user_id", user_id)
      .eq("source_type", "file")
      .maybeSingle();

    if (existing) {
      await supabase.storage.from("rag-documents").remove([existing.storage_path]);
      await supabase.from("user_documents").delete().eq("id", existing.id);
    }

    // 2. Insert new document row (processing)
    const { data: docRow, error: insertError } = await supabase
      .from("user_documents")
      .insert({
        user_id,
        file_name,
        file_size: file_size || 0,
        file_type: file_type || "txt",
        storage_path,
        source_type: "file",
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError || !docRow) {
      return new Response(
        JSON.stringify({ error: `Failed to create document: ${insertError?.message}` }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    documentId = docRow.id;

    // 3. Chunk the text
    const chunks = chunkText(sanitizedText);

    if (chunks.length === 0) {
      await supabase
        .from("user_documents")
        .update({ status: "error", error_message: "No text content found" })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ error: "No text content to process" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // 4. Embed all chunks
    const chunkTexts = chunks.map((c) => c.content);

    const embeddings = await embedTexts(chunkTexts);

    // Check that at least some embeddings succeeded
    const validCount = embeddings.filter((e) => e !== null).length;
    if (validCount === 0) {
      const reason = lastEmbedError || "Unknown embedding error";
      console.error("[rag-upload] All embeddings failed:", reason);
      await supabase
        .from("user_documents")
        .update({ status: "error", error_message: `Embedding failed: ${reason}` })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ error: `Failed to generate embeddings: ${reason}` }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // 5. Insert chunks with embeddings (skip chunks where embedding failed)
    const chunkRows = chunks
      .map((chunk, i) => {
        if (!embeddings[i]) return null;
        return {
          user_id,
          document_id: documentId,
          chunk_index: chunk.chunk_index,
          content: chunk.content,
          token_count: chunk.token_count,
          embedding: JSON.stringify(embeddings[i]),
        };
      })
      .filter(Boolean);

    const { error: chunksError } = await supabase
      .from("document_chunks")
      .insert(chunkRows);

    if (chunksError) {
      await supabase
        .from("user_documents")
        .update({ status: "error", error_message: `Chunk insert failed: ${chunksError.message}` })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ error: `Failed to store chunks: ${chunksError.message}` }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // 6. Update document status to ready
    await supabase
      .from("user_documents")
      .update({
        status: "ready",
        chunk_count: chunkRows.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        chunk_count: chunkRows.length,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("rag-upload error:", err);

    // Try to mark document as error
    if (documentId) {
      await supabase
        .from("user_documents")
        .update({ status: "error", error_message: (err as Error).message })
        .eq("id", documentId);
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
