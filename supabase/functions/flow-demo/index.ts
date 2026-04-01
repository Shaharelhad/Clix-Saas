import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { callLLMEngine, classifyTrigger, classifyIntent, validateCollectInput, detectRefusal, translateMessage, translateButtonLabels, formatApiResponse, callAgentLLM, type TriggerInfo, type AgentToolDefinition, type AgentMessage } from "../_shared/llm-engine.ts";
import { findOperationById, resolveOperation } from "../_shared/integration-catalog.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
    buttonHeader?: string;
    buttonFooter?: string;
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
    serviceType?: string;
    operationId?: string;
    inputValues?: Record<string, string>;
    endpoint?: string;
    method?: string;
    bodyTemplate?: string;
    responseMapping?: Array<{ jsonPath: string; variableName: string }>;
    errorMessage?: string;
    // ai_router
    routerIntents?: Array<{ id: string; label: string; description: string }>;
    routerContext?: string;
  };
}

interface FlowEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

interface FlowJSON {
  nodes: FlowNode[];
  edges: FlowEdge[];
  settings?: { strictMode?: boolean; [key: string]: unknown };
}

interface DemoResponse {
  type: string;
  content: string;
  imageUrl?: string;
  buttons?: ButtonItem[];
}

interface SessionState {
  current_node_id: string | null;
  variables: Record<string, string>;
  status: "active" | "completed";
}

// ── Flow Navigation Engine ──────────────────────────────────
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

function findStartNodeById(flow: FlowJSON, nodeId: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === nodeId && n.type === "start");
}

function findCatchAllStart(flow: FlowJSON): FlowNode | undefined {
  return flow.nodes.find((n) => {
    if (n.type !== "start" || n.data.disabled) return false;
    if (Array.isArray(n.data.triggerKeywords) && n.data.triggerKeywords.some((k: string) => k?.trim())) return false;
    if (n.data.triggerText?.trim()) return false;
    return true;
  });
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
  userMessage: string
): ButtonItem | undefined {
  const normalized = userMessage.trim().toLowerCase();
  const exact = buttons.find((b) => b.label.trim().toLowerCase() === normalized);
  if (exact) return exact;
  if (/^\d+$/.test(normalized)) {
    const num = parseInt(normalized);
    if (num >= 1 && num <= buttons.length) {
      return buttons[num - 1];
    }
  }
  return undefined;
}

function resolveVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
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

function extractJsonPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}


