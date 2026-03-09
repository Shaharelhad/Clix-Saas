import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callLLMEngine, type LLMConfig } from "../_shared/llm-engine.ts";

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
    delayMinutes?: number;
    triggerText?: string;
    expectedReply?: string;
    continueAuto?: boolean;
    followUpMessage?: string;
    // ai_agent fields
    systemPromptOverride?: string;
    temperature?: number;
    maxTokens?: number;
    model?: string;
    includeProducts?: boolean;
    includeFaqs?: boolean;
    includeScrapedContent?: boolean;
    maxHistoryMessages?: number;
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
function triggerMatches(trigger: string, message: string): boolean {
  const t = trigger.trim().toLowerCase();
  const m = message.trim().toLowerCase();
  return t === m || m.includes(t);
}

function findStartNodeByTrigger(flow: FlowJSON, message: string): FlowNode | undefined {
  return flow.nodes.find(
    (n) => n.type === "start" && n.data.triggerText &&
      triggerMatches(n.data.triggerText, message)
  );
}

function messageMatchesAnyTrigger(flow: FlowJSON, message: string): boolean {
  return flow.nodes.some(
    (n) => n.type === "start" && n.data.triggerText &&
      triggerMatches(n.data.triggerText, message)
  );
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

// ── Find catch-all AI Agent node ────────────────────────────
// Looks for a start node with empty triggerText that leads to an ai_agent node
function findCatchAllAgentNode(flow: FlowJSON): FlowNode | undefined {
  const catchAllStart = flow.nodes.find(
    (n) => n.type === "start" && (!n.data.triggerText || !n.data.triggerText.trim())
  );
  if (!catchAllStart) return undefined;
  const nextNode = findNextNode(flow, catchAllStart.id);
  if (nextNode?.type === "ai_agent") return nextNode;
  return undefined;
}

// ── Build trigger context for LLM awareness ─────────────────
function buildTriggerContext(flow: FlowJSON): string {
  const triggers = flow.nodes
    .filter((n) => n.type === "start" && n.data.triggerText?.trim())
    .map((startNode) => {
      const trigger = startNode.data.triggerText!.trim();
      const nextNode = findNextNode(flow, startNode.id);
      let description = "";
      if (nextNode) {
        if (nextNode.type === "text" && nextNode.data.message) {
          description = nextNode.data.message.substring(0, 50);
        } else if (nextNode.type === "buttons") {
          description = nextNode.data.message || "תפריט אפשרויות";
        } else if (nextNode.type === "collect_input" && nextNode.data.message) {
          description = nextNode.data.message.substring(0, 50);
        } else if (nextNode.type === "image" && nextNode.data.message) {
          description = nextNode.data.message.substring(0, 50);
        }
      }
      return { trigger, description };
    });

  if (triggers.length === 0) return "";

  const lines = triggers.map((t) => {
    const desc = t.description ? ` — ${t.description}` : "";
    return `- "${t.trigger}"${desc}`;
  });

  return `\n\nתהליכים אוטומטיים שזמינים ללקוחות (הזכר ללקוח כשרלוונטי לשיחה, אל תזכיר את כולם בבת אחת):
${lines.join("\n")}
אם הלקוח שואל על נושא שקשור לאחד מהתהליכים, הצע לו לכתוב את מילת המפתח. לדוגמה: "כתוב לי 'מחירון' ואשלח לך את כל המחירים"`;
}

// ── LLM Fallback — uses shared engine ───────────────────────
async function callLLMFallback(
  userId: string,
  userMessage: string,
  conversationId: string,
  flow?: FlowJSON,
  nodeConfig?: LLMConfig
): Promise<string> {
  // Fetch conversation history from demo_conversations
  const { data: history } = await supabase
    .from("demo_conversations")
    .select("user_message, bot_response")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(nodeConfig?.maxHistoryMessages ?? 10);

  const conversationHistory: { role: string; content: string }[] = [];
  if (history) {
    for (const row of history) {
      conversationHistory.push({ role: "user", content: row.user_message });
      conversationHistory.push({ role: "assistant", content: row.bot_response });
    }
  }

  const triggerContext = flow ? buildTriggerContext(flow) : "";

  const result = await callLLMEngine(
    supabase,
    userId,
    userMessage,
    conversationHistory,
    nodeConfig,
    triggerContext,
    true, // useDraft for preview
  );

  return result.response;
}

// ── Execute node in demo mode (no WhatsApp, collect responses) ──
function executeNodeDemo(
  node: FlowNode,
  variables: Record<string, string>,
  flow: FlowJSON,
  responses: DemoResponse[]
): { nextNodeId: string | null; waitForInput: boolean } {
  if (node.type === "start") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "text") {
    const msg = resolveVariables(node.data.message || "", variables);
    responses.push({ type: "text", content: msg });
    if (node.data.continueAuto || node.data.expectedReply) {
      return { nextNodeId: node.id, waitForInput: true };
    }
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "image") {
    const msg = resolveVariables(node.data.message || "", variables);
    responses.push({ type: "image", content: msg, imageUrl: node.data.imageUrl });
    if (node.data.continueAuto || node.data.expectedReply) {
      return { nextNodeId: node.id, waitForInput: true };
    }
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "buttons") {
    const msg = resolveVariables(node.data.message || "", variables);
    responses.push({ type: "buttons", content: msg, buttons: node.data.buttons || [] });
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "collect_input") {
    const msg = resolveVariables(node.data.message || "", variables);
    responses.push({ type: "text", content: msg });
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "delay") {
    // In demo mode, skip delays — execute immediately
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "follow_up") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "ai_agent") {
    // Mark as pending — handled async in main loop
    responses.push({ type: "ai_agent_pending", content: "" });
    return { nextNodeId: node.id, waitForInput: true };
  }

  return { nextNodeId: null, waitForInput: false };
}

