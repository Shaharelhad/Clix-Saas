/**
 * MOR AI Agent — lead-storage helpers.
 *
 * This file owns ALL logic for the `mor_ai_agent` flow node:
 *   1. Pure DB helpers (saveLead, updateLeadStatus, markLeadPaid)
 *   2. Tool schemas (what the LLM sees)
 *   3. System prompt composition (incl. time-of-day context)
 *   4. buildMorAiAgent() — single entrypoint for flow-webhook to call
 *
 * To add a tool, change a status, edit the prompt framework, or swap
 * the DB target: edit ONLY this file. flow-webhook never needs to change.
 */
import type { AgentToolDefinition } from "./llm-engine.ts";
import { nowIsraelISO } from "./israel-time.ts";
import { sendImageMessage } from "./wa-messaging.ts";

// Loose type alias to avoid importing the full Supabase generic chain.
// The real client is created in flow-webhook with Database types; we
// don't need them here since we only call generic `.rpc()` and `.from()`.
// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

// ── Public types ────────────────────────────────────────────────

export type LeadStatus =
  | "new"
  | "engaging"
  | "scheduled"
  | "paid"
  | "active"
  | "inactive"
  | "closed";

const LEAD_STATUS_VALUES: readonly LeadStatus[] = [
  "new", "engaging", "scheduled", "paid", "active", "inactive", "closed",
] as const;

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ── Layer 1: pure DB helpers ────────────────────────────────────

