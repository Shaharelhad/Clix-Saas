// deno-lint-ignore-file no-explicit-any
/**
 * sheets-relay — write lead data from flow-webhook's api_call node into a
 * Google Sheet ("Leads" tab) using a service-account JSON stored in the
 * GOOGLE_SHEETS_SA_JSON edge secret. Upsert by U_TXR_Lcell (phone).
 *
 * Returns 200 with { ok:true } on success, 200 with { ok:false, error:... }
 * on failure — never throws and never returns non-2xx, so flow-webhook's
 * api_call error path stays cold for normal traffic and customer threads
 * are never interrupted by sheet-write failures.
 */
import { corsHeaders } from "../_shared/cors.ts";

const SHEET_ID = "1V66aD_JBhp0kkWdEv5sqb00AJt0Iy9f9Vw2hhRoY8Gs";
const TAB_NAME = "Leads";
// COLUMNS are the JSON-key contract with workflow api_call bodyTemplates —
// renaming any of them breaks the sheet_push nodes in flow_json. Order is
// not part of the contract (the function reads `data[col]` by key), but
// changing the order means existing sheet rows must be migrated to match.
// HEADERS is the parallel display row written to row 1.
const COLUMNS = [
  "U_TXR_LName", "U_TXR_Lcell", "U_TXR_Lmail", "U_TXR_Laddress", "U_TXR_Id", "U_TXR_Lage",
  "U_TXR_LCBNT", "U_TXR_LCRC", "U_TXR_LERT",
  "U_TXR_LRBBI", "U_TXR_LRMBAS", "U_TXR_LRD",
  "U_TXR_LRBLC",
  "U_TXR_LRMB", "U_TXR_LRBLT",
  "U_TXR_LRehab", "U_TXR_LNBranch",
  "updated_at",
];
// Exact question text from each source node's data.message in flow_json.
// Branch-specific recognition questions get a (category) suffix because three
// of them reuse the same NII question text across brain/cancer/trauma branches
// and two reuse the same MoD question — without the suffix the column-by-column
// view is ambiguous.
const HEADERS = [
  "מה שמך המלא?",
  "מספר טלפון",
  "מה כתובת המייל שלך ?",
  "מה כתובת המגורים שלך?",
  "אנא ציין מספר תעודת זהות , אם אינך מעוניין עבור לשאלה הבאה",
  "מה גילך?",
  "פגיעה מוחית",
  "השלכות מחלת הסרטן",
  "תגובה לטראומה",
  "האם הוכרת בתהליך הכרה על ידי המוסד לביטוח לאומי? (פגיעה מוחית)",
  "האם הוכרת בתהליך הכרה על ידי אגף השיקום במשרד הביטחון? (פגיעה מוחית)",
  "האם הוכרת על ידי מנהל מוגבלויות/מחלקת הרווחה? (פגיעה מוחית)",
  "האם הוכרת בתהליך הכרה על ידי המוסד לביטוח לאומי? (השלכות מחלת הסרטן)",
  "האם הוכרת בתהליך הכרה על ידי אגף השיקום במשרד הביטחון? (תגובה לטראומה)",
  "האם הוכרת בתהליך הכרה על ידי המוסד לביטוח לאומי? (תגובה לטראומה)",
  "האם את/ה זקוק/ה לסיוע בשיקום תעסוקתי?",
  "באיזה מהסניפים תהיה/יי מעוניין/ת לקבל שירות",
  "עודכן ב",
];

// 10 yes/no columns: 3 category flags + 6 branch-recognition sub-questions + rehab.
// After the row is built, any of these that are empty get defaulted to "לא" so
// the sheet has no empty cells in yes/no columns (per client request).
const YES_NO_COLS = [
  "U_TXR_LCBNT", "U_TXR_LCRC", "U_TXR_LERT",
  "U_TXR_LRBBI", "U_TXR_LRMBAS", "U_TXR_LRD",
  "U_TXR_LRBLC",
  "U_TXR_LRMB", "U_TXR_LRBLT",
  "U_TXR_LRehab",
];

let cachedToken: { token: string; expiresAt: number } | null = null;
let tabEnsured = false;

