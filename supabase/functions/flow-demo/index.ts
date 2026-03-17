import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { callLLMEngine, classifyTrigger, validateCollectInput, detectRefusal, translateMessage, translateButtonLabels, type TriggerInfo } from "../_shared/llm-engine.ts";
import { findOperationById } from "../_shared/integration-catalog.ts";

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
  userMessage: string
): ButtonItem | undefined {
  const normalized = userMessage.trim().toLowerCase();
  const exact = buttons.find((b) => b.label.trim().toLowerCase() === normalized);
  if (exact) return exact;
  const num = parseInt(normalized);
  if (!isNaN(num) && num >= 1 && num <= buttons.length) {
    return buttons[num - 1];
  }
  return undefined;
}

function resolveVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}


// ── LLM Fallback — uses shared engine ───────────────────────
async function callLLMFallback(
  userId: string,
  userMessage: string,
  conversationId: string,
  workflowRecord?: string,
  languagePreference?: string
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
    const buttons = node.data.buttons || [];
    let displayButtons = buttons;
    if (shouldTranslate) {
      msg = await translateMessage(msg, flowLang, targetLang);
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
    responses.push({ type: "buttons", content: msg, buttons: displayButtons });
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "collect_input") {
    let msg = resolveVariables(node.data.message || "", variables);
    if (shouldTranslate) msg = await translateMessage(msg, flowLang, targetLang);
    responses.push({ type: "text", content: msg });
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "api_call") {
    // Operation mode: resolve from catalog
    const opDef = node.data.serviceType && node.data.operationId
      ? findOperationById(node.data.serviceType, node.data.operationId)
      : undefined;

    const mappings = opDef
      ? opDef.responseMapping.map((m) => ({ jsonPath: m.jsonPath, variableName: m.variableName }))
      : (node.data.responseMapping || []);

    for (const mapping of mappings) {
      variables[mapping.variableName] = `[mock:${mapping.variableName}]`;
    }

    const displayLabel = opDef
      ? opDef.labelKey
      : `${node.data.method || "GET"} ${resolveVariables(node.data.endpoint || "/", variables)}`;

    responses.push({
      type: "text",
      content: `🔗 ${displayLabel}\n→ ${mappings.length} variable(s) set`,
    });
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
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

  return { nextNodeId: null, waitForInput: false };
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req);
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
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, variables?.language);
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
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, variables?.language);
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
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, variables?.language);
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
      const matchedId = await classifyTrigger(triggers, message);
      const triggerNode = matchedId ? findStartNodeById(flow, matchedId) : undefined;
      if (triggerNode) {
        currentNodeId = triggerNode.id;
        variables = {};
        sessionStatus = "active";
      } else {
        // No specific trigger match — check for catch-all start node (empty trigger)
        const catchAll = findCatchAllStart(flow);
        if (catchAll) {
          currentNodeId = catchAll.id;
          variables = {};
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
          variables = {};
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
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, variables?.language);
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

    let nextNodeId: string | null = null;

    // Language node — set language variable and advance
    if (currentNode.type === "language") {
      const langMap: Record<string, string> = {
        "english": "English", "אנגלית": "English",
        "עברית": "עברית", "hebrew": "עברית",
      };
      const picked = langMap[message.trim().toLowerCase()] || message.trim();
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
        // Re-send buttons
        responses.push({ type: "buttons", content: "לא הבנתי, בחר אפשרות:", buttons });
        const resultState: SessionState = { current_node_id: currentNodeId, variables, status: "active" };
        return new Response(
          JSON.stringify({ responses, conversation_id: convId, session_state: resultState }),
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
            return strictNudgeResponse(`לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`, currentNodeId);
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
              return strictNudgeResponse(`לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`, currentNodeId);
            }
          } else if (strictMode) {
            return strictNudgeResponse(`לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`, currentNodeId);
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
      // Validate input if expectedAnswer is set
      if (currentNode.data.expectedAnswer) {
        const validationResult = await validateCollectInput(
          currentNode.data.message || "",
          currentNode.data.expectedAnswer,
          message,
        );
        if (validationResult === "refused" && currentNode.data.allowSkip) {
          // User refused and allowSkip is on — skip, store empty
          collectSkipped = true;
          const varName = currentNode.data.variableName || "answer";
          variables[varName] = "";
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else if (validationResult !== "valid" && currentNode.data.allowSkip) {
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
              return strictNudgeResponse(`לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`, currentNodeId);
            }
            return llmFallbackResponse(currentNodeId);
          }
        } else if (validationResult !== "valid") {
          // Invalid or refused without allowSkip — re-ask
          if (strictMode) {
            return strictNudgeResponse(`לא הבנתי. ${currentNode.data.message || "אנא נסה שוב."}`, currentNodeId);
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
        variables[varName] = message;
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
      const botResponse = await callLLMFallback(user_id, message, convId, workflowRecord, variables?.language);
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