/** Upsert a lead row by phone. Calls mor_upsert_lead RPC. */
export async function saveLead(
  supabase: SupabaseLike,
  { phone, name }: { phone: string; name?: string },
): Promise<Result<{ leadId: string; isNew: boolean }>> {
  if (!phone || phone.trim().length === 0) {
    return { ok: false, error: "phone is required" };
  }
  try {
    const { data, error } = await supabase.rpc("mor_upsert_lead", {
      p_phone: phone,
      p_name: name ?? null,
    });
    if (error) return { ok: false, error: error.message ?? String(error) };
    if (!data) return { ok: false, error: "mor_upsert_lead returned no row" };
    const row = Array.isArray(data) ? data[0] : data;
    const leadId = (row?.id as string) ?? "";
    const createdAt = row?.created_at;
    const updatedAt = row?.updated_at;
    const isNew = createdAt && updatedAt
      ? new Date(createdAt).getTime() === new Date(updatedAt).getTime()
      : true;
    return { ok: true, data: { leadId, isNew } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Transition a lead's lifecycle status. Calls mor_set_status RPC. */
export async function updateLeadStatus(
  supabase: SupabaseLike,
  { phone, status }: { phone: string; status: LeadStatus },
): Promise<Result<void>> {
  if (!phone || phone.trim().length === 0) {
    return { ok: false, error: "phone is required" };
  }
  if (!LEAD_STATUS_VALUES.includes(status)) {
    return { ok: false, error: `invalid status: ${status}` };
  }
  try {
    const { error } = await supabase.rpc("mor_set_status", {
      p_phone: phone,
      p_status: status,
    });
    if (error) return { ok: false, error: error.message ?? String(error) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Mark lead as paid: status='paid' + last_payment_at=now().
 * No meeting_id required — meeting tracking is out of scope for v1.
 */
export async function markLeadPaid(
  supabase: SupabaseLike,
  { phone }: { phone: string },
): Promise<Result<void>> {
  if (!phone || phone.trim().length === 0) {
    return { ok: false, error: "phone is required" };
  }
  try {
    const { error: statusErr } = await supabase.rpc("mor_set_status", {
      p_phone: phone,
      p_status: "paid",
    });
    if (statusErr) return { ok: false, error: statusErr.message ?? String(statusErr) };
    const { error: stampErr } = await supabase
      .from("mor_leads")
      .update({ last_payment_at: new Date().toISOString() })
      .eq("phone", phone);
    if (stampErr) return { ok: false, error: stampErr.message ?? String(stampErr) };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Best-effort stamp of last_inbound_at. No-op if row doesn't exist. Swallows errors. */
export async function stampInbound(supabase: SupabaseLike, phone: string): Promise<void> {
  if (!phone || phone.trim().length === 0) return;
  try {
    await supabase
      .from("mor_leads")
      .update({ last_inbound_at: new Date().toISOString() })
      .eq("phone", phone);
  } catch (e) {
    console.warn("[mor_ai_agent] stampInbound failed:", e instanceof Error ? e.message : String(e));
  }
}

/** Best-effort stamp of last_mor_reply_at. No-op if row doesn't exist. Swallows errors. */
export async function stampReply(supabase: SupabaseLike, phone: string): Promise<void> {
  if (!phone || phone.trim().length === 0) return;
  try {
    await supabase
      .from("mor_leads")
      .update({ last_mor_reply_at: new Date().toISOString() })
      .eq("phone", phone);
  } catch (e) {
    console.warn("[mor_ai_agent] stampReply failed:", e instanceof Error ? e.message : String(e));
  }
}

/** Cert filename keyword mapping. Filenames must contain these substrings (case-insensitive). */
const CERT_FILENAME_KEYWORDS: Record<string, string> = {
  se: "se",
  transpersonal: "transpersonal",
  subconscious: "subconscious",
  meditation: "meditation",
};

type CertFilter = keyof typeof CERT_FILENAME_KEYWORDS | "all";

/**
 * Send Mor's certification images from bot-media/mor-certs/ to the customer.
 * If `which` is "all" (default), sends every file in the folder.
 * Otherwise filters files whose name contains the matching keyword.
 */
async function sendCertifications(
  supabase: SupabaseLike,
  { customerId, phone, which = "all" }: { customerId: string; phone: string; which?: CertFilter },
): Promise<Result<{ sent: number; which: CertFilter }>> {
  if (!phone || !customerId) {
    return { ok: false, error: "phone and customerId required" };
  }
  try {
    const { data: files, error } = await supabase.storage
      .from("bot-media")
      .list("mor-certs", { sortBy: { column: "name", order: "asc" } });
    if (error) return { ok: false, error: error.message ?? String(error) };
    if (!files || files.length === 0) {
      return { ok: false, error: "No certifications uploaded yet" };
    }

    const keyword = which !== "all" ? CERT_FILENAME_KEYWORDS[which] : null;
    const targetFiles = keyword
      ? files.filter((f) => f?.name && f.name.toLowerCase().includes(keyword))
      : files;

    if (keyword && targetFiles.length === 0) {
      return { ok: false, error: `No cert file matching '${which}' found in mor-certs/` };
    }

    let sent = 0;
    for (const file of targetFiles) {
      if (!file?.name || file.name.startsWith(".")) continue;
      const { data: pub } = supabase.storage
        .from("bot-media")
        .getPublicUrl(`mor-certs/${file.name}`);
      if (!pub?.publicUrl) continue;
      try {
        await sendImageMessage(customerId, phone, pub.publicUrl, "");
        sent++;
      } catch (e) {
        console.warn("[mor_ai_agent] cert send failed:", file.name, e instanceof Error ? e.message : String(e));
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return { ok: true, data: { sent, which } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Layer 2: tool schemas (LLM-facing) ──────────────────────────

const LEAD_TOOL_SCHEMAS: AgentToolDefinition[] = [
  {
    name: "save_lead",
    description:
      "Create or refresh a lead row when the user introduces themselves or you learn their name. " +
      "Phone is auto-injected from the inbound message — never pass phone yourself.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The user's name as stated in the conversation (Hebrew or transliterated).",
        },
      },
      required: [],
    },
  },
  {
    name: "update_lead_status",
    description:
      "Transition the lead's lifecycle status when conversation context implies a change " +
      "(e.g., 'engaging' when they show interest, 'scheduled' when they book a meeting). " +
      "Phone is auto-injected.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: [...LEAD_STATUS_VALUES],
          description: "The new status. One of: " + LEAD_STATUS_VALUES.join(", "),
        },
      },
      required: ["status"],
    },
  },
  {
    name: "mark_paid",
    description:
      "Call this when the user confirms payment in text " +
      "(e.g., 'שילמתי', 'העברתי', 'בוצע', 'הועבר'). " +
      "Sets status to paid and stamps last_payment_at. Phone is auto-injected.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "send_certifications",
    description:
      "Send Mor's certification images to the customer as WhatsApp media. " +
      "Call this when the customer asks about תעודות / הסמכות / 'איפה למדת' / 'מי את כמטפלת' / 'יש לה תעודות'. " +
      "Before calling this tool, produce a short warm text reply (1 sentence) introducing Mor's background. " +
      "Pass `which` to send a SPECIFIC cert only — pick the one matching the customer's question: " +
      "'se' (Gina Ross SE 2020), 'transpersonal' (Reidman 2018 incl. psychophysical healing), " +
      "'subconscious' (Arian Lev 2014), 'meditation' (Reidman 2013). " +
      "Omit `which` (or pass 'all') only when the question is generic ('do you have certifications?'). " +
      "Do NOT send a Drive link or any URL in the text — this tool sends the actual cert image(s).",
    parameters: {
      type: "object",
      properties: {
        which: {
          type: "string",
          enum: ["se", "transpersonal", "subconscious", "meditation", "all"],
          description:
            "Specific cert to send. 'se' = Somatic Experiencing / Gina Ross. " +
            "'transpersonal' = Transpersonal Psychotherapy + Psychophysical Healing (Reidman 2018). " +
            "'subconscious' = Subconscious work (Arian Lev 2014). " +
            "'meditation' = Meditation + guided imagery (Reidman 2013). " +
            "'all' = send all 4 (use only for generic certification questions).",
        },
      },
      required: [],
    },
  },
];

// ── Layer 3: system prompt composition (private to this file) ───

// Mirrors callLLMEngine's reply-style block so the MOR AI Agent's voice
// matches the regular CLIX bot for the same business. Copied (not imported)
// from _shared/llm-engine.ts:256–268 — keeping that file untouched per
// CLAUDE.md sensitive-file rule. If the CLIX bot's wording changes there,
// update this string by hand.
const REPLY_STYLE_GUIDELINES = `הנחיות קריטיות לסגנון התשובה:
- אתה בעל העסק, לא בוט. דבר בגוף ראשון: "אצלי", "אני", "שלי"
- כתוב בצורה טבעית, קצרה וחמה
- תשובות קצרות וממוקדות! מקסימום 3-4 שורות לכל הודעה
- אל תכתוב פסקאות ארוכות, אל תעשה רשימות מפורטות
- אל תשתמש במילים: "בוט", "מערכת", "שירות לקוחות", "אוטומטי"
- תגיב כמו בשיחת וואטסאפ אמיתית בין שני אנשים
- אל תשתמש באימוג'ים בשום מקרה, אלא אם הפרומפט למעלה מציין במפורש להשתמש באימוג'ים. ברירת המחדל היא ללא אימוג'ים

הנחיות קריטיות למידע:
- השתמש אך ורק במידע שסופק לך למעלה (פרומפט)
- אל תמציא מוצרים, מחירים, שירותים, או פרטים שלא מופיעים בהקשר
- אם אין לך מידע על משהו שהלקוח שואל, אמור בצורה טבעית שתבדוק ותחזור אליו`;

/** Fetch the user's saved bot persona from form_responses (same source the CLIX bot reads). */
async function fetchBusinessBotPrompt(
  supabase: SupabaseLike,
  userId: string,
): Promise<string> {
  if (!userId) return "";
  try {
    const { data } = await supabase
      .from("form_responses")
      .select("bot_prompt, business_name")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (data?.bot_prompt && (data.bot_prompt as string).trim().length > 0) {
      return data.bot_prompt as string;
    }
    const business = (data?.business_name as string) ?? "העסק";
    return `אתה בעל עסק בשם ${business}. דבר בגוף ראשון, בצורה טבעית ואנושית כמו בוואטסאפ.`;
  } catch {
    return "";
  }
}

function timeOfDayContext(israelISO: string): string {
  const hour = parseInt(israelISO.slice(11, 13), 10);
  let mode: "normal" | "unavailable" | "night";
  if (hour >= 22 || hour < 7) mode = "night";
  else if (hour >= 16) mode = "unavailable";
  else mode = "normal";
  const hhmm = israelISO.slice(11, 16);
  return `<context>Current Israel time: ${hhmm}. Mode: ${mode}.</context>`;
}

function composeSystemPrompt(basePrompt: string, extraInstructions: string): string {
  const parts: string[] = [];
  if (basePrompt.trim()) parts.push(basePrompt.trim());
  if (extraInstructions.trim()) parts.push("", extraInstructions.trim());
  parts.push(
    "",
    REPLY_STYLE_GUIDELINES,
    "",
    timeOfDayContext(nowIsraelISO()),
    "",
    "<tool_guidance>",
    "You have 4 tools available:",
    "  - save_lead: when the user introduces themselves or shares their name.",
    "  - update_lead_status: when conversation context implies a lifecycle change.",
    "      Valid statuses: " + LEAD_STATUS_VALUES.join(", "),
    "  - mark_paid: when the user confirms payment ('שילמתי', 'העברתי', etc.).",
    "  - send_certifications({which?}): when the user asks about Mor's תעודות / הסמכות / 'איפה למדת'.",
    "      Produce a short warm 1-sentence text reply first, then call this tool.",
    "      Pass `which` to send ONE specific cert (matches the question):",
    "        'se' = Gina Ross SE | 'transpersonal' = Reidman 2018 | 'subconscious' = Arian Lev 2014 | 'meditation' = Reidman 2013",
    "      Omit `which` (or pass 'all') only for generic 'do you have certifications?' questions.",
    "      Do NOT send a Drive link in the reply — the tool delivers the cert image(s).",
    "Phone numbers are auto-injected — never pass phone yourself.",
    "Call tools silently — never narrate the call to the user. After a tool returns,",
    "continue the conversation naturally without mentioning the database.",
    "</tool_guidance>",
  );
  return parts.join("\n");
}

// ── Layer 4: single entrypoint for flow-webhook ─────────────────

/**
 * One call from flow-webhook returns everything needed for callAgentLLM:
 *   - systemPrompt (form_responses.bot_prompt + node textarea + reply-style + time + tools)
 *   - tools (the 3 lead-CRM tool schemas)
 *   - executeTool (router that dispatches by tool name to the right helper)
 *
 * Async because we fetch the saved business bot_prompt from the DB (same source
 * the regular CLIX bot reads) so the MOR AI Agent's voice matches.
 *
 * Adding/editing a tool, status, prompt structure, or DB target = ONLY edit this file.
 */
export async function buildMorAiAgent(params: {
  supabase: SupabaseLike;
  phone: string;
  userId: string;
  /** Optional Mor-specific instructions from the node's textarea — appended to bot_prompt. */
  extraInstructions?: string;
}): Promise<{
  systemPrompt: string;
  tools: AgentToolDefinition[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}> {
  const { supabase, phone, userId, extraInstructions = "" } = params;
  const basePrompt = await fetchBusinessBotPrompt(supabase, userId);

  return {
    systemPrompt: composeSystemPrompt(basePrompt, extraInstructions),
    tools: LEAD_TOOL_SCHEMAS,
    executeTool: async (name, args) => {
      switch (name) {
        case "save_lead":
          return await saveLead(supabase, {
            phone,
            name: typeof args.name === "string" ? args.name : undefined,
          });
        case "update_lead_status":
          return await updateLeadStatus(supabase, {
            phone,
            status: args.status as LeadStatus,
          });
        case "mark_paid":
          return await markLeadPaid(supabase, { phone });
        case "send_certifications": {
          const w = typeof args.which === "string" ? args.which : "all";
          const which = (Object.keys(CERT_FILENAME_KEYWORDS).includes(w) || w === "all" ? w : "all") as CertFilter;
          return await sendCertifications(supabase, { customerId: userId, phone, which });
        }
        default:
          return { ok: false, error: `unknown tool: ${name}` };
      }
    },
  };
}