// ── Main Handler ────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, workflow_id, message, conversation_id, session_state } = await req.json();

    if (!user_id || !message) {
      return new Response(
        JSON.stringify({ error: "user_id and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: workflow } = await supabase
      .from("workflows")
      .select("id, flow_json")
      .eq("id", workflowId)
      .single();

    if (!workflow) {
      return new Response(
        JSON.stringify({ error: "Workflow not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const flow = workflow.flow_json as FlowJSON;
    if (!flow?.nodes?.length) {
      const botResponse = await callLLMFallback(user_id, message, convId);
      await supabase.from("demo_conversations").insert({
        user_id,
        conversation_id: convId,
        user_message: message,
        bot_response: botResponse,
      });
      return new Response(
        JSON.stringify({ response: botResponse, conversation_id: convId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Restore session state from request
    let currentNodeId: string | null = session_state?.current_node_id || null;
    let variables: Record<string, string> = session_state?.variables || {};
    let sessionStatus: string = session_state?.status || "active";

    const responses: DemoResponse[] = [];

    // Helper: call LLM with agent config if available, save conversation, return response
    async function llmFallbackResponse(agentConfig?: LLMConfig, stayOnNode?: string | null) {
      const botResponse = await callLLMFallback(user_id, message, convId, flow, agentConfig);
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
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If session completed or no current node, check for trigger match
    if (sessionStatus === "completed" || !currentNodeId) {
      const triggerNode = findStartNodeByTrigger(flow, message);
      if (triggerNode) {
        currentNodeId = triggerNode.id;
        variables = {};
        sessionStatus = "active";
      } else {
        // No trigger match — check for catch-all AI Agent node
        const agentNode = findCatchAllAgentNode(flow);
        if (agentNode) {
          const config: LLMConfig = {
            systemPromptOverride: agentNode.data.systemPromptOverride,
            temperature: agentNode.data.temperature,
            maxTokens: agentNode.data.maxTokens,
            model: agentNode.data.model,
            includeProducts: agentNode.data.includeProducts,
            includeFaqs: agentNode.data.includeFaqs,
            includeScrapedContent: agentNode.data.includeScrapedContent,
          };
          return llmFallbackResponse(config, agentNode.id);
        }
        return llmFallbackResponse();
      }
    } else {
      // Active session — check if message matches a trigger (restart flow)
      if (messageMatchesAnyTrigger(flow, message)) {
        const triggerNode = findStartNodeByTrigger(flow, message);
        if (triggerNode) {
          currentNodeId = triggerNode.id;
          variables = {};
        }
      }
    }

    const currentNode = currentNodeId ? findNodeById(flow, currentNodeId) : null;
    if (!currentNode) {
      const agentNode = findCatchAllAgentNode(flow);
      if (agentNode) {
        const config: LLMConfig = {
          systemPromptOverride: agentNode.data.systemPromptOverride,
          temperature: agentNode.data.temperature,
          maxTokens: agentNode.data.maxTokens,
          model: agentNode.data.model,
          includeProducts: agentNode.data.includeProducts,
          includeFaqs: agentNode.data.includeFaqs,
          includeScrapedContent: agentNode.data.includeScrapedContent,
        };
        return llmFallbackResponse(config, agentNode.id);
      }
      return llmFallbackResponse(undefined, null);
    }

    // If currently on an ai_agent node and receiving a new message, call LLM
    if (currentNode.type === "ai_agent") {
      const config: LLMConfig = {
        systemPromptOverride: currentNode.data.systemPromptOverride,
        temperature: currentNode.data.temperature,
        maxTokens: currentNode.data.maxTokens,
        model: currentNode.data.model,
        includeProducts: currentNode.data.includeProducts,
        includeFaqs: currentNode.data.includeFaqs,
        includeScrapedContent: currentNode.data.includeScrapedContent,
      };
      return llmFallbackResponse(config, currentNode.id);
    }

    let nextNodeId: string | null = null;

    // Handle user input for waiting nodes
    if (currentNode.type === "buttons") {
      const buttons = currentNode.data.buttons || [];
      const matched = matchButton(buttons, message);
      if (matched) {
        let nextNode = findNextNode(flow, currentNode.id, `btn-${matched.id}`);
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
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if ((currentNode.type === "text" || currentNode.type === "image") && (currentNode.data.continueAuto || currentNode.data.expectedReply)) {
      if (currentNode.data.expectedReply) {
        const expected = currentNode.data.expectedReply.trim().toLowerCase();
        const userInput = message.trim().toLowerCase();
        if (userInput === expected) {
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else {
          // No match — LLM fallback, stay on same node
          const agentNode = findCatchAllAgentNode(flow);
          const config = agentNode ? {
            systemPromptOverride: agentNode.data.systemPromptOverride,
            temperature: agentNode.data.temperature,
            maxTokens: agentNode.data.maxTokens,
            model: agentNode.data.model,
            includeProducts: agentNode.data.includeProducts,
            includeFaqs: agentNode.data.includeFaqs,
            includeScrapedContent: agentNode.data.includeScrapedContent,
          } as LLMConfig : undefined;
          return llmFallbackResponse(config, currentNodeId);
        }
      } else {
        // continueAuto — any response continues
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      }
    } else if (currentNode.type === "collect_input") {
      const varName = currentNode.data.variableName || "answer";
      variables[varName] = message;
      const nextNode = findNextNode(flow, currentNode.id);
      nextNodeId = nextNode?.id || null;
    } else if (currentNode.type === "start") {
      if (currentNode.data.triggerText && triggerMatches(currentNode.data.triggerText, message)) {
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      } else {
        const agentNode = findCatchAllAgentNode(flow);
        const config = agentNode ? {
          systemPromptOverride: agentNode.data.systemPromptOverride,
          temperature: agentNode.data.temperature,
          maxTokens: agentNode.data.maxTokens,
          model: agentNode.data.model,
          includeProducts: agentNode.data.includeProducts,
          includeFaqs: agentNode.data.includeFaqs,
          includeScrapedContent: agentNode.data.includeScrapedContent,
        } as LLMConfig : undefined;
        return llmFallbackResponse(config, agentNode?.id || currentNodeId);
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

      // Handle ai_agent inline — call LLM and return
      if (node.type === "ai_agent") {
        const config: LLMConfig = {
          systemPromptOverride: node.data.systemPromptOverride,
          temperature: node.data.temperature,
          maxTokens: node.data.maxTokens,
          model: node.data.model,
          includeProducts: node.data.includeProducts,
          includeFaqs: node.data.includeFaqs,
          includeScrapedContent: node.data.includeScrapedContent,
        };
        const botResponse = await callLLMFallback(user_id, message, convId, flow, config);
        responses.push({ type: "text", content: botResponse });
        nextNodeId = node.id; // Stay on agent node
        break;
      }

      const result = executeNodeDemo(node, variables, flow, responses);
      if (result.waitForInput) {
        nextNodeId = result.nextNodeId;
        break;
      }
      nextNodeId = result.nextNodeId;
      if (!nextNodeId) break;
    }

    // If flow executed but produced no responses, fallback to LLM
    if (responses.length === 0) {
      const agentNode = findCatchAllAgentNode(flow);
      const config = agentNode ? {
        systemPromptOverride: agentNode.data.systemPromptOverride,
        temperature: agentNode.data.temperature,
        maxTokens: agentNode.data.maxTokens,
        model: agentNode.data.model,
        includeProducts: agentNode.data.includeProducts,
        includeFaqs: agentNode.data.includeFaqs,
        includeScrapedContent: agentNode.data.includeScrapedContent,
      } as LLMConfig : undefined;
      return llmFallbackResponse(config, agentNode?.id || null);
    }

    const finalStatus = nextNodeId ? "active" : "completed";
    const flowCompleted = !nextNodeId;

    // Save conversation turn
    if (responses.length > 0) {
      const botText = responses.map((r) => r.content).join("\n");
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("flow-demo error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