// ── LLM Fallback — uses shared engine ───────────────────────
async function callLLMFallback(
  userId: string,
  userMessage: string,
  conversationId: string,
  workflowRecord?: string,
  languagePreference?: string,
  sessionVariables?: Record<string, string>,
): Promise<string> {
  // Fetch conversation history from demo_conversations
  const { data: history } = await supabase
    .from("demo_conversations")
    .select("user_message, bot_response")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(10);

  const conversationHistory: { role: string; content: string }[] = [];
  if (history) {
    for (const row of history) {
      conversationHistory.push({ role: "user", content: row.user_message });
      conversationHistory.push({ role: "assistant", content: row.bot_response });
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
    true,      // useDraft for preview
    fullWorkflowRecord || undefined,
    false,     // classifyStage
    sessionVariables,
  );

  return result.response;
}

// ── Execute node in demo mode (no WhatsApp, collect responses) ──
async function executeNodeDemo(
  node: FlowNode,
  variables: Record<string, string>,
  flow: FlowJSON,
  responses: DemoResponse[]
): Promise<{ nextNodeId: string | null; waitForInput: boolean }> {
  // Auto-translation check
  const flowLang = (flow.settings as Record<string, unknown>)?.flowLanguage as string || "he";
  const shouldTranslate = variables.language
    && variables.language.toLowerCase() !== flowLang.toLowerCase();
  const targetLang = variables.language || flowLang;

  if (node.type === "start") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  // Open Bot — terminate flow, enter free AI conversation
  if (node.type === "open_bot") {
    return { nextNodeId: null, waitForInput: false };
  }

  // AI Router — classify message intent and route to matching handle
  if (node.type === "ai_router") {
    const intents = node.data.routerIntents ?? [];
    if (intents.length === 0) {
      const next = findNextNode(flow, node.id, "intent-fallback");
      return { nextNodeId: next?.id || null, waitForInput: false };
    }

    // Resolve context variables
    const context = node.data.routerContext
      ? resolveVariables(node.data.routerContext, variables)
      : undefined;

    // Get the last user message from the demo conversation
    const lastUserMsg = variables.__lastUserMessage || "";

    const matchedIntentId = await classifyIntent(
      intents.filter((i) => i.label.trim()),
      lastUserMsg,
      context,
    );

    const handleId = matchedIntentId ? `intent-${matchedIntentId}` : "intent-fallback";
    const next = findNextNode(flow, node.id, handleId);
    console.log("[flow-demo] ai_router:", { lastUserMsg, matchedIntentId, handleId, nextId: next?.id });
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  // Language — send language selection buttons
  if (node.type === "language") {
    const msg = resolveVariables(node.data.message || "Choose your language:", variables);
    const langButtons = [
      { id: "lang-en", label: "English" },
      { id: "lang-he", label: "עברית" },
    ];
    responses.push({ type: "buttons", content: msg, buttons: langButtons });
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "text") {
    let msg = resolveVariables(node.data.message || "", variables);
    if (shouldTranslate) msg = await translateMessage(msg, flowLang, targetLang);
    responses.push({ type: "text", content: msg });
    if (node.data.yesNoMode || node.data.continueAuto || node.data.expectedReply) {
      return { nextNodeId: node.id, waitForInput: true };
    }
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "image") {
    let msg = resolveVariables(node.data.message || "", variables);
    if (shouldTranslate) msg = await translateMessage(msg, flowLang, targetLang);
    responses.push({ type: "image", content: msg, imageUrl: node.data.imageUrl });
    if (node.data.continueAuto || node.data.expectedReply) {
      return { nextNodeId: node.id, waitForInput: true };
    }
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "buttons") {
    let msg = resolveVariables(node.data.message || "", variables);
    let header = resolveVariables(node.data.buttonHeader || "", variables);
    let footer = resolveVariables(node.data.buttonFooter || "", variables);
    const buttons = node.data.buttons || [];
    let displayButtons = buttons;
    if (shouldTranslate) {
      msg = await translateMessage(msg, flowLang, targetLang);
      if (header) header = await translateMessage(header, flowLang, targetLang);
      if (footer) footer = await translateMessage(footer, flowLang, targetLang);
      const translatedLabels = await translateButtonLabels(
        buttons.map((b) => b.label),
        flowLang,
        targetLang,
      );
      displayButtons = buttons.map((b, i) => ({ ...b, label: translatedLabels[i] || b.label }));
      for (let i = 0; i < buttons.length; i++) {
        variables[`__btn_translated_${translatedLabels[i]?.trim().toLowerCase()}`] = buttons[i].label;
      }
    }
    responses.push({
      type: "buttons",
      content: msg,
      buttons: displayButtons,
      ...(header ? { header } : {}),
      ...(footer ? { footer } : {}),
    });
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "collect_input") {
    let msg = resolveVariables(node.data.message || "", variables);
    if (shouldTranslate) msg = await translateMessage(msg, flowLang, targetLang);
    responses.push({ type: "text", content: msg });
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "api_call") {
    const integrationId = node.data.integrationId;
    console.log("[flow-demo] api_call node:", { integrationId, operationId: node.data.operationId, serviceType: node.data.serviceType });
    if (!integrationId) {
      console.log("[flow-demo] api_call: no integrationId, skipping");
      const next = findNextNode(flow, node.id);
      return { nextNodeId: next?.id || null, waitForInput: false };
    }

    // Fetch integration credentials from DB
    const { data: integration, error: intError } = await supabase
      .from("integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (intError || !integration || integration.status !== "active") {
      console.log("[flow-demo] api_call: integration not found or inactive", { intError, status: integration?.status });
      const next = findNextNode(flow, node.id);
      return { nextNodeId: next?.id || null, waitForInput: false };
    }
    console.log("[flow-demo] api_call: integration loaded", { type: integration.integration_type, status: integration.status });

    // Build URL and headers based on integration type
    const config = integration.config as Record<string, string>;
    let baseUrl = "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (integration.integration_type === "cloudbeds") {
      baseUrl = "https://api.cloudbeds.com";
      headers["Authorization"] = `Bearer ${config.apiKey}`;
    } else if (integration.integration_type === "notion") {
      baseUrl = "https://api.notion.com";
      headers["Authorization"] = `Bearer ${config.apiKey}`;
      headers["Notion-Version"] = "2022-06-28";
    } else {
      baseUrl = config.baseUrl || "";
      if (config.authType === "bearer") {
        headers["Authorization"] = `Bearer ${config.authValue}`;
      } else if (config.authType === "api_key") {
        headers["x-api-key"] = config.authValue;
      }
      // Merge custom headers if defined
      const customHeaders = (integration.config as Record<string, unknown>)?.customHeaders;
      if (customHeaders && typeof customHeaders === "object") {
        Object.assign(headers, customHeaders);
      }
    }

    // Resolve operation from catalog if in operation mode
    let endpoint: string;
    let method: string;
    let bodyTemplate: string | undefined;
    let responseMapping: Array<{ jsonPath: string; variableName: string }>;

    if (node.data.operationId && node.data.serviceType) {
      const mergedInputs: Record<string, string> = { ...(node.data.inputValues || {}) };
      // Resolve variables in input values
      for (const key of Object.keys(mergedInputs)) {
        mergedInputs[key] = resolveVariables(mergedInputs[key], variables);
      }
      if (integration.integration_type === "cloudbeds") {
        if (config.propertyId) mergedInputs.propertyId = config.propertyId;
        if (config.bookingUrl) mergedInputs.bookingUrl = config.bookingUrl;
      }
      const resolved = resolveOperation(node.data.serviceType, node.data.operationId, mergedInputs);
      if (!resolved) {
        const next = findNextNode(flow, node.id);
        return { nextNodeId: next?.id || null, waitForInput: false };
      }

      // constructUrl mode: skip API call, return resolved template as URL
      if (resolved.constructUrl) {
        const constructedUrl = resolveVariables(resolved.endpoint, variables);
        if (!constructedUrl || constructedUrl.startsWith("?") || constructedUrl.includes("{{")) {
          variables.error = "Booking URL not configured. Add it in integration settings.";
          const next = findNextNode(flow, node.id, "error");
          return { nextNodeId: next?.id || null, waitForInput: false };
        }
        for (const mapping of resolved.responseMapping) {
          variables[mapping.variableName] = constructedUrl;
        }
        const next = findNextNode(flow, node.id, "success");
        return { nextNodeId: next?.id || null, waitForInput: false };
      }

      endpoint = resolveVariables(resolved.endpoint, variables);
      method = resolved.method;
      bodyTemplate = resolved.bodyTemplate;
      responseMapping = [
        ...resolved.responseMapping,
        ...(node.data.responseMapping || []),
      ];
    } else {
      endpoint = resolveVariables(node.data.endpoint || "", variables);
      method = (node.data.method || "GET").toUpperCase();
      bodyTemplate = node.data.bodyTemplate;
      responseMapping = node.data.responseMapping || [];
    }

    const url = `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

    const fetchOptions: RequestInit = { method, headers };
    if (method !== "GET" && bodyTemplate) {
      const resolvedBody = resolveVariables(bodyTemplate, variables);
      fetchOptions.body = resolvedBody;
      console.log("[flow-demo] api_call body:", resolvedBody);
    }
    console.log("[flow-demo] api_call:", { method, url: `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`, hasBody: !!fetchOptions.body, variables: JSON.stringify(variables).substring(0, 200) });

    try {
      if (!isUrlSafe(url)) {
        throw new Error("Blocked: URL targets a private or internal address");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      fetchOptions.signal = controller.signal;

      console.log("[flow-demo] api_call URL:", url);
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[flow-demo] api_call HTTP error:", response.status, errorBody);
        throw new Error(`HTTP ${response.status}: ${errorBody.substring(0, 200)}`);
      }

      const json = await response.json();
      console.log("[flow-demo] api_call response keys:", Object.keys(json));
      // Debug: log actual Notion property names for mapping troubleshooting
      if (json.results?.[0]?.properties) {
        const propNames = Object.keys(json.results[0].properties);
        console.log("[flow-demo] Notion properties found:", JSON.stringify(propNames));
        for (const pn of propNames) {
          const prop = json.results[0].properties[pn];
          console.log("[flow-demo] Notion prop:", JSON.stringify(pn), "type:", prop?.type);
        }
      }

      // Extract response fields and LLM-format structured data
      let hasData = false;
      console.log("[flow-demo] responseMapping count:", responseMapping.length, "mappings:", JSON.stringify(responseMapping));
      for (const mapping of responseMapping) {
        const value = extractJsonPath(json, mapping.jsonPath);
        console.log("[flow-demo] extractJsonPath:", JSON.stringify(mapping.jsonPath), "→ var:", mapping.variableName, "type:", typeof value, value === null ? "null" : value === undefined ? "undefined" : "has data");
        const raw = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
        // Check if the extracted data is meaningful (non-empty array/object/string)
        const isEmpty = !value || (Array.isArray(value) && value.length === 0);
        if (!isEmpty) {
          variables[mapping.variableName] = typeof value === "object" && value !== null
            ? await formatApiResponse(raw, mapping.variableName)
            : raw;
          hasData = true;
        } else {
          variables[mapping.variableName] = "";
        }
      }

      if (!hasData) {
        variables.error = node.data.outputLanguage === "he"
          ? "מצטערים, לא נמצאו חדרים פנויים לתאריכים שנבחרו. נסה תאריכים אחרים."
          : "Sorry, no available rooms were found for the selected dates. Please try different dates.";
      }

      // Compute extra adult charge and total price from Cloudbeds adultsExtraCharge object
      if (integration.integration_type === "cloudbeds" && hasData) {
        const room = json.data?.[0]?.propertyRooms?.[0];
        const adultsExtra = room?.adultsExtraCharge;
        // Resolve adults count from inputValues (e.g. "{{total_guest}}") or common variable names
        const adultsInput = (node.data.inputValues as Record<string, string>)?.adults || "";
        const adultsVarMatch = adultsInput.match(/\{\{(\w+)\}\}/);
        const adultsCount = adultsVarMatch ? (variables[adultsVarMatch[1]] || "1") : (variables.adults || variables.number_of_guests || variables.total_guest || "1");
        let extraCharge = 0;
        if (adultsExtra && typeof adultsExtra === "object") {
          extraCharge = parseFloat(adultsExtra[adultsCount]) || 0;
        }
        variables.extra_adult_charge = String(extraCharge);
        const basePrice = parseFloat(variables.price) || 0;
        variables.total_price = String(basePrice + extraCharge);
      }

      // Convert price, total_price, and extra_adult_charge to ILS if requested
      if (integration.integration_type === "cloudbeds"
          && node.data.outputCurrency === "ILS"
          && variables.price
          && hasData) {
        const priceNum = parseFloat(variables.price);
        if (!isNaN(priceNum) && variables.currency !== "₪") {
          const fromCode = variables.currency === "$" ? "USD" : variables.currency === "€" ? "EUR" : "USD";
          try {
            const rateRes = await fetch(`https://open.er-api.com/v6/latest/${fromCode}`);
            const rateData = await rateRes.json();
            const ilsRate = rateData.rates?.ILS;
            if (ilsRate) {
              variables.price = String(Math.round(priceNum * ilsRate));
              const extraNum = parseFloat(variables.extra_adult_charge) || 0;
              if (extraNum > 0) {
                variables.extra_adult_charge = String(Math.round(extraNum * ilsRate));
              }
              const totalNum = parseFloat(variables.total_price) || 0;
              if (totalNum > 0) {
                variables.total_price = String(Math.round(totalNum * ilsRate));
              }
              variables.currency = "₪";
            }
          } catch { /* keep original if conversion fails */ }
        }
      }

      // Route via success/error handle
      let next = findNextNode(flow, node.id, hasData ? "success" : "error");
      if (!next) next = findNextNode(flow, node.id); // fallback to default edge
      return { nextNodeId: next?.id || null, waitForInput: false };
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error("[flow-demo] api_call error:", errMessage);
      variables.error = errMessage;
      // Store empty values
      for (const mapping of responseMapping) {
        variables[mapping.variableName] = "";
      }
      // Route via error handle
      let next = findNextNode(flow, node.id, "error");
      if (!next) next = findNextNode(flow, node.id); // fallback to default edge
      return { nextNodeId: next?.id || null, waitForInput: false };
    }
  }

  if (node.type === "delay") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "follow_up") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "ai_agent") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  // Notion AI Agent — stay on this node and wait for user input
  if (node.type === "notion_ai_agent") {
    return { nextNodeId: node.id, waitForInput: true };
  }

  return { nextNodeId: null, waitForInput: false };
}

