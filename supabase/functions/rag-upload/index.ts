import { corsHeaders } from "../_shared/cors.ts";
import { embedTexts } from "../_shared/embeddings.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Chunk text into ~400-500 token segments with 50-token overlap.
 * Token estimate: text.length / 4 (reasonable for Hebrew).
 */
function chunkText(
  text: string,
  targetTokens = 450,
  overlapTokens = 50,
): { content: string; chunk_index: number; token_count: number }[] {
  const charTarget = targetTokens * 4;
  const charOverlap = overlapTokens * 4;

  // Split by paragraph boundaries
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: { content: string; chunk_index: number; token_count: number }[] = [];
  let currentChunk = "";
  let chunkIndex = 0;

  for (const para of paragraphs) {
    // If adding this paragraph keeps us under target, merge
    if (currentChunk.length + para.length + 2 <= charTarget) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
      continue;
    }

    // If current chunk has content, finalize it
    if (currentChunk) {
      chunks.push({
        content: currentChunk,
        chunk_index: chunkIndex++,
        token_count: Math.ceil(currentChunk.length / 4),
      });

      // Overlap: take the last overlapChars of current chunk
      const overlap = currentChunk.slice(-charOverlap);
      currentChunk = overlap + "\n\n" + para;
    } else {
      currentChunk = para;
    }

    // If the paragraph itself is very large, split at sentence boundaries
    while (currentChunk.length > charTarget * 1.3) {
      // Find a sentence break near the target
      const searchEnd = charTarget;
      let splitPos = -1;

      // Try splitting at Hebrew/English sentence endings
      for (let i = searchEnd; i > charTarget * 0.5; i--) {
        if (
          currentChunk[i] === "." ||
          currentChunk[i] === "?" ||
          currentChunk[i] === "!" ||
          currentChunk[i] === "\n"
        ) {
          splitPos = i + 1;
          break;
        }
      }

      if (splitPos === -1) splitPos = charTarget;

      const piece = currentChunk.slice(0, splitPos).trim();
      if (piece) {
        chunks.push({
          content: piece,
          chunk_index: chunkIndex++,
          token_count: Math.ceil(piece.length / 4),
        });
      }

      // Keep overlap + remainder
      const remainder = currentChunk.slice(splitPos).trim();
      const overlap = piece.slice(-charOverlap);
      currentChunk = overlap + (remainder ? "\n\n" + remainder : "");
    }
  }

  // Final chunk
  if (currentChunk.trim()) {
    const finalContent = currentChunk.trim();
    chunks.push({
      content: finalContent,
      chunk_index: chunkIndex,
      token_count: Math.ceil(finalContent.length / 4),
    });
  }

  return chunks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // We'll use this to update status on error
  let documentId: string | null = null;

  try {
    const { user_id, file_name, file_size, file_type, extracted_text, storage_path } =
      await req.json();

    if (!user_id || !file_name || !extracted_text || !storage_path) {
      return new Response(
        JSON.stringify({ error: "user_id, file_name, extracted_text, and storage_path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Delete existing document if any (CASCADE deletes chunks)
    const { data: existing } = await supabase
      .from("user_documents")
      .select("id, storage_path")
      .eq("user_id", user_id)
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
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError || !docRow) {
      return new Response(
        JSON.stringify({ error: `Failed to create document: ${insertError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    documentId = docRow.id;

    // 3. Chunk the text
    const chunks = chunkText(extracted_text);

    if (chunks.length === 0) {
      await supabase
        .from("user_documents")
        .update({ status: "error", error_message: "No text content found" })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ error: "No text content to process" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Embed all chunks
    const chunkTexts = chunks.map((c) => c.content);

    const embeddings = await embedTexts(chunkTexts);

    // Check that at least some embeddings succeeded
    const validCount = embeddings.filter((e) => e !== null).length;
    if (validCount === 0) {
      await supabase
        .from("user_documents")
        .update({ status: "error", error_message: "Embedding generation failed" })
        .eq("id", documentId);

      return new Response(
        JSON.stringify({ error: "Failed to generate embeddings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
