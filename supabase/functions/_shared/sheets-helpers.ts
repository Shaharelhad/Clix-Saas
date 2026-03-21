/**
 * Shared Google Sheets helpers — used by sheets-sync edge function and Inngest cron.
 */

import { chunkText } from "./chunking.ts";
import { embedTexts, lastEmbedError } from "./embeddings.ts";

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const MAX_ROWS = 2000;

export interface SheetData {
  title: string;
  headers: string[];
  rows: string[][];
  formattedText: string;
  contentHash: string;
  rowCount: number;
}

export interface SyncResult {
  success: boolean;
  no_changes?: boolean;
  document_id?: string;
  chunk_count?: number;
  error?: string;
}

/**
 * Parse a Google Sheet ID from various URL formats.
 */
export function parseSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

/**
 * Compute SHA-256 hash of text content.
 */
export async function hashContent(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Fetch sheet data from Google Sheets API and format as text.
 */
export async function fetchSheetData(sheetId: string): Promise<SheetData> {
  const apiKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_SHEETS_API_KEY not configured");

  // Fetch metadata (title)
  const metaRes = await fetch(
    `${SHEETS_API_BASE}/${sheetId}?fields=properties.title&key=${apiKey}`,
  );
  if (!metaRes.ok) {
    const errText = await metaRes.text();
    if (metaRes.status === 403 || metaRes.status === 404) {
      throw new Error("SHEET_NOT_PUBLIC");
    }
    throw new Error(`Google Sheets API error (${metaRes.status}): ${errText}`);
  }
  const meta = await metaRes.json();
  const title = meta?.properties?.title ?? "Untitled Sheet";

  // Fetch all values
  const valuesRes = await fetch(
    `${SHEETS_API_BASE}/${sheetId}/values/A:ZZ?key=${apiKey}`,
  );
  if (!valuesRes.ok) {
    const errText = await valuesRes.text();
    throw new Error(`Google Sheets values API error (${valuesRes.status}): ${errText}`);
  }
  const valuesData = await valuesRes.json();
  const allRows: string[][] = valuesData?.values ?? [];

  if (allRows.length < 2) {
    throw new Error("SHEET_EMPTY");
  }

  const headers = allRows[0];
  const dataRows = allRows.slice(1).filter((row) => row.some((cell) => cell?.trim()));

  if (dataRows.length > MAX_ROWS) {
    throw new Error(`SHEET_TOO_LARGE:${dataRows.length}`);
  }

  // Format each row as "header: value" pairs
  const formattedRows = dataRows.map((row) => {
    return headers
      .map((header, i) => {
        const value = row[i]?.trim() ?? "";
        return value ? `${header}: ${value}` : null;
      })
      .filter(Boolean)
      .join("\n");
  });

  const formattedText = formattedRows.join("\n\n---\n\n");
  const contentHash = await hashContent(formattedText);

  return {
    title,
    headers,
    rows: dataRows,
    formattedText,
    contentHash,
    rowCount: dataRows.length,
  };
}

/**
 * Chunk, embed, and store sheet data as document chunks.
 * Returns the number of chunks created.
 */
export async function processAndStoreChunks(
  supabase: { from: (table: string) => unknown } & Record<string, unknown>,
  documentId: string,
  userId: string,
  formattedText: string,
): Promise<number> {
  // deno-lint-ignore no-explicit-any
  const sb = supabase as any;

  const sanitizedText = formattedText
    .replace(/\u0000/g, "")
    .replace(/\\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  const chunks = chunkText(sanitizedText);
  if (chunks.length === 0) throw new Error("No content to process");

  const chunkTexts = chunks.map((c) => c.content);
  const embeddings = await embedTexts(chunkTexts);

  const validCount = embeddings.filter((e) => e !== null).length;
  if (validCount === 0) {
    throw new Error(`Embedding failed: ${lastEmbedError || "Unknown error"}`);
  }

  const chunkRows = chunks
    .map((chunk, i) => {
      if (!embeddings[i]) return null;
      return {
        user_id: userId,
        document_id: documentId,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        token_count: chunk.token_count,
        embedding: JSON.stringify(embeddings[i]),
      };
    })
    .filter(Boolean);

  const { error: chunksError } = await sb.from("document_chunks").insert(chunkRows);
  if (chunksError) {
    throw new Error(`Chunk insert failed: ${chunksError.message}`);
  }

  return chunkRows.length;
}
