import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLMEngine, classifyTrigger, validateCollectInput, detectRefusal, translateMessage, translateButtonLabels, type TriggerInfo, type LLMResult } from "../_shared/llm-engine.ts";
import { resolveOperation } from "../_shared/integration-catalog.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);
const USE_INNGEST = Deno.env.get("USE_INNGEST") === "true";

// Reliable session update using direct REST API (bypasses supabase-js client issues)
async function updateSessionDirect(
  sessionId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const url = `${supabaseUrl}/rest/v1/subscriber_sessions?id=eq.${sessionId}`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "apikey": supabaseKey,
        "Authorization": `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      console.error("[flow] Direct session update failed:", res.status, await res.text());
    } else {
      console.log("[flow] Direct session update OK:", updates.current_node_id, updates.status);
    }
  } catch (err) {
    console.error("[flow] Direct session update error:", err);
  }
}

// ── Types ───────────────────────────────────────────────────
interface ButtonItem {
  id: string;
  label: string;
}

interface FlowNode {
  id: string;
  type: string;
  data: {
    type: string;
    message?: string;
    imageUrl?: string;
    buttons?: ButtonItem[];
    variableName?: string;
    expectedAnswer?: string;
    delayMinutes?: number;
    triggerText?: string;
    expectedReply?: string;
    continueAuto?: boolean;
    followUpMessage?: string;
    yesNoMode?: boolean;
    allowSkip?: boolean;
    // api_call
    integrationId?: string;
    endpoint?: string;
    method?: string;
    bodyTemplate?: string;
    responseMapping?: Array<{ jsonPath: string; variableName: string }>;
    errorMessage?: string;
  };
}

interface FlowEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

interface FlowSettings {
  ignoreGroupChats?: boolean;
  cooldownEnabled?: boolean;
  cooldownMinutes?: number;
  deduplicateMessages?: boolean;
  autoFollowUpEnabled?: boolean;
  autoFollowUpDelayMinutes?: number;
  autoFollowUpMaxCount?: number;
  sessionResetEnabled?: boolean;
  sessionResetMinutes?: number;
  strictMode?: boolean;
}

interface FlowJSON {
  nodes: FlowNode[];
  edges: FlowEdge[];
  settings?: FlowSettings;
}

function getFlowSettings(flow: FlowJSON) {
  return {
    ignoreGroupChats: flow.settings?.ignoreGroupChats ?? true,
    cooldownEnabled: flow.settings?.cooldownEnabled ?? true,
    cooldownMinutes: flow.settings?.cooldownMinutes ?? 60,
    deduplicateMessages: flow.settings?.deduplicateMessages ?? true,
    autoFollowUpEnabled: flow.settings?.autoFollowUpEnabled ?? false,
    autoFollowUpDelayMinutes: flow.settings?.autoFollowUpDelayMinutes ?? 120,
    autoFollowUpMaxCount: flow.settings?.autoFollowUpMaxCount ?? 1,
    sessionResetEnabled: flow.settings?.sessionResetEnabled ?? false,
    sessionResetMinutes: flow.settings?.sessionResetMinutes ?? 1440,
    strictMode: flow.settings?.strictMode ?? false,
    flowLanguage: flow.settings?.flowLanguage ?? "he",
    autoTranslate: flow.settings?.autoTranslate ?? false,
  };
}

// ── Flow Navigation Engine ──────────────────────────────────

// ── Extract triggers from flow for LLM classification ──────
function extractTriggers(flow: FlowJSON): TriggerInfo[] {
  const triggers: TriggerInfo[] = [];
  for (const n of flow.nodes) {
    if (n.type !== "start" || n.data.disabled) continue;
    const keywords: string[] = Array.isArray(n.data.triggerKeywords) && n.data.triggerKeywords.length > 0
      ? n.data.triggerKeywords.filter((k: string) => k?.trim())
      : n.data.triggerText?.trim() ? [n.data.triggerText.trim()] : [];
    for (const kw of keywords) {
      triggers.push({ id: n.id, trigger: kw.trim() });
    }
  }
  return triggers;
}

// ── Find start node by ID ──────────────────────────────────
function findStartNodeById(flow: FlowJSON, nodeId: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === nodeId && n.type === "start");
}

function findCatchAllStart(flow: FlowJSON): FlowNode | undefined {
  return flow.nodes.find((n) => n.type === "start" && !n.data.disabled && !n.data.triggerText?.trim());
}

function findNodeById(flow: FlowJSON, id: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === id);
}

function findNextNode(
  flow: FlowJSON,
  fromNodeId: string,
  sourceHandle?: string
): FlowNode | undefined {
  const edge = flow.edges.find(
    (e) =>
      e.source === fromNodeId &&
      (!sourceHandle || e.sourceHandle === sourceHandle)
  );
  if (!edge) return undefined;
  return findNodeById(flow, edge.target);
}

function matchButton(
  buttons: ButtonItem[],
  userMessage: string,
  buttonClickId?: string
): ButtonItem | undefined {
  // Match by button ID first (interactive button clicks)
  if (buttonClickId) {
    const byId = buttons.find((b) => b.id === buttonClickId);
    if (byId) return byId;
  }
  const normalized = userMessage.trim().toLowerCase();
  // Exact label match
  const exact = buttons.find((b) => b.label.trim().toLowerCase() === normalized);
  if (exact) return exact;
  // Numeric match (user sends "1", "2", etc.)
  const num = parseInt(normalized);
  if (!isNaN(num) && num >= 1 && num <= buttons.length) {
    return buttons[num - 1];
  }
  return undefined;
}

function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (!["https:", "http:"].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") return false;
    if (hostname.startsWith("10.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname.startsWith("192.168.")) return false;
    if (hostname.startsWith("169.254.")) return false;
    if (hostname.endsWith(".internal") || hostname.endsWith(".local")) return false;
    return true;
  } catch { return false; }
}

function resolveVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}

function extractJsonPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// Send event to Inngest for durable processing
async function sendInngestEvent(data: Record<string, unknown>): Promise<void> {
  const eventKey = Deno.env.get("INNGEST_EVENT_KEY");
  if (!eventKey) throw new Error("INNGEST_EVENT_KEY not set");
  const res = await fetch(`https://inn.gs/e/${eventKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "whatsapp/message.received", data }),
  });
  if (!res.ok) {
    console.error("[flow] Inngest event send failed:", res.status, await res.text());
  }
}