// ── Notion AI Agent Executor ────────────────────────────────

async function executeNotionAgent(
  node: { id: string; type: string; data: Record<string, unknown> },
  userMessage: string,
  variables: Record<string, string>,
  agentHistory: AgentMessage[],
  userId: string,
  workflowRecord?: string,
): Promise<{ response: string; toolCalls: Array<{ name: string; input: Record<string, unknown>; result: unknown }>; updatedHistory: AgentMessage[] }> {
  const integrationId = node.data.agentIntegrationId as string | undefined;
  const databaseId = node.data.agentDatabaseId as string | undefined;
  const userPrompt = resolveVariables(node.data.agentSystemPrompt as string || "", variables);
  // Inject today's date so LLM can resolve "tomorrow", "next week", etc.
  const today = new Date().toLocaleDateString("he-IL", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Jerusalem" });
  const todayISO = new Date().toISOString().split("T")[0];
  const dateContext = `התאריך של היום: ${today} (${todayISO})\n\n`;
  // Prepend date + workflow_record (business content) to the system prompt
  const systemPrompt = dateContext + (workflowRecord ? workflowRecord + "\n\n" : "") + userPrompt;
  const tools = node.data.agentTools as Record<string, unknown> || {};

  console.log("[notion_ai_agent] Config:", { integrationId: integrationId || "EMPTY", databaseId, toolsConfig: JSON.stringify(tools).substring(0, 200), promptLen: systemPrompt.length, historyLen: agentHistory.length });

  // Load Notion integration credentials
  let notionApiKey = "";
  let notionHeaders: Record<string, string> = {};
  if (integrationId) {
    const { data: intg } = await supabase.from("integrations").select("config").eq("id", integrationId).single();
    if (intg?.config) {
      const config = intg.config as Record<string, unknown>;
      notionApiKey = (config.apiKey as string) || "";
      notionHeaders = {
        "Authorization": `Bearer ${notionApiKey}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      };
      if (config.customHeaders && typeof config.customHeaders === "object") {
        Object.assign(notionHeaders, config.customHeaders);
      }
    }
  }

  // Build tool definitions
  const toolDefs: AgentToolDefinition[] = [];

  if (tools.updateNotion) {
    toolDefs.push({
      name: "update_notion",
      description: `Update a customer's Notion page. Always send ALL fields you want to update in a single call. Use the exact Notion API property format:
- Status: {"סטטוס": {"status": {"name": "תהליך מכירה"}}}
- Event date: {"תאריך ושעת האירוע": {"date": {"start": "2026-07-10"}}}
- Venue: {"שם מקום אירוע": {"rich_text": [{"text": {"content": "אלגריה"}}]}}
- Audience: {"סוג קהל": {"select": {"name": "כללי"}}}
- Meeting scheduled: {"נקבע פגישה": {"checkbox": true}} or false to reset
- No-response counter: {"כמות אין מענה": {"number": 0}}
- Follow-up date: {"תאריך פולואפ": {"date": {"start": "2026-07-10T14:00:00+03:00"}}}
- Conversation history: {"היסטוריית שיחה": {"rich_text": [{"text": {"content": ""}}]}}
Combine multiple fields in one call.`,
      parameters: {
        type: "object",
        properties: {
          page_id: { type: "string", description: "The Notion page ID" },
          properties: { type: "object", description: "Notion properties to update" },
        },
        required: ["page_id", "properties"],
      },
    });
  }

  const bookEventDate = tools.bookEventDate as { enabled?: boolean; webhookUrl?: string } | undefined;
  if (bookEventDate?.enabled && bookEventDate.webhookUrl) {
    toolDefs.push({
      name: "book_event_date",
      description: "Book an ALL-DAY event in Google Calendar to reserve the wedding/event date. Call this immediately after calendar_check confirms the date is available. This does NOT schedule a meeting call — it only blocks the event date.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Event date YYYY-MM-DD" },
          name: { type: "string", description: "Customer name" },
          venue: { type: "string", description: "Venue/hall name" },
          phone: { type: "string", description: "Customer phone number" },
          audience: { type: "string", description: "Audience type (כללי/דתי/בני העדה)" },
        },
        required: ["date", "name"],
      },
    });
  }

  const calendarCheck = tools.calendarCheck as { enabled?: boolean; webhookUrl?: string } | undefined;
  if (calendarCheck?.enabled && calendarCheck.webhookUrl) {
    toolDefs.push({
      name: "calendar_check",
      description: "Check Google Calendar availability for a specific date. Returns whether the date is available or too busy.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date to check in YYYY-MM-DD format" },
        },
        required: ["date"],
      },
    });
  }

  const findSlots = tools.findSlots as { enabled?: boolean; webhookUrl?: string } | undefined;
  if (findSlots?.enabled && findSlots.webhookUrl) {
    toolDefs.push({
      name: "find_slots",
      description: "Find 2 free time slots for a meeting in the next 3 days. Returns two available times.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Preferred date in YYYY-MM-DD format" },
        },
        required: ["date"],
      },
    });
  }

  const createMeeting = tools.createMeeting as { enabled?: boolean; webhookUrl?: string } | undefined;
  if (createMeeting?.enabled && createMeeting.webhookUrl) {
    toolDefs.push({
      name: "create_meeting",
      description: "Create a meeting in Google Calendar. Use after customer confirms a time.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Meeting date YYYY-MM-DD" },
          time: { type: "string", description: "Meeting time HH:MM" },
          name: { type: "string", description: "Customer name" },
          phone: { type: "string", description: "Customer phone number" },
          type: { type: "string", enum: ["phone", "face_to_face"], description: "Meeting type" },
        },
        required: ["date", "time", "name", "phone", "type"],
      },
    });
  }

  console.log("[notion_ai_agent] Tools defined:", toolDefs.map(t => t.name), "notionApiKey:", notionApiKey ? "SET" : "EMPTY");

  // Tool executor
  const executeTool = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    if (name === "update_notion") {
      const pageId = args.page_id as string || variables.page_id;
      console.log("[notion_ai_agent] update_notion called:", { pageId: pageId || "EMPTY", hasApiKey: !!notionApiKey, args: JSON.stringify(args).substring(0, 500) });
      if (!pageId || !notionApiKey) return { error: `Missing ${!pageId ? "page_id" : "Notion credentials"}. page_id=${pageId}, hasKey=${!!notionApiKey}` };
      const body = JSON.stringify({ properties: args.properties });
      console.log("[notion_ai_agent] Notion PATCH body:", body.substring(0, 500));
      const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: notionHeaders,
        body,
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error("[notion_ai_agent] update_notion error:", response.status, errText.substring(0, 500));
        return { error: `Notion API error ${response.status}: ${errText.substring(0, 200)}` };
      }
      console.log("[notion_ai_agent] update_notion SUCCESS for page:", pageId);
      return { success: true };
    }

    if (name === "book_event_date" && bookEventDate?.webhookUrl) {
      console.log("[notion_ai_agent] book_event_date called:", JSON.stringify(args).substring(0, 300));
      const response = await fetch(bookEventDate.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return await response.json();
    }

    if (name === "calendar_check" && calendarCheck?.webhookUrl) {
      const response = await fetch(calendarCheck.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: args.date }),
      });
      return await response.json();
    }

    if (name === "find_slots" && findSlots?.webhookUrl) {
      const response = await fetch(findSlots.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: args.date }),
      });
      return await response.json();
    }

    if (name === "create_meeting" && createMeeting?.webhookUrl) {
      const response = await fetch(createMeeting.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      return await response.json();
    }

    return { error: `Unknown tool: ${name}` };
  };

  // Call the agent LLM
  const result = await callAgentLLM({
    systemPrompt,
    conversationHistory: agentHistory,
    userMessage,
    tools: toolDefs,
    executeTool,
  });

  // Build updated history (trim to last 20 messages)
  const newHistory: AgentMessage[] = [
    ...agentHistory,
    { role: "user", content: userMessage },
    { role: "assistant", content: result.response },
  ];
  const trimmedHistory = newHistory.length > 20 ? newHistory.slice(-20) : newHistory;

  return {
    response: result.response,
    toolCalls: result.toolCalls,
    updatedHistory: trimmedHistory,
  };
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req, body);
    const { workflow_id, message, conversation_id, session_state } = body;

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const convId = conversation_id || crypto.randomUUID();

    // Load workflow — use workflow_id if provided, otherwise find active
    let workflowId = workflow_id;
    if (!workflowId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("active_flow_id")
        .eq("id", user_id)
        .single();
      workflowId = profile?.active_flow_id;
    }

    if (!workflowId) {
      // No workflow — pure LLM fallback
      const botResponse = await callLLMFallback(user_id, message, convId);
      await supabase.from("demo_conversations").insert({
        user_id,
        conversation_id: convId,
        user_message: message,
        bot_response: botResponse,
      });
      return new Response(
        JSON.stringify({ response: botResponse, conversation_id: convId }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const { data: workflow } = await supabase
      .from("workflows")
      .select("id, flow_json, status, workflow_record")
      .eq("id", workflowId)
      .single();

    if (!workflow) {
      return new Response(
        JSON.stringify({ error: "Workflow not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Workflow paused — use LLM-only mode (no flow node execution)
    if (workflow.status !== "active") {
      const workflowRecord = (workflow.workflow_record as string) || undefined;
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, session_state?.variables?.language, session_state?.variables);
      await supabase.from("demo_conversations").insert({
        user_id,
        conversation_id: convId,
        user_message: message,
        bot_response: botResponse,
      });
      return new Response(
        JSON.stringify({ response: botResponse, conversation_id: convId }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const flow = workflow.flow_json as FlowJSON;
    const workflowRecord = (workflow.workflow_record as string) || undefined;

    if (!flow?.nodes?.length) {
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, session_state?.variables?.language, session_state?.variables);
      await supabase.from("demo_conversations").insert({
        user_id,
        conversation_id: convId,
        user_message: message,
        bot_response: botResponse,
      });
      return new Response(
        JSON.stringify({ response: botResponse, conversation_id: convId }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const triggers = extractTriggers(flow);

    // Restore session state from request
    let currentNodeId: string | null = session_state?.current_node_id || null;
    let variables: Record<string, string> = session_state?.variables || {};
    variables.__lastUserMessage = message; // Store for ai_router access
    // Preserve system variables (phone from test settings) across resets
    const _systemVars: Record<string, string> = {};
    if (variables.phone) _systemVars.phone = variables.phone;
    let sessionStatus: string = session_state?.status || "active";

    const responses: DemoResponse[] = [];

    const strictMode = flow.settings?.strictMode ?? false;

    // Helper: strict mode nudge response (no AI)
    function strictNudgeResponse(nudgeText: string, stayOnNode?: string | null) {
      const nodeId = stayOnNode !== undefined ? stayOnNode : currentNodeId;
      return new Response(
        JSON.stringify({
          responses: [{ type: "text", content: nudgeText }],
          conversation_id: convId,
          session_state: { current_node_id: nodeId, variables, status: nodeId ? "active" : "completed" },
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Helper: call LLM fallback, save conversation, return response
    async function llmFallbackResponse(stayOnNode?: string | null) {
      if (strictMode) {
        return strictNudgeResponse("אני יכול לעזור רק דרך התהליך. שלח הודעה כדי להתחיל.", stayOnNode);
      }
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, variables?.language, variables);
      await supabase.from("demo_conversations").insert({
        user_id,
        conversation_id: convId,
        user_message: message,
        bot_response: botResponse,
      });
      const nodeId = stayOnNode !== undefined ? stayOnNode : currentNodeId;
      return new Response(
        JSON.stringify({
          response: botResponse,
          conversation_id: convId,
          session_state: { current_node_id: nodeId, variables, status: nodeId ? "active" : "completed" },
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // If session completed or no current node, check for trigger match
    if (sessionStatus === "completed" || !currentNodeId) {
      // Completed session with global menu — prioritize menu over trigger restart
      if (sessionStatus === "completed") {
        const globalMenuNode = flow.nodes.find((n) => n.type === "buttons" && n.data.isGlobalMenu === true);
        if (globalMenuNode) {
          // Check if user typed an exact button label — route to that button's target
          const menuButtons = globalMenuNode.data.buttons || [];
          const menuMatch = matchButton(menuButtons, message);
          if (menuMatch) {
            let targetNode = findNextNode(flow, globalMenuNode.id, `btn-${menuMatch.id}`);
            if (targetNode) {
              console.log("[flow-demo] Completed — global menu button match:", menuMatch.label, "→", targetNode.id);
              let jumpNodeId: string | null = targetNode.id;
              let maxSteps = 20;
              while (jumpNodeId && maxSteps > 0) {
                maxSteps--;
                const node = findNodeById(flow, jumpNodeId);
                if (!node) break;
                if (node.type === "open_bot") { jumpNodeId = node.id; break; }
                if (node.type === "ai_agent") {
                  const next = findNextNode(flow, node.id);
                  jumpNodeId = next?.id || null;
                  if (!jumpNodeId) break;
                  continue;
                }
                const result = await executeNodeDemo(node, variables, flow, responses);
                if (result.waitForInput) { jumpNodeId = result.nextNodeId; break; }
                jumpNodeId = result.nextNodeId;
                if (!jumpNodeId) break;
              }
              return new Response(
                JSON.stringify({
                  responses: responses,
                  conversation_id: convId,
                  session_state: {
                    current_node_id: jumpNodeId,
                    variables,
                    status: jumpNodeId ? "active" : "completed",
                  },
                }),
                { headers: { ...cors, "Content-Type": "application/json" } }
              );
            }
          }
          // No button match — resend the global menu
          await executeNodeDemo(globalMenuNode, variables, flow, responses);
          return new Response(
            JSON.stringify({
              responses: responses,
              conversation_id: convId,
              session_state: { current_node_id: globalMenuNode.id, variables, status: "active" },
            }),
            { headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      }
      // No global menu or brand new session — try trigger classification
      const matchedId = await classifyTrigger(triggers, message);
      const triggerNode = matchedId ? findStartNodeById(flow, matchedId) : undefined;
      if (triggerNode) {
        currentNodeId = triggerNode.id;
        variables = { ..._systemVars };
        sessionStatus = "active";
      } else {
        // No trigger match — check for catch-all start node (empty trigger)
        const catchAll = findCatchAllStart(flow);
        if (catchAll) {
          currentNodeId = catchAll.id;
          variables = { ..._systemVars };
          sessionStatus = "active";
        } else {
          return llmFallbackResponse(null);
        }
      }
    } else {
      // Active session — check if message matches a trigger (restart flow)
      const matchedId = await classifyTrigger(triggers, message);
      if (matchedId) {
        const triggerNode = findStartNodeById(flow, matchedId);
        if (triggerNode) {
          currentNodeId = triggerNode.id;
          variables = { ..._systemVars };
        }
      }
    }

    const currentNode = currentNodeId ? findNodeById(flow, currentNodeId) : null;
    if (!currentNode) {
      return llmFallbackResponse(null);
    }

    // Legacy ai_agent node — use LLM fallback
    if (currentNode.type === "ai_agent") {
      return llmFallbackResponse(currentNode.id);
    }

    // Open Bot node — free AI conversation (bypass strict mode)
    if (currentNode.type === "open_bot") {
      // Menu-intent keyword check — navigate back to the parent menu
      const MENU_KEYWORDS = ["menu", "תפריט", "tafrit", "main menu", "תפריט ראשי", "back to menu", "חזרה לתפריט", "back"];
      const normalizedForMenu = message.trim().toLowerCase();
      const isMenuRequest = MENU_KEYWORDS.some(kw => normalizedForMenu === kw || normalizedForMenu.includes(kw));

      if (isMenuRequest && currentNode.data.linkedNodeId) {
        const parentMenuNode = findNodeById(flow, currentNode.data.linkedNodeId);
        if (parentMenuNode) {
          console.log("[flow-demo] Menu keyword on open_bot — returning to parent menu:", parentMenuNode.id);
          await executeNodeDemo(parentMenuNode, variables, flow, responses);
          return new Response(
            JSON.stringify({
              responses: responses,
              conversation_id: convId,
              session_state: { current_node_id: parentMenuNode.id, variables, status: "active" },
            }),
            { headers: { ...cors, "Content-Type": "application/json" } }
          );
        }
      }

      // No menu request or no linked parent — continue with LLM
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, variables?.language, variables);
      await supabase.from("demo_conversations").insert({
        user_id, conversation_id: convId,
        user_message: message, bot_response: botResponse,
      });
      return new Response(
        JSON.stringify({
          response: botResponse,
          conversation_id: convId,
          session_state: { current_node_id: currentNode.id, variables, status: "active" },
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Notion AI Agent node — conversational agent with tool calling
    if (currentNode.type === "notion_ai_agent") {
      const agentResult = await executeNotionAgent(currentNode, message, variables, session_state?.agent_history || [], user_id, workflowRecord);
      // Save conversation to demo_conversations
      await supabase.from("demo_conversations").insert({
        user_id, conversation_id: convId,
        user_message: message, bot_response: agentResult.response,
      });
      // Update variables from tool calls (e.g., agent updated Notion)
      for (const tc of agentResult.toolCalls) {
        if (tc.name === "update_notion" && tc.result && typeof tc.result === "object" && (tc.result as Record<string, unknown>).success) {
          // Merge any extracted fields into variables
          const props = (tc.input.properties || {}) as Record<string, unknown>;
          if (props["תאריך ושעת האירוע"]) variables.event_date = String((props["תאריך ושעת האירוע"] as Record<string, unknown>)?.date?.start || variables.event_date || "");
          if (props["שם מקום אירוע"]) variables.venue_name = String(((props["שם מקום אירוע"] as Record<string, unknown>)?.rich_text as Array<Record<string, unknown>>)?.[0]?.text?.content || variables.venue_name || "");
          if (props["סוג קהל"]) variables.audience = String((props["סוג קהל"] as Record<string, unknown>)?.select?.name || variables.audience || "");
          if (props["סטטוס"]) variables.status = String((props["סטטוס"] as Record<string, unknown>)?.status?.name || variables.status || "");
        }
      }
      return new Response(
        JSON.stringify({
          responses: [{ type: "text", content: agentResult.response }],
          conversation_id: convId,
          session_state: {
            current_node_id: currentNode.id,
            variables,
            agent_history: agentResult.updatedHistory,
            status: "active",
          },
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    let nextNodeId: string | null = null;

    // Global menu check — match buttons on isGlobalMenu nodes from anywhere in the flow
    // Skip for purely numeric input to avoid false numeric button matches
    const isNumericOnly = /^\d+$/.test(message.trim());
    if (!isNumericOnly && !(currentNode.type === "buttons" && currentNode.data.isGlobalMenu)) {
      const menuNodes = flow.nodes.filter(
        (n) => n.type === "buttons" && n.data.isGlobalMenu === true && n.id !== currentNode.id,
      );
      for (const menuNode of menuNodes) {
        const menuButtons = menuNode.data.buttons || [];
        const menuMatch = matchButton(menuButtons, message);
        if (menuMatch) {
          let targetNode = findNextNode(flow, menuNode.id, `btn-${menuMatch.id}`);
          if (targetNode) {
            console.log("[flow-demo] Global menu match:", menuMatch.label, "→", targetNode.id);
            let jumpNodeId: string | null = targetNode.id;
            let maxSteps = 20;
            while (jumpNodeId && maxSteps > 0) {
              maxSteps--;
              const node = findNodeById(flow, jumpNodeId);
              if (!node) break;
              if (node.type === "open_bot") { jumpNodeId = node.id; break; }
              if (node.type === "ai_agent") {
                const next = findNextNode(flow, node.id);
                jumpNodeId = next?.id || null;
                if (!jumpNodeId) break;
                continue;
              }
              const result = await executeNodeDemo(node, variables, flow, responses);
              if (result.waitForInput) { jumpNodeId = result.nextNodeId; break; }
              jumpNodeId = result.nextNodeId;
              if (!jumpNodeId) break;
            }
            return new Response(
              JSON.stringify({
                response: responses,
                conversation_id: convId,
                session_state: {
                  current_node_id: jumpNodeId,
                  variables,
                  status: jumpNodeId ? "active" : "completed",
                },
              }),
              { headers: { ...cors, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Language node — set language variable and advance
    if (currentNode.type === "language") {
      const langMap: Record<string, string> = {
        "english": "English", "אנגלית": "English",
        "עברית": "עברית", "hebrew": "עברית",
      };
      const picked = langMap[message.trim().toLowerCase()];
      if (!picked) {
        // Invalid input — resend language buttons
        const msg = resolveVariables(currentNode.data.message || "Choose your language:", variables);
        const langButtons = [
          { id: "lang-en", label: "English" },
          { id: "lang-he", label: "עברית" },
        ];
        responses.push({ type: "buttons", content: msg, buttons: langButtons });
        return new Response(
          JSON.stringify({
            response: responses,
            conversation_id: convId,
            session_state: { current_node_id: currentNode.id, variables, status: "active" },
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      variables.language = picked;
      const nextNode = findNextNode(flow, currentNode.id);
      nextNodeId = nextNode?.id || null;
    }

    // Handle user input for waiting nodes
    else if (currentNode.type === "buttons") {
      const buttons = currentNode.data.buttons || [];
      // Reverse-lookup translated button label to original for matching
      let matchMessage = message;
      const translatedKey = `__btn_translated_${message.trim().toLowerCase()}`;
      if (variables[translatedKey]) {
        matchMessage = variables[translatedKey];
      }
      const matched = matchButton(buttons, matchMessage);
      if (matched) {
        let nextNode = findNextNode(flow, currentNode.id, `btn-${matched.id}`);
        if (!nextNode) nextNode = findNextNode(flow, currentNode.id); // fallback: default edge
        if (nextNode?.type === "follow_up") {
          nextNode = findNextNode(flow, nextNode.id);
        }
        nextNodeId = nextNode?.id || null;
      } else {
        // Re-send the current buttons node (with proper translation)
        await executeNodeDemo(currentNode, variables, flow, responses);
        return new Response(
          JSON.stringify({ response: responses, conversation_id: convId, session_state: { current_node_id: currentNodeId, variables, status: "active" } }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    } else if ((currentNode.type === "text" || currentNode.type === "image") && (currentNode.data.yesNoMode || currentNode.data.continueAuto || currentNode.data.expectedReply)) {
      if (currentNode.data.yesNoMode) {
        // Yes/No mode — classify response as affirmative or negative via LLM
        const yesNoResult = await classifyTrigger(
          [{ id: "yes", trigger: "yes" }, { id: "no", trigger: "no" }],
          message,
        );
        if (yesNoResult === "yes") {
          const nextNode = findNextNode(flow, currentNode.id, "yes");
          nextNodeId = nextNode?.id || null;
        } else if (yesNoResult === "no") {
          const nextNode = findNextNode(flow, currentNode.id, "no");
          nextNodeId = nextNode?.id || null;
        } else {
          // Unclear answer — re-ask
          if (strictMode) {
            return strictNudgeResponse(
              (currentNode.data.outputLanguage || "he") === "he"
                ? `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`
                : `I didn't understand. ${currentNode.data.message || "Please try again."}`,
              currentNodeId,
            );
          }
          return llmFallbackResponse(currentNodeId);
        }
      } else if (currentNode.data.expectedReply) {
        const expected = currentNode.data.expectedReply.trim().toLowerCase();
        const userInput = message.trim().toLowerCase();
        let matched = userInput === expected;
        if (!matched) {
          const semanticResult = await classifyTrigger(
            [{ id: "expected", trigger: currentNode.data.expectedReply }],
            message,
          );
          matched = semanticResult !== null;
        }
        if (matched) {
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else {
          // No match — check if user is refusing and allowSkip is on
          if (currentNode.data.allowSkip) {
            const isRefusal = await detectRefusal(message);
            if (isRefusal) {
              const nextNode = findNextNode(flow, currentNode.id);
              nextNodeId = nextNode?.id || null;
            } else {
              return strictNudgeResponse(
              (currentNode.data.outputLanguage || "he") === "he"
                ? `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`
                : `I didn't understand. ${currentNode.data.message || "Please try again."}`,
              currentNodeId,
            );
            }
          } else if (strictMode) {
            return strictNudgeResponse(
              (currentNode.data.outputLanguage || "he") === "he"
                ? `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`
                : `I didn't understand. ${currentNode.data.message || "Please try again."}`,
              currentNodeId,
            );
          } else {
            return llmFallbackResponse(currentNodeId);
          }
        }
      } else {
        // continueAuto — any response continues
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      }
    } else if (currentNode.type === "collect_input") {
      let collectSkipped = false;
      let formattedValue: string | undefined;
      // Validate input if expectedAnswer is set
      if (currentNode.data.expectedAnswer) {
        const validationResult = await validateCollectInput(
          currentNode.data.message || "",
          currentNode.data.expectedAnswer,
          message,
          currentNode.data.outputFormat || undefined,
          variables,
        );
        formattedValue = validationResult.formatted;
        if (validationResult.result === "refused" && currentNode.data.allowSkip) {
          // User refused and allowSkip is on — skip, store empty
          collectSkipped = true;
          const varName = currentNode.data.variableName || "answer";
          variables[varName] = "";
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else if (validationResult.result !== "valid" && currentNode.data.allowSkip) {
          // Validation returned "invalid" but allowSkip is on — fallback refusal check
          const isRefusal = await detectRefusal(message);
          if (isRefusal) {
            collectSkipped = true;
            const varName = currentNode.data.variableName || "answer";
            variables[varName] = "";
            const nextNode = findNextNode(flow, currentNode.id);
            nextNodeId = nextNode?.id || null;
          } else {
            if (strictMode) {
              return strictNudgeResponse(
              (currentNode.data.outputLanguage || "he") === "he"
                ? `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`
                : `I didn't understand. ${currentNode.data.message || "Please try again."}`,
              currentNodeId,
            );
            }
            return llmFallbackResponse(currentNodeId);
          }
        } else if (validationResult.result !== "valid") {
          // Invalid or refused without allowSkip — re-ask
          if (strictMode) {
            return strictNudgeResponse(
              (currentNode.data.outputLanguage || "he") === "he"
                ? `לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`
                : `I didn't understand. ${currentNode.data.message || "Please try again."}`,
              currentNodeId,
            );
          }
          return llmFallbackResponse(currentNodeId);
        }
      } else if (currentNode.data.allowSkip) {
        // No expectedAnswer but allowSkip is on — check for refusal
        const isRefusal = await detectRefusal(message);
        if (isRefusal) {
          collectSkipped = true;
          const varName = currentNode.data.variableName || "answer";
          variables[varName] = "";
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        }
      }
      if (!collectSkipped) {
        const varName = currentNode.data.variableName || "answer";
        variables[varName] = formattedValue || message;
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      }
    } else if (currentNode.type === "start") {
      if (currentNode.data.triggerText) {
        const startMatchId = await classifyTrigger(triggers, message);
        if (startMatchId === currentNode.id) {
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else {
          // Message does NOT match the trigger
          if (strictMode) {
            return strictNudgeResponse("אני יכול לעזור רק דרך התהליך. שלח הודעה כדי להתחיל.", currentNodeId);
          }
          return llmFallbackResponse(currentNodeId);
        }
      } else {
        // Catch-all start node (empty trigger) — auto-advance
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      }
    } else {
      const nextNode = findNextNode(flow, currentNode.id);
      nextNodeId = nextNode?.id || null;
    }

    // Execute chain of nodes until we need to wait for input
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

      const result = await executeNodeDemo(node, variables, flow, responses);
      if (result.waitForInput) {
        nextNodeId = result.nextNodeId;
        break;
      }
      nextNodeId = result.nextNodeId;
      if (!nextNodeId) break;
    }

    // If open_bot node was reached, enter free AI conversation (bypass strict mode)
    const finalNode = nextNodeId ? findNodeById(flow, nextNodeId) : null;
    if (finalNode?.type === "open_bot") {
      // Save any flow responses accumulated before open_bot as context
      if (responses.length > 0) {
        const flowText = responses.map((r) => {
          if (r.buttons?.length) {
            return `${r.content}\n[${r.buttons.map((b) => b.label).join(", ")}]`;
          }
          return r.content;
        }).join("\n");
        await supabase.from("demo_conversations").insert({
          user_id, conversation_id: convId,
          user_message: message, bot_response: flowText,
        });
      }
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, variables?.language, variables);
      await supabase.from("demo_conversations").insert({
        user_id, conversation_id: convId,
        user_message: message, bot_response: botResponse,
      });
      return new Response(
        JSON.stringify({
          response: botResponse,
          conversation_id: convId,
          session_state: { current_node_id: nextNodeId, variables, status: "active" },
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // If notion_ai_agent node was reached via chain, handle it (same pattern as open_bot above)
    if (finalNode?.type === "notion_ai_agent") {
      // Save any flow responses accumulated before the agent as context
      if (responses.length > 0) {
        const flowText = responses.map((r) => r.content).join("\n");
        await supabase.from("demo_conversations").insert({
          user_id, conversation_id: convId,
          user_message: message, bot_response: flowText,
        });
      }
      const agentResult = await executeNotionAgent(finalNode, message, variables, session_state?.agent_history || [], user_id, workflowRecord);
      await supabase.from("demo_conversations").insert({
        user_id, conversation_id: convId,
        user_message: message, bot_response: agentResult.response,
      });
      for (const tc of agentResult.toolCalls) {
        if (tc.name === "update_notion" && tc.result && typeof tc.result === "object" && (tc.result as Record<string, unknown>).success) {
          const props = (tc.input.properties || {}) as Record<string, unknown>;
          if (props["תאריך ושעת האירוע"]) variables.event_date = String((props["תאריך ושעת האירוע"] as Record<string, unknown>)?.date?.start || variables.event_date || "");
          if (props["שם מקום אירוע"]) variables.venue_name = String(((props["שם מקום אירוע"] as Record<string, unknown>)?.rich_text as Array<Record<string, unknown>>)?.[0]?.text?.content || variables.venue_name || "");
          if (props["סוג קהל"]) variables.audience = String((props["סוג קהל"] as Record<string, unknown>)?.select?.name || variables.audience || "");
          if (props["סטטוס"]) variables.status = String((props["סטטוס"] as Record<string, unknown>)?.status?.name || variables.status || "");
        }
      }
      return new Response(
        JSON.stringify({
          responses: [...responses, { type: "text", content: agentResult.response }],
          conversation_id: convId,
          session_state: {
            current_node_id: nextNodeId,
            variables,
            agent_history: agentResult.updatedHistory,
            status: "active",
          },
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // If flow executed but produced no responses, fallback to LLM
    if (responses.length === 0) {
      return llmFallbackResponse(null);
    }

    const finalStatus = nextNodeId ? "active" : "completed";
    const flowCompleted = !nextNodeId;

    // Save conversation turn
    if (responses.length > 0) {
      const botText = responses.map((r) => {
        if (r.buttons?.length) {
          return `${r.content}\n[${r.buttons.map((b) => b.label).join(", ")}]`;
        }
        return r.content;
      }).join("\n");
      await supabase.from("demo_conversations").insert({
        user_id,
        conversation_id: convId,
        user_message: message,
        bot_response: botText,
      });
    }

    return new Response(
      JSON.stringify({
        responses,
        conversation_id: convId,
        flow_completed: flowCompleted,
        session_state: { current_node_id: nextNodeId, variables, status: finalStatus },
      }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("flow-demo error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