function colLetter(zeroBasedIndex: number): string {
  let n = zeroBasedIndex;
  let result = "";
  while (true) {
    result = String.fromCharCode("A".charCodeAt(0) + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return result;
}

function base64urlEncode(input: Uint8Array): string {
  let s = "";
  for (let i = 0; i < input.length; i++) s += String.fromCharCode(input[i]);
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const raw = Deno.env.get("GOOGLE_SHEETS_SA_JSON");
  if (!raw) throw new Error("GOOGLE_SHEETS_SA_JSON env var missing");
  const sa = JSON.parse(raw);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const claimB64 = base64urlEncode(enc.encode(JSON.stringify(claim)));
  const signingInput = `${headerB64}.${claimB64}`;

  // Import the PKCS8 RSA private key
  const pem = (sa.private_key as string)
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(signingInput));
  const jwt = `${signingInput}.${base64urlEncode(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  cachedToken = { token: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}

async function ensureTab(token: string): Promise<void> {
  if (tabEnsured) return;
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`get spreadsheet: ${r.status} ${await r.text()}`);
  const data = await r.json();
  const exists = (data.sheets || []).some((s: any) => s.properties?.title === TAB_NAME);
  if (exists) { tabEnsured = true; return; }

  const addRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          addSheet: { properties: { title: TAB_NAME, gridProperties: { frozenRowCount: 1 } } },
        }],
      }),
    },
  );
  if (!addRes.ok) throw new Error(`addSheet: ${addRes.status} ${await addRes.text()}`);

  const lastCol = colLetter(COLUMNS.length - 1);
  const headerRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${TAB_NAME}!A1:${lastCol}1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [HEADERS] }),
    },
  );
  if (!headerRes.ok) throw new Error(`write header: ${headerRes.status} ${await headerRes.text()}`);
  tabEnsured = true;
}

// Translate limorbot's root-menu choice (sent as `category` in the body when the
// root-menu api_call fires) into the LCBNT/LCRC/LERT yes/no columns. The PICKED
// category becomes "כן"; the other two become "לא". "אחר" (other) sets all three
// to "לא". When `category` is unset the lead hasn't categorized yet — leave empty.
// Mutates `row` in place.
function inferCategoryFlags(row: string[], category?: string): void {
  const get = (col: string) => row[COLUMNS.indexOf(col)] || "";
  const setVal = (col: string, v: string) => {
    const i = COLUMNS.indexOf(col);
    if (!row[i]) row[i] = v;
  };
  const cat = (category || "").trim();

  // Without `category` we still infer from sub-recognition vars (older sessions,
  // branches where the root-menu push didn't fire). One non-empty sub-recognition
  // implies the corresponding category flag.
  let inferred: "brain" | "cancer" | "trauma" | "" = "";
  if (get("U_TXR_LRBBI") || get("U_TXR_LRMBAS") || get("U_TXR_LRD")) inferred = "brain";
  else if (get("U_TXR_LRBLC")) inferred = "cancer";
  else if (get("U_TXR_LRMB") || get("U_TXR_LRBLT")) inferred = "trauma";

  const resolved = cat || (inferred === "brain" ? "פגיעה מוחית"
    : inferred === "cancer" ? "השלכות מחלת הסרטן"
    : inferred === "trauma" ? "תגובה לטראומה"
    : "");
  if (!resolved) return; // lead hasn't categorized — leave all three empty

  // Fan-out: picked one gets "כן", the other two get "לא". "אחר" → all "לא".
  setVal("U_TXR_LCBNT", resolved === "פגיעה מוחית" ? "כן" : "לא");
  setVal("U_TXR_LCRC", resolved === "השלכות מחלת הסרטן" ? "כן" : "לא");
  setVal("U_TXR_LERT", resolved === "תגובה לטראומה" ? "כן" : "לא");
}

// Default any empty yes/no column to "לא". Runs after inferCategoryFlags so the
// category flags are already filled (כן/לא) where applicable. Free-text columns
// (name, phone, email, home, ID, age, branch) and `updated_at` are untouched.
function defaultEmptyToNo(row: string[]): void {
  for (const col of YES_NO_COLS) {
    const i = COLUMNS.indexOf(col);
    if (!row[i]) row[i] = "לא";
  }
}

async function upsertRow(
  token: string,
  data: Record<string, unknown>,
): Promise<{ mode: "insert" | "update"; row: number }> {
  const phone = String(data.U_TXR_Lcell || "").trim();
  const lastCol = colLetter(COLUMNS.length - 1);
  const phoneCol = colLetter(COLUMNS.indexOf("U_TXR_Lcell"));

  // Read phone column to find existing row by U_TXR_Lcell
  const phonesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${TAB_NAME}!${phoneCol}2:${phoneCol}?majorDimension=COLUMNS`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!phonesRes.ok) throw new Error(`read phones: ${phonesRes.status} ${await phonesRes.text()}`);
  const phonesData = await phonesRes.json();
  const phones: string[] = (phonesData.values?.[0] || []).map((p: any) => String(p));
  const idx = phones.indexOf(phone);

  if (idx >= 0) {
    const targetRow = idx + 2;
    // Read existing full row for merge
    const rowRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${TAB_NAME}!A${targetRow}:${lastCol}${targetRow}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!rowRes.ok) throw new Error(`read row: ${rowRes.status} ${await rowRes.text()}`);
    const rowData = await rowRes.json();
    const existing: string[] = rowData.values?.[0] || [];
    while (existing.length < COLUMNS.length) existing.push("");

    const merged = COLUMNS.map((col, i) => {
      if (col === "updated_at") return new Date().toISOString();
      const incoming = data[col];
      if (incoming === undefined || incoming === null || String(incoming).trim() === "") {
        return existing[i] ?? "";
      }
      return String(incoming);
    });

    inferCategoryFlags(merged, data.category as string | undefined);
    defaultEmptyToNo(merged);

    const updRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${TAB_NAME}!A${targetRow}:${lastCol}${targetRow}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [merged] }),
      },
    );
    if (!updRes.ok) throw new Error(`update row: ${updRes.status} ${await updRes.text()}`);
    return { mode: "update", row: targetRow };
  }

  // INSERT
  const newRow = COLUMNS.map((col) => {
    if (col === "updated_at") return new Date().toISOString();
    const v = data[col];
    return v === undefined || v === null ? "" : String(v);
  });
  inferCategoryFlags(newRow, data.category as string | undefined);
  defaultEmptyToNo(newRow);
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${TAB_NAME}!A:${lastCol}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [newRow] }),
    },
  );
  if (!appendRes.ok) throw new Error(`append: ${appendRes.status} ${await appendRes.text()}`);
  const appendData = await appendRes.json();
  const m = (appendData.updates?.updatedRange || "").match(/!\w+(\d+):/);
  return { mode: "insert", row: m ? parseInt(m[1], 10) : -1 };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Support ?delete=<phone> for cleaning up test rows. Checked BEFORE the GET
  // health check so any method (GET/POST/DELETE) with the param triggers it.
  const url = new URL(req.url);
  const deletePhone = url.searchParams.get("delete");

  // Quick health check via GET — useful for smoke testing without payload.
  if (req.method === "GET" && !deletePhone) {
    return json({ ok: true, service: "sheets-relay", columns: COLUMNS });
  }
  if (deletePhone) {
    try {
      const token = await getAccessToken();
      await ensureTab(token);
      const phoneCol = colLetter(COLUMNS.indexOf("U_TXR_Lcell"));
      const phonesRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${TAB_NAME}!${phoneCol}2:${phoneCol}?majorDimension=COLUMNS`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!phonesRes.ok) throw new Error(`read phones: ${phonesRes.status}`);
      const phonesData = await phonesRes.json();
      const phones: string[] = (phonesData.values?.[0] || []).map((p: any) => String(p));
      const idx = phones.indexOf(String(deletePhone).trim());
      if (idx < 0) return json({ ok: true, deleted: false, reason: "not_found" });
      const targetRow = idx + 2;
      // Sheets API "deleteDimension" via batchUpdate — we need the sheet's numeric ID
      const metaRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const meta = await metaRes.json();
      const tab = (meta.sheets || []).find((s: any) => s.properties?.title === TAB_NAME);
      if (!tab) return json({ ok: false, error: "tab_not_found" });
      const delRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: tab.properties.sheetId,
                  dimension: "ROWS",
                  startIndex: targetRow - 1,
                  endIndex: targetRow,
                },
              },
            }],
          }),
        },
      );
      if (!delRes.ok) throw new Error(`delete: ${delRes.status} ${await delRes.text()}`);
      return json({ ok: true, deleted: true, row: targetRow });
    } catch (err) {
      console.error("[sheets-relay] delete error:", err);
      return json({ ok: false, error: String(err) });
    }
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const phone = String(body.U_TXR_Lcell || "").trim();
    if (!/^\d{8,15}$/.test(phone)) {
      return json({ ok: false, error: "invalid_phone", phone });
    }

    const token = await getAccessToken();
    await ensureTab(token);
    const result = await upsertRow(token, body);
    console.log(`[sheets-relay] ${result.mode} row=${result.row} phone=${phone}`);
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("[sheets-relay] error:", err);
    return json({ ok: false, error: String(err) });
  }
});