// ── Open LLM Chat (used when no trigger matches) ────────────
async function callOpenLLM(
  userId: string,
  userMessage: string,
  sessionId: string,
  workflowId: string,
  customerId: string,
  phone: string,
  workflowRecord?: string,
  languagePreference?: string
): Promise<void> {
  // When Inngest is enabled, dispatch to Inngest instead of processing inline
  if (USE_INNGEST) {
    await sendInngestEvent({
      userId,
      phone,
      message: userMessage,
      customerId,
      workflowId,
      sessionId,
    });
    return;
  }

  // Fetch conversation history
  const { data: history } = await supabase
    .from("flow_message_log")
    .select("direction, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  const conversationHistory: { role: string; content: string }[] = [];
  if (history) {
    for (const row of history) {
      conversationHistory.push({
        role: row.direction === "inbound" ? "user" : "assistant",
        content: row.content,
      });
    }
  }

  const langContext = languagePreference
    ? `\nIMPORTANT: The customer prefers to communicate in ${languagePreference}. Respond in ${languagePreference}.\n`
    : "";
  const fullWorkflowRecord = langContext + (workflowRecord || "");

  const result = await callLLMEngine(
    supabase,
    userId,
    userMessage,
    conversationHistory,
    undefined, // no config overrides
    undefined, // no legacy triggerContext
    false,     // production = not draft
    fullWorkflowRecord || undefined,
    true,      // classifyStage — detect engaging vs closed
  );

  // Send response via WClixAPI
  await sendTextMessage(customerId, phone, result.response);

  // Log outbound message
  await supabase.from("flow_message_log").insert({
    workflow_id: workflowId,
    session_id: sessionId,
    node_id: null,
    direction: "outbound",
    message_type: "llm_response",
    content: result.response,
  });

  // Update conversation stage if classified
  if (result.conversationStage) {
    await supabase
      .from("subscriber_sessions")
      .update({ conversation_stage: result.conversationStage })
      .eq("id", sessionId);
  }

  // Schedule or cancel auto-follow-up
  await handleAutoFollowUp(sessionId, workflowId, result.conversationStage);
}

// ── Auto-Follow-Up Scheduling ────────────────────────────────

/**
 * Cancel pending auto-follow-up jobs and optionally schedule a new one.
 * Called after each bot response (LLM or flow node).
 */
async function handleAutoFollowUp(
  sessionId: string,
  workflowId: string,
  conversationStage?: "engaging" | "closed",
): Promise<void> {
  try {
    // Always cancel existing pending auto-follow-up jobs (timer resets)
    await supabase
      .from("flow_delayed_jobs")
      .update({ status: "cancelled" })
      .eq("session_id", sessionId)
      .eq("job_type", "auto_follow_up")
      .eq("status", "pending");

    // Don't schedule if stage is closed
    if (conversationStage === "closed") return;

    // Fetch workflow to check settings
    const { data: workflow } = await supabase
      .from("workflows")
      .select("flow_json")
      .eq("id", workflowId)
      .single();

    if (!workflow?.flow_json) return;

    const flowSettings = getFlowSettings(workflow.flow_json as FlowJSON);
    if (!flowSettings.autoFollowUpEnabled) return;

    // Fetch session to check follow_up_count
    const { data: session } = await supabase
      .from("subscriber_sessions")
      .select("follow_up_count, status")
      .eq("id", sessionId)
      .single();

    if (!session || session.status !== "active") return;
    if (session.follow_up_count >= flowSettings.autoFollowUpMaxCount) return;

    // Schedule new auto-follow-up job
    const executeAt = new Date(
      Date.now() + flowSettings.autoFollowUpDelayMinutes * 60 * 1000,
    ).toISOString();

    await supabase.from("flow_delayed_jobs").insert({
      session_id: sessionId,
      node_id: "auto_follow_up",
      execute_at: executeAt,
      status: "pending",
      job_type: "auto_follow_up",
    });
  } catch (err) {
    console.error("[flow] Auto-follow-up scheduling error:", err);
  }
}

// ── WClixAPI Gateway Base URL & Auth ────────────────────────
const WA_GATEWAY_BASE = "https://wa.clixwapp.online";
const WA_GATEWAY_API_KEY = Deno.env.get("WA_GATEWAY_API_KEY")!;

// ── WClixAPI Message Sending ────────────────────────────────
async function sendTextMessage(
  customerId: string,
  to: string,
  text: string
) {
  const url = `${WA_GATEWAY_BASE}/api/session/send/${customerId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": WA_GATEWAY_API_KEY,
    },
    body: JSON.stringify({ to, message: text }),
  });
  return res.json();
}

async function sendButtonsMessage(
  customerId: string,
  to: string,
  message: string,
  buttons: ButtonItem[]
) {
  const url = `${WA_GATEWAY_BASE}/api/session/send-buttons/${customerId}`;
  const wclixButtons = buttons.slice(0, 10).map((b) => ({
    buttonId: b.id,
    buttonText: b.label.substring(0, 25),
  }));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": WA_GATEWAY_API_KEY,
      },
      body: JSON.stringify({
        to,
        body: message,
        buttons: wclixButtons,
      }),
    });
    if (res.ok) return res.json();
  } catch { /* interactive buttons failed, fall through to text fallback */ }

  // Fallback: send as numbered text list if interactive buttons are not available
  const buttonText = buttons
    .map((b, i) => `${i + 1}. ${b.label}`)
    .join("\n");
  const fullMessage = `${message}\n\n${buttonText}`;
  return sendTextMessage(customerId, to, fullMessage);
}

async function sendImageMessage(
  customerId: string,
  to: string,
  imageUrl: string,
  caption: string
) {
  // WClixAPI expects file upload via multipart/form-data
  // Fetch the image first, then upload
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
    const imgBlob = await imgRes.blob();

    const formData = new FormData();
    formData.append("chatId", to);
    formData.append("file", imgBlob, "image.jpg");
    if (caption) formData.append("caption", caption);

    const url = `${WA_GATEWAY_BASE}/api/session/send-file/${customerId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": WA_GATEWAY_API_KEY },
      body: formData,
    });
    return res.json();
  } catch (err) {
    console.error("[flow] Image send failed, falling back to text:", err);
    // Fallback: send caption as text with image URL
    const fallbackMsg = caption ? `${caption}\n${imageUrl}` : imageUrl;
    return sendTextMessage(customerId, to, fallbackMsg);
  }
}

