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
];

// ── Layer 3: system prompt composition (private to this file) ───

function timeOfDayContext(israelISO: string): string {
  const hour = parseInt(israelISO.slice(11, 13), 10);
  let mode: "normal" | "unavailable" | "night";
  if (hour >= 22 || hour < 7) mode = "night";
  else if (hour >= 16) mode = "unavailable";
  else mode = "normal";
  const hhmm = israelISO.slice(11, 16);
  return `<context>Current Israel time: ${hhmm}. Mode: ${mode}.</context>`;
}

function composeSystemPrompt(userPrompt: string): string {
  return [
    userPrompt.trim(),
    "",
    timeOfDayContext(nowIsraelISO()),
    "",
    "<tool_guidance>",
    "You have 3 lead-CRM tools available:",
    "  - save_lead: when the user introduces themselves or shares their name.",
    "  - update_lead_status: when conversation context implies a lifecycle change.",
    "      Valid statuses: " + LEAD_STATUS_VALUES.join(", "),
    "  - mark_paid: when the user confirms payment ('שילמתי', 'העברתי', etc.).",
    "Phone numbers are auto-injected — never pass phone yourself.",
    "Call tools silently — never narrate the call to the user. After a tool returns,",
    "continue the conversation naturally without mentioning the database.",
    "</tool_guidance>",
  ].join("\n");
}

// ── Layer 4: single entrypoint for flow-webhook ─────────────────

/**
 * One call from flow-webhook returns everything needed for callAgentLLM:
 *   - systemPrompt (already composed with time-of-day context + tool guidance)
 *   - tools (the 3 lead-CRM tool schemas)
 *   - executeTool (router that dispatches by tool name to the right helper)
 *
 * Adding/editing a tool, status, prompt structure, or DB target = ONLY edit this file.
 */
export function buildMorAiAgent(params: {
  supabase: SupabaseLike;
  phone: string;
  userPrompt: string;
}): {
  systemPrompt: string;
  tools: AgentToolDefinition[];
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
} {
  const { supabase, phone, userPrompt } = params;

  return {
    systemPrompt: composeSystemPrompt(userPrompt ?? ""),
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
        default:
          return { ok: false, error: `unknown tool: ${name}` };
      }
    },
  };
}
