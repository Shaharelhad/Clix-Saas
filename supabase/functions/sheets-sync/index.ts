import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import {
  parseSheetId,
  fetchSheetData,
  processAndStoreChunks,
} from "../_shared/sheets-helpers.ts";
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

  let documentId: string | null = null;

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req, body);
    const { sheet_url, action, document_id } = body as {
      sheet_url: string;
      action: "connect" | "sync";
      document_id?: string;
    };

    if (!sheet_url || !action) {
      return new Response(
        JSON.stringify({ error: "sheet_url and action are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Parse sheet ID from URL
    const sheetId = parseSheetId(sheet_url);
    if (!sheetId) {
      return new Response(
        JSON.stringify({ error: "Invalid Google Sheet URL" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Fetch sheet data
    let sheetData;
    try {
      sheetData = await fetchSheetData(sheetId);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "SHEET_NOT_PUBLIC") {
        return new Response(
          JSON.stringify({ error: "Sheet is not publicly accessible. Make sure sharing is set to 'Anyone with the link can view'." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      if (msg === "SHEET_EMPTY") {
        return new Response(
          JSON.stringify({ error: "Sheet is empty or has only headers. Add at least one data row." }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      if (msg.startsWith("SHEET_TOO_LARGE:")) {
        const count = msg.split(":")[1];
        return new Response(
          JSON.stringify({ error: `Sheet has ${count} rows. Maximum is 2000 rows.` }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      throw err;
    }

    if (action === "sync") {
      // Re-sync: check if content changed
      if (!document_id) {
        return new Response(
          JSON.stringify({ error: "document_id required for sync action" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // Verify document belongs to user
      const { data: existingDoc } = await supabase
        .from("user_documents")
        .select("id, source_config")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single();

      if (!existingDoc) {
        return new Response(
          JSON.stringify({ error: "Document not found" }),
          { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // Check if content changed
      const prevConfig = (existingDoc.source_config as Record<string, unknown>) || {};
      if (prevConfig.last_row_hash === sheetData.contentHash) {
        // Still update last_synced_at and row_count so UI reflects the check
        await supabase
          .from("user_documents")
          .update({
            source_config: {
              ...prevConfig,
              last_synced_at: new Date().toISOString(),
              row_count: sheetData.rowCount,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", document_id);

        return new Response(
          JSON.stringify({
            success: true,
            no_changes: true,
            row_count: sheetData.rowCount,
            last_synced_at: new Date().toISOString(),
          }),
          { headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      documentId = document_id;

      // Delete old chunks
      await supabase
        .from("document_chunks")
        .delete()
        .eq("document_id", documentId);

      // Update document status
      await supabase
        .from("user_documents")
        .update({ status: "processing" })
        .eq("id", documentId);
    } else {
      // Connect: delete existing google_sheet document for this user (if any)
      const { data: existing } = await supabase
        .from("user_documents")
        .select("id")
        .eq("user_id", user_id)
        .eq("source_type", "google_sheet")
        .maybeSingle();

      if (existing) {
        await supabase.from("user_documents").delete().eq("id", existing.id);
      }

      // Insert new document row
      const { data: docRow, error: insertError } = await supabase
        .from("user_documents")
        .insert({
          user_id,
          file_name: sheetData.title,
          file_size: sheetData.formattedText.length,
          file_type: "google_sheet",
          storage_path: null,
          source_type: "google_sheet",
          source_url: sheet_url,
          source_config: {
            sheet_id: sheetId,
            last_row_hash: sheetData.contentHash,
            row_count: sheetData.rowCount,
            sheet_name: sheetData.title,
            last_synced_at: new Date().toISOString(),
          },
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
    }

    // Process: chunk + embed + store
    const chunkCount = await processAndStoreChunks(
      supabase,
      documentId,
      user_id,
      sheetData.formattedText,
    );

    // Update document to ready
    await supabase
      .from("user_documents")
      .update({
        status: "ready",
        chunk_count: chunkCount,
        file_name: sheetData.title,
        source_config: {
          sheet_id: sheetId,
          last_row_hash: sheetData.contentHash,
          row_count: sheetData.rowCount,
          sheet_name: sheetData.title,
          last_synced_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        chunk_count: chunkCount,
        row_count: sheetData.rowCount,
        sheet_name: sheetData.title,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sheets-sync error:", err);

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