// ── Execute a single node ───────────────────────────────────
async function executeNode(
  node: FlowNode,
  customerId: string,
  phone: string,
  variables: Record<string, string>,
  flow: FlowJSON,
  sessionId: string,
  workflowId: string
): Promise<{ nextNodeId: string | null; waitForInput: boolean }> {
  // Log outbound message
  const logMessage = async (content: string, messageType: string) => {
    await supabase.from("flow_message_log").insert({
      workflow_id: workflowId,
      session_id: sessionId,
      node_id: node.id,
      direction: "outbound",
      message_type: messageType,
      content,
    });
    // Update analytics (fire-and-forget, don't block the flow)
    supabase.rpc("increment_node_sent" as never, {
      p_workflow_id: workflowId,
      p_node_id: node.id,
    }).then(() => {}).catch(() => {});
  };

  if (node.type === "start") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  // Open Bot — terminate flow, enter free AI conversation
  if (node.type === "open_bot") {
    return { nextNodeId: null, waitForInput: false };
  }

  // Language — send language selection buttons
  if (node.type === "language") {
    const msg = resolveVariables(node.data.message || "Choose your language:", variables);
    const langButtons = [
      { id: "lang-en", label: "English" },
      { id: "lang-he", label: "עברית" },
    ];
    await sendButtonsMessage(customerId, phone, msg, langButtons);
    await logMessage(`${msg}\n[English, עברית]`, "language");
    return { nextNodeId: node.id, waitForInput: true };
  }

  // Auto-translation check
  const flowSettings = getFlowSettings(flow);
  const shouldTranslate = variables.language
    && variables.language.toLowerCase() !== (flowSettings.flowLanguage || "he").toLowerCase();
  const fromLang = flowSettings.flowLanguage || "he";
  const targetLang = variables.language || fromLang;

  if (node.type === "text") {
    let msg = resolveVariables(node.data.message || "", variables);
    if (shouldTranslate) msg = await translateMessage(msg, fromLang, targetLang);
    await sendTextMessage(customerId, phone, msg);
    await logMessage(msg, "text");
    if (node.data.yesNoMode || node.data.continueAuto || node.data.expectedReply) {
      return { nextNodeId: node.id, waitForInput: true };
    }
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "image") {
    let msg = resolveVariables(node.data.message || "", variables);
    if (shouldTranslate) msg = await translateMessage(msg, fromLang, targetLang);
    const imageUrl = node.data.imageUrl || "";
    if (imageUrl) {
      await sendImageMessage(customerId, phone, imageUrl, msg);
    } else {
      await sendTextMessage(customerId, phone, msg);
    }
    await logMessage(msg, "image");
    if (node.data.continueAuto || node.data.expectedReply) {
      return { nextNodeId: node.id, waitForInput: true };
    }
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "buttons") {
    let msg = resolveVariables(node.data.message || "", variables);
    const buttons = node.data.buttons || [];
    let displayButtons = buttons;
    if (shouldTranslate) {
      msg = await translateMessage(msg, fromLang, targetLang);
      const translatedLabels = await translateButtonLabels(
        buttons.map((b) => b.label),
        fromLang,
        targetLang,
      );
      displayButtons = buttons.map((b, i) => ({ ...b, label: translatedLabels[i] || b.label }));
      // Store translated→original mapping for button matching
      for (let i = 0; i < buttons.length; i++) {
        variables[`__btn_translated_${translatedLabels[i]?.trim().toLowerCase()}`] = buttons[i].label;
      }
    }
    await sendButtonsMessage(customerId, phone, msg, displayButtons);
    const buttonLabels = displayButtons.map((b) => b.label).join(", ");
    await logMessage(`${msg}\n[${buttonLabels}]`, "buttons");
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "collect_input") {
    let msg = resolveVariables(node.data.message || "", variables);
    if (shouldTranslate) msg = await translateMessage(msg, fromLang, targetLang);
    await sendTextMessage(customerId, phone, msg);
    await logMessage(msg, "collect_input");
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "api_call") {
    const integrationId = node.data.integrationId;
    if (!integrationId) {
      const errMsg = resolveVariables(node.data.errorMessage || "API call not configured", variables);
      await sendTextMessage(customerId, phone, errMsg);
      await logMessage(errMsg, "api_call_error");
      return { nextNodeId: null, waitForInput: false };
    }

    // Fetch integration credentials from DB
    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (intError || !integration || integration.status !== "active") {
      const errMsg = resolveVariables(node.data.errorMessage || "Service unavailable", variables);
      await sendTextMessage(customerId, phone, errMsg);
      await logMessage(errMsg, "api_call_error");
      return { nextNodeId: null, waitForInput: false };
    }

    // Build URL and headers based on integration type
    const config = integration.config as Record<string, string>;
    let baseUrl = "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (integration.integration_type === "cloudbeds") {
      baseUrl = "https://api.cloudbeds.com";
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    } else {
      // custom_api
      baseUrl = config.baseUrl || "";
      if (config.authType === "bearer") {
        headers["Authorization"] = `Bearer ${config.authValue}`;
      } else if (config.authType === "api_key") {
        headers["x-api-key"] = config.authValue;
      }
    }

    // Resolve operation from catalog if in operation mode
    let endpoint: string;
    let method: string;
    let bodyTemplate: string | undefined;
    let responseMapping: Array<{ jsonPath: string; variableName: string }>;
    let errorMsg: string;

    if (node.data.operationId && node.data.serviceType) {
      // Merge integration config values (e.g., propertyId) into input values
      const mergedInputs: Record<string, string> = { ...(node.data.inputValues || {}) };
      if (integration.integration_type === "cloudbeds" && config.propertyId) {
        mergedInputs.propertyId = config.propertyId;
      }
      const resolved = resolveOperation(
        node.data.serviceType,
        node.data.operationId,
        mergedInputs,
      );
      if (!resolved) {
        const msg = "Operation not found";
        await sendTextMessage(customerId, phone, msg);
        await logMessage(msg, "api_call_error");
        return { nextNodeId: null, waitForInput: false };
      }
      endpoint = resolveVariables(resolved.endpoint, variables);
      method = resolved.method;
      bodyTemplate = resolved.bodyTemplate;
      responseMapping = resolved.responseMapping;
      errorMsg = node.data.errorMessage || "Something went wrong";
    } else {
      endpoint = resolveVariables(node.data.endpoint || "", variables);
      method = (node.data.method || "GET").toUpperCase();
      bodyTemplate = node.data.bodyTemplate;
      responseMapping = node.data.responseMapping || [];
      errorMsg = node.data.errorMessage || "Something went wrong";
    }

    const url = `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

    const fetchOptions: RequestInit = { method, headers };
    if (method !== "GET" && bodyTemplate) {
      fetchOptions.body = resolveVariables(bodyTemplate, variables);
    }

    try {
      if (!isUrlSafe(url)) {
        throw new Error("Blocked: URL targets a private or internal address");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      fetchOptions.signal = controller.signal;

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();

      // Extract response fields per responseMapping
      for (const mapping of responseMapping) {
        const value = extractJsonPath(json, mapping.jsonPath);
        variables[mapping.variableName] = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
      }

      await logMessage(`API ${method} ${endpoint} → ${response.status}`, "api_call");
      const next = findNextNode(flow, node.id);
      return { nextNodeId: next?.id || null, waitForInput: false };
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error("[flow] api_call error:", errMessage);
      const resolvedErrMsg = resolveVariables(errorMsg, variables);
      await sendTextMessage(customerId, phone, resolvedErrMsg);
      await logMessage(`API error: ${errMessage}`, "api_call_error");
      return { nextNodeId: null, waitForInput: false };
    }
  }

  if (node.type === "delay") {
    const delayMinutes = node.data.delayMinutes || 5;
    const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
    await supabase.from("flow_delayed_jobs").insert({
      session_id: sessionId,
      node_id: node.id,
      execute_at: executeAt,
    });
    // The delayed job will resume from the next node
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: true }; // pause until delay
  }

  if (node.type === "follow_up") {
    // Follow-up is a timeout handler — skip through to next node in chain
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  return { nextNodeId: null, waitForInput: false };
}

// ── Persistent message deduplication (DB-level, works across function instances) ──
async function isDuplicateDb(messageId: string): Promise<boolean> {
  // Try to insert the message ID. If it already exists (unique violation), it's a duplicate.
  const { error } = await supabase
    .from("flow_processed_messages")
    .insert({ id_message: messageId });
  if (error) {
    // 23505 = unique_violation → already processed
    return true;
  }
  return false;
}

// Cleanup old dedup entries (fire-and-forget, runs occasionally)
function cleanupOldDedup() {
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  supabase
    .from("flow_processed_messages")
    .delete()
    .lt("created_at", oneHourAgo)
    .then(() => {});
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[flow] Received webhook:", { type: body.type, customerId: body.customerId, from: body.from, hasMessage: !!body.message });

    // Handle outgoing messages — set cooldown when owner replies manually
    if (body.type === "outgoing") {
      const outCustomerId = body.customerId || "";
      const outPhone = body.from || "";
      if (outCustomerId && outPhone) {
        const { data: outProfile } = await supabase
          .from("profiles")
          .select("id, active_flow_id")
          .eq("id", outCustomerId)
          .single();

        if (outProfile?.active_flow_id) {
          const { data: wf } = await supabase
            .from("workflows")
            .select("flow_json")
            .eq("id", outProfile.active_flow_id)
            .single();

          if (wf) {
            const flowSettings = getFlowSettings(wf.flow_json as FlowJSON);
            if (flowSettings.cooldownEnabled) {
              const cooldownUntil = new Date(
                Date.now() + flowSettings.cooldownMinutes * 60 * 1000
              ).toISOString();

              // Set cooldown on the session for this phone
              await supabase
                .from("subscriber_sessions")
                .update({ cooldown_until: cooldownUntil })
                .eq("workflow_id", outProfile.active_flow_id)
                .eq("phone", outPhone);

              console.log("[flow] Cooldown set for", outPhone, "until", cooldownUntil);
            }
          }
        }
      }
      return new Response(JSON.stringify({ ok: true, action: "outgoing_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip non-incoming, non-outgoing event types
    if (body.type !== "incoming") {
      console.log("[flow] Skipping non-incoming type:", body.type);
      return new Response(JSON.stringify({ ok: true, skipped: body.type || "unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate using customerId + from + timestamp combo
    const dedupKey = `${body.customerId}:${body.from}:${body.timestamp}`;
    if (dedupKey && await isDuplicateDb(dedupKey)) {
      console.log("[flow] Skipping duplicate:", dedupKey);
      return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Occasionally clean up old dedup entries
    if (Math.random() < 0.1) cleanupOldDedup();

    // WClixAPI webhook format — flat payload
    const customerId = body.customerId || "";
    const phone = body.from || "";
    const userMessage = (body.message || "").trim();
    const buttonClickId = ""; // WClixAPI sends button clicks as plain text — matched by label/number

    if (!customerId || !phone || !userMessage) {
      console.log("[flow] Missing fields:", { customerId, phone, userMessage });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the user (bot owner) by customerId (= Supabase user UUID)
    let profile: { id: string; active_flow_id: string | null; bot_status: string; blocked_numbers: unknown } | null = null;

    const { data } = await supabase
      .from("profiles")
      .select("id, active_flow_id, bot_status, blocked_numbers")
      .eq("id", customerId)
      .single();
    profile = data;

    if (!profile) {
      console.log("[flow] No profile found for customerId:", customerId);
      return new Response(JSON.stringify({ ok: true, reason: "no_profile" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip processing if bot is paused or not connected
    if (profile.bot_status !== "connected") {
      console.log("[flow] Bot not active. Status:", profile.bot_status, "for user:", profile.id);
      return new Response(JSON.stringify({ ok: true, skipped: "bot_not_active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard: blocked numbers
    const blockedNumbers = Array.isArray(profile.blocked_numbers) ? profile.blocked_numbers as string[] : [];
    if (blockedNumbers.length > 0) {
      const normalizedPhone = phone.startsWith("+") ? phone : "+" + phone;
      if (blockedNumbers.includes(phone) || blockedNumbers.includes(normalizedPhone)) {
        console.log("[flow] Blocked number, skipping:", phone);
        return new Response(JSON.stringify({ ok: true, skipped: "blocked_number" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let activeFlowId = profile.active_flow_id;

    // Auto-detect or create workflow if active_flow_id is not set
    if (!activeFlowId) {
      // Try to find an existing active workflow for this user
      const { data: autoFlow } = await supabase
        .from("workflows")
        .select("id")
        .eq("user_id", profile.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (autoFlow) {
        activeFlowId = autoFlow.id;
      } else {
        const { data: newFlow } = await supabase
          .from("workflows")
          .insert({
            user_id: profile.id,
            name: "שיחה חופשית",
            flow_json: {
              nodes: [
                {
                  id: "start-default",
                  type: "start",
                  position: { x: 400, y: 50 },
                  data: { type: "start", triggerText: "" },
                },
              ],
              edges: [],
            },
            status: "active",
          })
          .select("id")
          .single();
        if (newFlow) activeFlowId = newFlow.id;
      }

      // Update profile with the detected/created flow
      if (activeFlowId) {
        await supabase.from("profiles")
          .update({ active_flow_id: activeFlowId })
          .eq("id", profile.id);
      }
    }

    if (!activeFlowId) {
      console.log("[flow] No active flow for user:", profile.id);
      return new Response(JSON.stringify({ ok: true, reason: "no_active_flow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the workflow
    const { data: workflow } = await supabase
      .from("workflows")
      .select("id, flow_json, status, workflow_record")
      .eq("id", activeFlowId)
      .single();

    if (!workflow) {
      console.log("[flow] Workflow not found:", activeFlowId);
      return new Response(JSON.stringify({ ok: true, reason: "no_workflow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isFlowActive = workflow.status === "active";
    const flow = workflow.flow_json as FlowJSON;
    const workflowRecord = (workflow.workflow_record as string) || undefined;

    // When workflow is not active (paused/draft), skip flow execution but still respond via LLM
    if (!isFlowActive) {
      console.log("[flow] Workflow paused, using LLM-only mode:", activeFlowId, workflow.status);

      // Find or create a session for LLM conversation
      const { data: existingSessions } = await supabase
        .from("subscriber_sessions")
        .select("*")
        .eq("workflow_id", workflow.id)
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1);

      let llmSession = existingSessions?.[0] || null;

      if (!llmSession) {
        const { data: newSession } = await supabase
          .from("subscriber_sessions")
          .insert({
            workflow_id: workflow.id,
            phone,
            current_node_id: null,
            variables: { phone },
            status: "completed",
          })
          .select()
          .single();
        llmSession = newSession;
      }

      if (llmSession) {
        await supabase.from("flow_message_log").insert({
          workflow_id: workflow.id,
          session_id: llmSession.id,
          direction: "inbound",
          message_type: "text",
          content: userMessage,
        });
        await callOpenLLM(profile.id, userMessage, llmSession.id, workflow.id, customerId, phone, workflowRecord);
      }

      return new Response(JSON.stringify({ ok: true, action: "llm_response_paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const triggers = extractTriggers(flow);
    const settings = getFlowSettings(flow);

    // ── Guard 1: Ignore group chats ──────────────────────────
    if (settings.ignoreGroupChats && body.chatType === "group") {
      return new Response(JSON.stringify({ ok: true, skipped: "group_chat" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Guard 2: Cooldown check ──────────────────────────────
    if (settings.cooldownEnabled) {
      const { data: cooldownSession } = await supabase
        .from("subscriber_sessions")
        .select("cooldown_until")
        .eq("workflow_id", workflow.id)
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();

      if (cooldownSession?.cooldown_until) {
        const cooldownEnd = new Date(cooldownSession.cooldown_until);
        if (cooldownEnd > new Date()) {
          console.log("[flow] Cooldown active for", phone, "until", cooldownSession.cooldown_until);
          return new Response(JSON.stringify({ ok: true, skipped: "cooldown_active" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Cooldown expired — clear it
        await supabase
          .from("subscriber_sessions")
          .update({ cooldown_until: null })
          .eq("workflow_id", workflow.id)
          .eq("phone", phone);
      }
    }

    // Find or create subscriber session
    const { data: sessions } = await supabase
      .from("subscriber_sessions")
      .select("*")
      .eq("workflow_id", workflow.id)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    let session = sessions?.[0] || null;

    // ── Session Auto-Reset: clear expired sessions ──────────────
    if (session && settings.sessionResetEnabled && session.last_message_at) {
      const idleMs = Date.now() - new Date(session.last_message_at).getTime();
      const resetMs = settings.sessionResetMinutes * 60 * 1000;
      if (idleMs >= resetMs) {
        console.log("[flow] Session reset: idle", Math.round(idleMs / 60000), "min >=", settings.sessionResetMinutes, "min for", phone);
        const resetState = {
          current_node_id: null,
          variables: { phone },
          status: "completed" as const,
          follow_up_count: 0,
          conversation_stage: null,
        };
        // Run all three cleanup operations concurrently (allSettled so partial failures don't crash the webhook)
        const results = await Promise.allSettled([
          supabase.from("flow_message_log").delete().eq("session_id", session.id),
          supabase.from("flow_delayed_jobs").update({ status: "cancelled" }).eq("session_id", session.id).eq("status", "pending"),
          supabase.from("subscriber_sessions").update(resetState).eq("id", session.id),
        ]);
        results.forEach((r, i) => {
          if (r.status === "rejected") console.error("[flow] Session reset op", i, "failed:", r.reason);
        });
        session = { ...session, ...resetState };
      }
    }

    if (!session) {
      const matchedNodeId0 = await classifyTrigger(triggers, userMessage);
      let triggerStart = matchedNodeId0 ? findStartNodeById(flow, matchedNodeId0) : undefined;
      if (!triggerStart) triggerStart = findCatchAllStart(flow);
      if (triggerStart) {
        // Trigger matched — start the flow
        const { data: newSession, error: insertErr } = await supabase
          .from("subscriber_sessions")
          .insert({
            workflow_id: workflow.id,
            phone,
            current_node_id: triggerStart.id,
            variables: { phone },
          })
          .select()
          .single();

        if (insertErr) {
          // Unique constraint — another request already created this session
          // Skip to avoid duplicate processing
          return new Response(JSON.stringify({ ok: true, skipped: "session_race" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        session = newSession;
      } else {
        // No trigger match
        if (settings.strictMode) {
          // Strict mode: no AI fallback — nudge user
          const nudge = "אני יכול לעזור רק דרך התהליך. שלח הודעה כדי להתחיל.";
          await sendTextMessage(customerId, phone, nudge);
          return new Response(JSON.stringify({ ok: true, action: "strict_nudge" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Open LLM conversation
        const { data: newSession, error: llmInsertErr } = await supabase
          .from("subscriber_sessions")
          .insert({
            workflow_id: workflow.id,
            phone,
            current_node_id: null,
            variables: { phone },
            status: "completed",
          })
          .select()
          .single();

        if (llmInsertErr) {
          // Session already exists — fetch it and use LLM
          const { data: existingSessions } = await supabase
            .from("subscriber_sessions")
            .select("*")
            .eq("workflow_id", workflow.id)
            .eq("phone", phone)
            .limit(1);
          const existingSession = existingSessions?.[0];
          if (existingSession) {
            await supabase.from("flow_message_log").insert({
              workflow_id: workflow.id,
              session_id: existingSession.id,
              direction: "inbound",
              message_type: "text",
              content: userMessage,
            });
            await callOpenLLM(profile.id, userMessage, existingSession.id, workflow.id, customerId, phone, workflowRecord);
          }
          return new Response(JSON.stringify({ ok: true, action: "llm_response" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (newSession) {
          // Log inbound message
          await supabase.from("flow_message_log").insert({
            workflow_id: workflow.id,
            session_id: newSession.id,
            direction: "inbound",
            message_type: "text",
            content: userMessage,
          });
          await callOpenLLM(profile.id, userMessage, newSession.id, workflow.id, customerId, phone, workflowRecord);
        }
        return new Response(JSON.stringify({ ok: true, action: "llm_response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!session) {
      return new Response(JSON.stringify({ error: "session_creation_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Guard 3: Session-level dedup (toggleable) ──────────────
    if (settings.deduplicateMessages) {
      // Check 1: Same inbound message recently processed for this session
      {
        const dedupWindow = new Date(Date.now() - 30_000).toISOString();
        const { data: recentInbound } = await supabase
          .from("flow_message_log")
          .select("id")
          .eq("session_id", session.id)
          .eq("direction", "inbound")
          .eq("content", userMessage)
          .gte("created_at", dedupWindow)
          .limit(1);

        if (recentInbound && recentInbound.length > 0) {
          return new Response(JSON.stringify({ ok: true, skipped: "db_dedup" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Check 2: Echo prevention — skip if the bot just sent this exact text
      // (prevents feedback loops where outgoing messages echo back as incoming)
      {
        const echoWindow = new Date(Date.now() - 15_000).toISOString();
        const { data: recentOutbound } = await supabase
          .from("flow_message_log")
          .select("id")
          .eq("session_id", session.id)
          .eq("direction", "outbound")
          .eq("content", userMessage)
          .gte("created_at", echoWindow)
          .limit(1);

        if (recentOutbound && recentOutbound.length > 0) {
          return new Response(JSON.stringify({ ok: true, skipped: "echo_prevention" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Log inbound message
    await supabase.from("flow_message_log").insert({
      workflow_id: workflow.id,
      session_id: session.id,
      node_id: session.current_node_id,
      direction: "inbound",
      message_type: "text",
      content: userMessage,
    });

    // ── Inngest dispatch (all flow execution handled by Inngest) ──
    if (USE_INNGEST) {
      await sendInngestEvent({
        userId: profile.id,
        phone,
        message: userMessage,
        customerId,
        workflowId: workflow.id,
        sessionId: session.id,
        flowJson: flow,
      });
      return new Response(JSON.stringify({ ok: true, action: "inngest_queued" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cancel any pending follow-ups — user responded
    await supabase
      .from("flow_delayed_jobs")
      .update({ status: "cancelled" })
      .eq("session_id", session.id)
      .eq("status", "pending");

    // Helper: reactivate session and fall back to open LLM conversation
    async function reactivateAndFallbackToLLM(): Promise<Response> {
      // Strict mode: no AI fallback — nudge user to start the flow
      if (settings.strictMode) {
        const nudge = "אני יכול לעזור רק דרך התהליך. שלח הודעה כדי להתחיל.";
        await sendTextMessage(customerId, phone, nudge);
        await supabase.from("flow_message_log").insert({
          workflow_id: workflow.id, session_id: session!.id,
          direction: "outbound", message_type: "text", content: nudge,
        });
        return new Response(JSON.stringify({ ok: true, action: "strict_nudge" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase
        .from("subscriber_sessions")
        .update({ status: "active", last_message_at: new Date().toISOString() })
        .eq("id", session!.id);
      await callOpenLLM(profile.id, userMessage, session!.id, workflow.id, customerId, phone, workflowRecord);
      return new Response(JSON.stringify({ ok: true, action: "llm_response" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let variables = (session.variables as Record<string, string>) || {};
    let currentNodeId = session.current_node_id;

    // Refresh session state to get latest updates (protects against race conditions
    // where a previous request is still processing and hasn't updated the session yet)
    {
      const { data: freshSession } = await supabase
        .from("subscriber_sessions")
        .select("current_node_id, variables, status")
        .eq("id", session.id)
        .single();
      if (freshSession) {
        currentNodeId = freshSession.current_node_id;
        variables = (freshSession.variables as Record<string, string>) || {};
        session = { ...session, ...freshSession };
      }
    }

    // If session completed and message matches a trigger, restart the flow
    if (session.status === "completed") {
      const matchedNodeId1 = await classifyTrigger(triggers, userMessage);
      let triggerStartNode = matchedNodeId1 ? findStartNodeById(flow, matchedNodeId1) : undefined;
      if (!triggerStartNode) triggerStartNode = findCatchAllStart(flow);
      if (triggerStartNode) {
        // Atomic lock: only one concurrent request can restart the session.
        // The WHERE status='completed' ensures only the first request wins.
        const { data: claimed } = await supabase
          .from("subscriber_sessions")
          .update({
            current_node_id: triggerStartNode.id,
            variables: { phone },
            status: "active",
            last_message_at: new Date().toISOString(),
          })
          .eq("id", session.id)
          .eq("status", "completed")
          .select("id")
          .single();

        if (!claimed) {
          // Another request already claimed this session — skip duplicate
          return new Response(JSON.stringify({ ok: true, skipped: "already_claimed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        currentNodeId = triggerStartNode.id;
        variables = { phone };
      } else {
        // No trigger match on completed session — fall back to open LLM
        return await reactivateAndFallbackToLLM();
      }
    }

    // If no current node, try trigger match or fall back to LLM
    if (!currentNodeId) {
      const matchedNodeId2 = await classifyTrigger(triggers, userMessage);
      let startNode = matchedNodeId2 ? findStartNodeById(flow, matchedNodeId2) : undefined;
      if (!startNode) startNode = findCatchAllStart(flow);
      if (startNode) {
        currentNodeId = startNode.id;
      } else {
        // No trigger match and no active flow — fall back to open LLM
        return await reactivateAndFallbackToLLM();
      }
    }

    const currentNode = findNodeById(flow, currentNodeId);
    if (!currentNode) {
      console.log("[flow] Node not found:", currentNodeId, "available nodes:", flow.nodes.map(n => `${n.id}(${n.type})`));
      return new Response(JSON.stringify({ ok: true, reason: "node_not_found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[flow] Processing:", {
      phone,
      message: userMessage,
      currentNode: `${currentNode.id}(${currentNode.type})`,
      sessionStatus: session.status,
      expectedReply: currentNode.data.expectedReply,
      continueAuto: currentNode.data.continueAuto,
      edgeCount: flow.edges.length,
    });

    let updatedVariables = { ...variables };
    const langPref = updatedVariables.language || undefined;
    let nextNodeId: string | null = null;

    // Check if message matches a trigger — restart flow even if session is active
    // Allow trigger restart from ANY state so the user can always restart the flow
    const matchedNodeId3 = await classifyTrigger(triggers, userMessage);
    const triggerNode = matchedNodeId3 ? findStartNodeById(flow, matchedNodeId3) : undefined;
    if (triggerNode && currentNode.type !== "start") {
        // Atomic lock: claim the session by changing current_node_id.
        // Only the first request to update from the current node wins.
        const { data: claimed } = await supabase
          .from("subscriber_sessions")
          .update({
            current_node_id: triggerNode.id,
            last_message_at: new Date().toISOString(),
          })
          .eq("id", session.id)
          .eq("current_node_id", currentNodeId)
          .select("id")
          .single();

        if (!claimed) {
          return new Response(JSON.stringify({ ok: true, skipped: "already_processing" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        updatedVariables = { phone };
        currentNodeId = triggerNode.id;

        const next = findNextNode(flow, triggerNode.id);
        nextNodeId = next?.id || null;

        // Execute chain from the new trigger
        let maxSteps = 20;
        while (nextNodeId && maxSteps > 0) {
          maxSteps--;
          const node = findNodeById(flow, nextNodeId);
          if (!node) break;
          // Open Bot node — stay on this node, LLM will handle it
          if (node.type === "open_bot") {
            nextNodeId = node.id;
            break;
          }
          // Legacy ai_agent nodes — skip through to next
          if (node.type === "ai_agent") {
            const next = findNextNode(flow, node.id);
            nextNodeId = next?.id || null;
            if (!nextNodeId) break;
            continue;
          }
          const result = await executeNode(node, customerId, phone, updatedVariables, flow, session.id, workflow.id);
          if (result.waitForInput) {
            nextNodeId = result.nextNodeId;
            break;
          }
          nextNodeId = result.nextNodeId;
          if (!nextNodeId) break;
        }

        const restartLandedNode = nextNodeId ? findNodeById(flow, nextNodeId) : null;
        const restartStatus = nextNodeId ? "active" : "completed";
        console.log("[flow] Trigger restart: updating session to:", nextNodeId, restartStatus);
        await updateSessionDirect(session.id, {
          current_node_id: nextNodeId,
          variables: updatedVariables,
          status: restartStatus,
          last_message_at: new Date().toISOString(),
        });

        // If trigger restart landed on open_bot, enter free AI conversation
        if (restartLandedNode?.type === "open_bot") {
          await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
        }

        return new Response(
          JSON.stringify({ ok: true, current_node: nextNodeId, status: restartStatus }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Legacy ai_agent node — use LLM fallback
    if (currentNode.type === "ai_agent") {
      await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
      await updateSessionDirect(session.id, {
        current_node_id: currentNode.id,
        status: "active",
        last_message_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ ok: true, action: "llm_response", current_node: currentNode.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Open Bot node — free AI conversation (bypass strict mode)
    if (currentNode.type === "open_bot") {
      await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
      await updateSessionDirect(session.id, {
        current_node_id: currentNode.id,
        status: "active",
        last_message_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ ok: true, action: "open_bot_llm", current_node: currentNode.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Language node — set language variable and advance
    if (currentNode.type === "language") {
      const langMap: Record<string, string> = {
        "english": "English", "אנגלית": "English",
        "עברית": "עברית", "hebrew": "עברית",
      };
      const picked = langMap[userMessage.trim().toLowerCase()] || userMessage.trim();
      updatedVariables.language = picked;
      const nextNode = findNextNode(flow, currentNode.id);
      nextNodeId = nextNode?.id || null;
    }

    // Handle user input for waiting nodes
    else if (currentNode.type === "buttons") {
      const buttons = currentNode.data.buttons || [];
      // Reverse-lookup translated button label to original for matching
      let matchMessage = userMessage;
      const translatedKey = `__btn_translated_${userMessage.trim().toLowerCase()}`;
      if (updatedVariables[translatedKey]) {
        matchMessage = updatedVariables[translatedKey];
      }
      const matched = matchButton(buttons, matchMessage, buttonClickId);
      if (matched) {
        // Store button label in variable if variableName is set
        if (currentNode.data.variableName) {
          updatedVariables[currentNode.data.variableName] = matched.label;
        }
        let nextNode = findNextNode(flow, currentNode.id, `btn-${matched.id}`);
        if (!nextNode) nextNode = findNextNode(flow, currentNode.id); // fallback: default edge
        // If button leads to a follow_up, skip through to its next node
        if (nextNode?.type === "follow_up") {
          nextNode = findNextNode(flow, nextNode.id);
        }
        nextNodeId = nextNode?.id || null;
      } else {
        // Non-button text — stay on buttons node
        if (settings.strictMode) {
          const nudge = "אנא בחר אחת מהאפשרויות:";
          await sendTextMessage(customerId, phone, nudge);
          await supabase.from("flow_message_log").insert({
            workflow_id: workflow.id, session_id: session.id,
            direction: "outbound", message_type: "text", content: nudge,
          });
        } else {
          await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
        }
        await supabase
          .from("subscriber_sessions")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", session.id);
        return new Response(JSON.stringify({ ok: true, action: settings.strictMode ? "strict_nudge" : "llm_response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if ((currentNode.type === "text" || currentNode.type === "image") && (currentNode.data.yesNoMode || currentNode.data.continueAuto || currentNode.data.expectedReply)) {
      // Node is waiting for a response from the user
      if (currentNode.data.yesNoMode) {
        // Yes/No mode — classify response as affirmative or negative via LLM
        const yesNoResult = await classifyTrigger(
          [{ id: "yes", trigger: "yes" }, { id: "no", trigger: "no" }],
          userMessage,
        );
        console.log("[flow] yesNoMode check:", { userMessage, result: yesNoResult, nodeId: currentNode.id });
        if (yesNoResult === "yes") {
          const nextNode = findNextNode(flow, currentNode.id, "yes");
          nextNodeId = nextNode?.id || null;
        } else if (yesNoResult === "no") {
          const nextNode = findNextNode(flow, currentNode.id, "no");
          nextNodeId = nextNode?.id || null;
        } else {
          // Unclear answer — re-ask
          if (settings.strictMode) {
            const nudge = `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`;
            await sendTextMessage(customerId, phone, nudge);
            await supabase.from("flow_message_log").insert({
              workflow_id: workflow.id, session_id: session.id,
              direction: "outbound", message_type: "text", content: nudge,
            });
          } else {
            await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
          }
          await supabase
            .from("subscriber_sessions")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", session.id);
          return new Response(JSON.stringify({ ok: true, action: settings.strictMode ? "strict_nudge" : "llm_response" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (currentNode.data.expectedReply) {
        // Check if user's message matches the expected reply (exact or semantic)
        const expected = currentNode.data.expectedReply.trim().toLowerCase();
        const userInput = userMessage.trim().toLowerCase();
        let matched = userInput === expected;
        if (!matched) {
          const semanticResult = await classifyTrigger(
            [{ id: "expected", trigger: currentNode.data.expectedReply }],
            userMessage,
          );
          matched = semanticResult !== null;
        }
        console.log("[flow] expectedReply check:", { expected, userInput, matched, nodeId: currentNode.id });
        if (matched) {
          const nextNode = findNextNode(flow, currentNode.id);
          console.log("[flow] expectedReply matched, nextNode:", nextNode?.id || "null", "edges from node:", flow.edges.filter(e => e.source === currentNode.id));
          nextNodeId = nextNode?.id || null;
        } else {
          // No match — check if user is refusing and allowSkip is on
          if (currentNode.data.allowSkip) {
            const isRefusal = await detectRefusal(userMessage);
            if (isRefusal) {
              console.log("[flow] allowSkip: user refused, skipping node", currentNode.id);
              const nextNode = findNextNode(flow, currentNode.id);
              nextNodeId = nextNode?.id || null;
            } else {
              // Not a refusal, re-ask
              const nudge = `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`;
              await sendTextMessage(customerId, phone, nudge);
              await supabase.from("flow_message_log").insert({
                workflow_id: workflow.id, session_id: session.id,
                direction: "outbound", message_type: "text", content: nudge,
              });
              await supabase
                .from("subscriber_sessions")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", session.id);
              return new Response(JSON.stringify({ ok: true, action: "allow_skip_reask" }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } else {
            // No allowSkip — stay on same node for flow
            if (settings.strictMode) {
              const nudge = `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`;
              await sendTextMessage(customerId, phone, nudge);
              await supabase.from("flow_message_log").insert({
                workflow_id: workflow.id, session_id: session.id,
                direction: "outbound", message_type: "text", content: nudge,
              });
            } else {
              await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
            }
            await supabase
              .from("subscriber_sessions")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", session.id);
            return new Response(JSON.stringify({ ok: true, action: settings.strictMode ? "strict_nudge" : "llm_response" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } else {
        // continueAuto — any response continues
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      }
    } else if (currentNode.type === "follow_up") {
      // User responded while on follow_up node — cancel pending follow-up and continue
      await supabase
        .from("flow_delayed_jobs")
        .update({ status: "cancelled" })
        .eq("session_id", session.id)
        .eq("node_id", currentNode.id)
        .eq("status", "pending");
      const nextNode = findNextNode(flow, currentNode.id);
      nextNodeId = nextNode?.id || null;
    } else if (currentNode.type === "collect_input") {
      let collectSkipped = false;
      // Validate input if expectedAnswer is set
      if (currentNode.data.expectedAnswer) {
        const validationResult = await validateCollectInput(
          currentNode.data.message || "",
          currentNode.data.expectedAnswer,
          userMessage,
        );
        if (validationResult === "refused" && currentNode.data.allowSkip) {
          // User refused and allowSkip is on — skip this node, store empty
          console.log("[flow] allowSkip: user refused collect_input, skipping node", currentNode.id);
          collectSkipped = true;
          const varName = currentNode.data.variableName || "answer";
          updatedVariables[varName] = "";
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else if (validationResult !== "valid" && currentNode.data.allowSkip) {
          // Validation returned "invalid" but allowSkip is on — fallback refusal check
          const isRefusal = await detectRefusal(userMessage);
          if (isRefusal) {
            console.log("[flow] allowSkip: detectRefusal fallback triggered, skipping node", currentNode.id);
            collectSkipped = true;
            const varName = currentNode.data.variableName || "answer";
            updatedVariables[varName] = "";
            const nextNode = findNextNode(flow, currentNode.id);
            nextNodeId = nextNode?.id || null;
          } else {
            if (settings.strictMode) {
              const nudge = `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`;
              await sendTextMessage(customerId, phone, nudge);
              await supabase.from("flow_message_log").insert({
                workflow_id: workflow.id, session_id: session.id,
                direction: "outbound", message_type: "text", content: nudge,
              });
            } else {
              await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
            }
            await supabase
              .from("subscriber_sessions")
              .update({ last_message_at: new Date().toISOString() })
              .eq("id", session.id);
            return new Response(JSON.stringify({ ok: true, action: "collect_input_invalid" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else if (validationResult !== "valid") {
          // Invalid or refused without allowSkip — re-ask
          if (settings.strictMode) {
            const nudge = `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`;
            await sendTextMessage(customerId, phone, nudge);
            await supabase.from("flow_message_log").insert({
              workflow_id: workflow.id, session_id: session.id,
              direction: "outbound", message_type: "text", content: nudge,
            });
          } else {
            await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
          }
          await supabase
            .from("subscriber_sessions")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", session.id);
          return new Response(JSON.stringify({ ok: true, action: "collect_input_invalid" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (currentNode.data.allowSkip) {
        // No expectedAnswer but allowSkip is on — check for refusal
        const isRefusal = await detectRefusal(userMessage);
        if (isRefusal) {
          console.log("[flow] allowSkip: user refused collect_input (no expectedAnswer), skipping node", currentNode.id);
          collectSkipped = true;
          const varName = currentNode.data.variableName || "answer";
          updatedVariables[varName] = "";
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        }
      }
      if (!collectSkipped) {
        const varName = currentNode.data.variableName || "answer";
        updatedVariables[varName] = userMessage;
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      }
    } else if (currentNode.type === "start") {
      const hasTrigger = currentNode.data.triggerText?.trim();
      if (hasTrigger) {
        const startMatchId = await classifyTrigger(triggers, userMessage);
        if (startMatchId === currentNode.id) {
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else {
          // Message does NOT match the trigger
          if (settings.strictMode) {
            const nudge = "אני יכול לעזור רק דרך התהליך. שלח הודעה כדי להתחיל.";
            await sendTextMessage(customerId, phone, nudge);
            await supabase.from("flow_message_log").insert({
              workflow_id: workflow.id, session_id: session.id,
              direction: "outbound", message_type: "text", content: nudge,
            });
          } else {
            await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
          }
          await supabase
            .from("subscriber_sessions")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", session.id);
          return new Response(JSON.stringify({ ok: true, action: settings.strictMode ? "strict_nudge" : "llm_response" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        // Catch-all start node (empty trigger) — auto-advance
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      }
    } else {
      // Other node types — find next in chain
      const nextNode = findNextNode(flow, currentNode.id);
      nextNodeId = nextNode?.id || null;
    }

    // Execute chain of nodes until we need to wait
    console.log("[flow] Starting chain execution, nextNodeId:", nextNodeId);
    let maxSteps = 20; // Safety limit
    while (nextNodeId && maxSteps > 0) {
      maxSteps--;
      const node = findNodeById(flow, nextNodeId);
      if (!node) { console.log("[flow] Chain: node not found:", nextNodeId); break; }
      console.log("[flow] Chain: executing node:", node.id, node.type);

      // Open Bot node — stay on this node, LLM will handle it
      if (node.type === "open_bot") {
        nextNodeId = node.id;
        break;
      }

      // Legacy ai_agent nodes — skip through to next
      if (node.type === "ai_agent") {
        const next = findNextNode(flow, node.id);
        nextNodeId = next?.id || null;
        if (!nextNodeId) break;
        continue;
      }

      const result = await executeNode(
        node,
        customerId,
        phone,
        updatedVariables,
        flow,
        session.id,
        workflow.id
      );

      if (result.waitForInput) {
        nextNodeId = result.nextNodeId;

        // Update session via both client and direct REST for reliability
        await supabase
          .from("subscriber_sessions")
          .update({
            current_node_id: nextNodeId,
            variables: updatedVariables,
            status: "active",
            last_message_at: new Date().toISOString(),
          })
          .eq("id", session.id);

        await updateSessionDirect(session.id, {
          current_node_id: nextNodeId,
          variables: updatedVariables,
          status: "active",
          last_message_at: new Date().toISOString(),
        });

        break;
      }

      nextNodeId = result.nextNodeId;
      if (!nextNodeId) {
        // Flow completed
        break;
      }
    }

    // If open_bot node was reached, enter free AI conversation
    const landedNode = nextNodeId ? findNodeById(flow, nextNodeId) : null;
    if (landedNode?.type === "open_bot") {
      await updateSessionDirect(session.id, {
        current_node_id: nextNodeId,
        variables: updatedVariables,
        status: "active",
        last_message_at: new Date().toISOString(),
      });
      await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
      return new Response(
        JSON.stringify({ ok: true, action: "open_bot_llm", current_node: nextNodeId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Empty flow fallback — Start node matched but no children → use LLM
    if (!nextNodeId && !workflow.strict_mode) {
      console.log("[flow] Empty flow fallback — using LLM response");
      await updateSessionDirect(session.id, {
        current_node_id: null,
        variables: updatedVariables,
        status: "completed",
        last_message_at: new Date().toISOString(),
      });
      await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone, workflowRecord, langPref);
      return new Response(
        JSON.stringify({ ok: true, action: "llm_fallback", current_node: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Final session update (handles flow completion and non-waitForInput cases)
    const sessionStatus = nextNodeId ? "active" : "completed";
    console.log("[flow] Final session update:", { node: nextNodeId, status: sessionStatus });
    await updateSessionDirect(session.id, {
      current_node_id: nextNodeId,
      variables: updatedVariables,
      status: sessionStatus,
      last_message_at: new Date().toISOString(),
    });

    // Schedule follow-up if the waiting node has a follow_up node connected
    if (nextNodeId) {
      for (const edge of flow.edges.filter((e: FlowEdge) => e.source === nextNodeId)) {
        const targetNode = findNodeById(flow, edge.target);
        if (targetNode?.type === "follow_up" && targetNode.data.message) {
          const delayMinutes = targetNode.data.delayMinutes || 30;
          const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          await supabase.from("flow_delayed_jobs").insert({
            session_id: session.id,
            node_id: targetNode.id,
            execute_at: executeAt,
            status: "pending",
          });
        }
      }

      // Schedule auto-follow-up for flow-based conversations (stage defaults to "engaging")
      await handleAutoFollowUp(session.id, workflow.id);
    }

    return new Response(
      JSON.stringify({ ok: true, current_node: nextNodeId, status: sessionStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Flow webhook error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
