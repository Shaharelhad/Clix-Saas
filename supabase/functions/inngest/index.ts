/**
 * Inngest Serve Edge Function
 *
 * This edge function serves Inngest function definitions.
 * Inngest cloud calls this endpoint to execute durable workflow functions.
 *
 * Functions:
 *   - process-message: Main WhatsApp flow execution (triggered by flow-webhook)
 */

// deno-lint-ignore-file no-explicit-any

import { Inngest } from "https://esm.sh/inngest@3";
import { serve } from "https://esm.sh/inngest@3/edge";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callLLMEngine, type LLMConfig } from "../_shared/llm-engine.ts";
import {
  sendTextMessage,
  sendButtonsMessage,
  sendImageMessage,
  type ButtonItem,
} from "../_shared/wa-messaging.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const inngest = new Inngest({
  id: "clix",
  eventKey: Deno.env.get("INNGEST_EVENT_KEY"),
});

// ── Types ───────────────────────────────────────────────────

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

// ── Flow Navigation Helpers ─────────────────────────────────

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

function findNodeById(flow: FlowJSON, id: string): FlowNode | undefined {
  return flow.nodes.find((n) => n.id === id);
}

function findNextNode(flow: FlowJSON, fromNodeId: string, sourceHandle?: string): FlowNode | undefined {
  const edge = flow.edges.find(
    (e) => e.source === fromNodeId && (!sourceHandle || e.sourceHandle === sourceHandle)
  );
  if (!edge) return undefined;
  return findNodeById(flow, edge.target);
}

function matchButton(buttons: ButtonItem[], userMessage: string, buttonClickId?: string): ButtonItem | undefined {
  if (buttonClickId) {
    const byId = buttons.find((b) => b.id === buttonClickId);
    if (byId) return byId;
  }
  const normalized = userMessage.trim().toLowerCase();
  const exact = buttons.find((b) => b.label.trim().toLowerCase() === normalized);
  if (exact) return exact;
  const num = parseInt(normalized);
  if (!isNaN(num) && num >= 1 && num <= buttons.length) {
    return buttons[num - 1];
  }
  return undefined;
}

function resolveVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}

function messageMatchesAnyTrigger(flow: FlowJSON, message: string): boolean {
  return flow.nodes.some(
    (n) => n.type === "start" && n.data.triggerText &&
      triggerMatches(n.data.triggerText, message)
  );
}

function findCatchAllAgentNode(flow: FlowJSON): FlowNode | undefined {
  const catchAllStart = flow.nodes.find(
    (n) => n.type === "start" && (!n.data.triggerText || !n.data.triggerText.trim())
  );
  if (!catchAllStart) return undefined;
  const nextNode = findNextNode(flow, catchAllStart.id);
  if (nextNode?.type === "ai_agent") return nextNode;
  return undefined;
}

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

// ── Execute a single node ───────────────────────────────────
async function executeNode(
  node: FlowNode,
  customerId: string,
  phone: string,
  variables: Record<string, string>,
  flow: FlowJSON,
  sessionId: string,
  workflowId: string,
): Promise<{ nextNodeId: string | null; waitForInput: boolean }> {
  const logMessage = async (content: string, messageType: string) => {
    await supabase.from("flow_message_log").insert({
      workflow_id: workflowId,
      session_id: sessionId,
      node_id: node.id,
      direction: "outbound",
      message_type: messageType,
      content,
    });
    supabase.rpc("increment_node_sent" as never, {
      p_workflow_id: workflowId,
      p_node_id: node.id,
    }).then(() => {}).catch(() => {});
  };

  if (node.type === "start") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "text") {
    const msg = resolveVariables(node.data.message || "", variables);
    await sendTextMessage(customerId, phone, msg);
    await logMessage(msg, "text");
    if (node.data.continueAuto || node.data.expectedReply) {
      return { nextNodeId: node.id, waitForInput: true };
    }
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  if (node.type === "image") {
    const msg = resolveVariables(node.data.message || "", variables);
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
    const msg = resolveVariables(node.data.message || "", variables);
    const buttons = node.data.buttons || [];
    await sendButtonsMessage(customerId, phone, msg, buttons);
    await logMessage(msg, "buttons");
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "collect_input") {
    const msg = resolveVariables(node.data.message || "", variables);
    await sendTextMessage(customerId, phone, msg);
    await logMessage(msg, "collect_input");
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "follow_up") {
    const next = findNextNode(flow, node.id);
    return { nextNodeId: next?.id || null, waitForInput: false };
  }

  // ai_agent and delay are handled in the step function directly (not here)
  // because they need Inngest step primitives (step.sleep, step.run)

  return { nextNodeId: null, waitForInput: false };
}

// ── Call LLM with agent config ──────────────────────────────
async function callLLMForAgent(
  userId: string,
  userMessage: string,
  sessionId: string,
  flow: FlowJSON,
  agentConfig?: LLMConfig,
): Promise<string> {
  const maxHistory = agentConfig?.maxHistoryMessages ?? 20;
  const { data: history } = await supabase
    .from("flow_message_log")
    .select("direction, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(maxHistory);

  const conversationHistory: { role: string; content: string }[] = [];
  if (history) {
    for (const row of history) {
      conversationHistory.push({
        role: row.direction === "inbound" ? "user" : "assistant",
        content: row.content,
      });
    }
  }

  const triggerContext = buildTriggerContext(flow);
  const result = await callLLMEngine(
    supabase,
    userId,
    userMessage,
    conversationHistory,
    agentConfig,
    triggerContext,
    false, // production = not draft
  );

  return result.response;
}

// ── Helper: get LLMConfig from agent node ───────────────────
function getAgentConfig(node: FlowNode): LLMConfig {
  return {
    systemPromptOverride: node.data.systemPromptOverride,
    temperature: node.data.temperature,
    maxTokens: node.data.maxTokens,
    model: node.data.model,
    includeProducts: node.data.includeProducts,
    includeFaqs: node.data.includeFaqs,
    includeScrapedContent: node.data.includeScrapedContent,
  };
}

// ── Inngest Function: process-message ───────────────────────
const processMessage = inngest.createFunction(
  {
    id: "process-message",
    concurrency: [{ key: "event.data.phone", limit: 1 }],
    retries: 1,
  },
  { event: "whatsapp/message.received" },
  async ({ event, step }) => {
    const {
      userId,
      phone,
      message: userMessage,
      customerId,
      workflowId,
      sessionId,
      flowJson,
    } = event.data;

    const flow = flowJson as FlowJSON;

    // Step 1: Load current session state
    const sessionState = await step.run("load-session", async () => {
      const { data } = await supabase
        .from("subscriber_sessions")
        .select("current_node_id, variables, status")
        .eq("id", sessionId)
        .single();
      return data || { current_node_id: null, variables: { phone }, status: "active" };
    });

    let currentNodeId: string | null = sessionState.current_node_id;
    let variables: Record<string, string> = (sessionState.variables as Record<string, string>) || { phone };
    const sessionStatus = sessionState.status as string;

    // Step 2: Resolve which node to process
    const resolved = await step.run("resolve-node", async () => {
      // If session completed, try trigger match
      if (sessionStatus === "completed" || !currentNodeId) {
        const triggerNode = findStartNodeByTrigger(flow, userMessage);
        if (triggerNode) {
          return { nodeId: triggerNode.id, variables: { phone }, action: "trigger_restart" };
        }
        // Check for catch-all AI agent
        const agentNode = findCatchAllAgentNode(flow);
        if (agentNode) {
          return { nodeId: agentNode.id, variables, action: "catch_all_agent" };
        }
        return { nodeId: null, variables, action: "llm_fallback" };
      }

      // Active session — check trigger restart
      if (messageMatchesAnyTrigger(flow, userMessage)) {
        const triggerNode = findStartNodeByTrigger(flow, userMessage);
        if (triggerNode) {
          return { nodeId: triggerNode.id, variables: { phone }, action: "trigger_restart" };
        }
      }

      return { nodeId: currentNodeId, variables, action: "continue" };
    });

    currentNodeId = resolved.nodeId;
    variables = resolved.variables;

    // Step 3: Handle LLM fallback (no trigger, no agent node)
    if (resolved.action === "llm_fallback") {
      const response = await step.run("llm-fallback", async () => {
        return callLLMForAgent(userId, userMessage, sessionId, flow);
      });

      await step.run("send-llm-reply", async () => {
        await sendTextMessage(customerId, phone, response);
        await supabase.from("flow_message_log").insert({
          workflow_id: workflowId,
          session_id: sessionId,
          direction: "outbound",
          message_type: "llm_response",
          content: response,
        });
      });

      return { action: "llm_response", nodeId: null };
    }

    // Step 4: Handle AI Agent node directly
    if (resolved.action === "catch_all_agent" && currentNodeId) {
      const agentNode = findNodeById(flow, currentNodeId)!;
      const config = getAgentConfig(agentNode);

      const response = await step.run("ai-agent", async () => {
        return callLLMForAgent(userId, userMessage, sessionId, flow, config);
      });

      await step.run("send-agent-reply", async () => {
        await sendTextMessage(customerId, phone, response);
        await supabase.from("flow_message_log").insert({
          workflow_id: workflowId,
          session_id: sessionId,
          node_id: currentNodeId,
          direction: "outbound",
          message_type: "llm_response",
          content: response,
        });
        // Stay on agent node
        await supabase.from("subscriber_sessions").update({
          current_node_id: currentNodeId,
          variables,
          status: "active",
          last_message_at: new Date().toISOString(),
        }).eq("id", sessionId);
      });

      return { action: "ai_agent_response", nodeId: currentNodeId };
    }

    if (!currentNodeId) {
      return { action: "no_node", nodeId: null };
    }

    // Step 5: Process input for current node + execute chain
    const result = await step.run("execute-flow", async () => {
      const currentNode = findNodeById(flow, currentNodeId!);
      if (!currentNode) return { nextNodeId: null, updatedVars: variables };

      let nextNodeId: string | null = null;
      const updatedVars = { ...variables };

      // Handle current node (user just sent a message while waiting on this node)
      if (currentNode.type === "ai_agent") {
        // Currently on an ai_agent node — call LLM
        const config = getAgentConfig(currentNode);
        const response = await callLLMForAgent(userId, userMessage, sessionId, flow, config);
        await sendTextMessage(customerId, phone, response);
        await supabase.from("flow_message_log").insert({
          workflow_id: workflowId,
          session_id: sessionId,
          node_id: currentNode.id,
          direction: "outbound",
          message_type: "llm_response",
          content: response,
        });
        return { nextNodeId: currentNode.id, updatedVars, status: "active" };
      }

      if (currentNode.type === "buttons") {
        const buttons = currentNode.data.buttons || [];
        const matched = matchButton(buttons, userMessage);
        if (matched) {
          let nextNode = findNextNode(flow, currentNode.id, `btn-${matched.id}`);
          if (nextNode?.type === "follow_up") {
            nextNode = findNextNode(flow, nextNode.id);
          }
          nextNodeId = nextNode?.id || null;
        } else {
          await sendButtonsMessage(customerId, phone, "לא הבנתי, בחר אפשרות:", buttons);
          return { nextNodeId: currentNode.id, updatedVars, status: "active" };
        }
      } else if ((currentNode.type === "text" || currentNode.type === "image") && (currentNode.data.continueAuto || currentNode.data.expectedReply)) {
        if (currentNode.data.expectedReply) {
          const expected = currentNode.data.expectedReply.trim().toLowerCase();
          const userInput = userMessage.trim().toLowerCase();
          if (userInput === expected) {
            const nextNode = findNextNode(flow, currentNode.id);
            nextNodeId = nextNode?.id || null;
          } else {
            // No match — LLM fallback, stay on same node
            const agentNode = findCatchAllAgentNode(flow);
            const config = agentNode ? getAgentConfig(agentNode) : undefined;
            const response = await callLLMForAgent(userId, userMessage, sessionId, flow, config);
            await sendTextMessage(customerId, phone, response);
            await supabase.from("flow_message_log").insert({
              workflow_id: workflowId,
              session_id: sessionId,
              direction: "outbound",
              message_type: "llm_response",
              content: response,
            });
            return { nextNodeId: currentNode.id, updatedVars, status: "active" };
          }
        } else {
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        }
      } else if (currentNode.type === "collect_input") {
        const varName = currentNode.data.variableName || "answer";
        updatedVars[varName] = userMessage;
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      } else if (currentNode.type === "start") {
        const hasTrigger = currentNode.data.triggerText?.trim();
        if (hasTrigger && triggerMatches(currentNode.data.triggerText!, userMessage)) {
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else if (!hasTrigger) {
          // Empty trigger start — move to next node
          const nextNode = findNextNode(flow, currentNode.id);
          nextNodeId = nextNode?.id || null;
        } else {
          // Trigger mismatch — LLM fallback
          const agentNode = findCatchAllAgentNode(flow);
          const config = agentNode ? getAgentConfig(agentNode) : undefined;
          const response = await callLLMForAgent(userId, userMessage, sessionId, flow, config);
          await sendTextMessage(customerId, phone, response);
          await supabase.from("flow_message_log").insert({
            workflow_id: workflowId,
            session_id: sessionId,
            direction: "outbound",
            message_type: "llm_response",
            content: response,
          });
          return { nextNodeId: currentNode.id, updatedVars, status: "active" };
        }
      } else {
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      }

      // Execute chain of nodes
      let maxSteps = 20;
      while (nextNodeId && maxSteps > 0) {
        maxSteps--;
        const node = findNodeById(flow, nextNodeId);
        if (!node) break;

        // Handle ai_agent in chain
        if (node.type === "ai_agent") {
          const config = getAgentConfig(node);
          const response = await callLLMForAgent(userId, userMessage, sessionId, flow, config);
          await sendTextMessage(customerId, phone, response);
          await supabase.from("flow_message_log").insert({
            workflow_id: workflowId,
            session_id: sessionId,
            node_id: node.id,
            direction: "outbound",
            message_type: "llm_response",
            content: response,
          });
          return { nextNodeId: node.id, updatedVars, status: "active" };
        }

        // Handle delay — NOT using step.sleep here since we're inside step.run
        // For Phase 1, delays in the Inngest path still use the old delayed_jobs table
        // TODO: Move delay handling outside step.run to use step.sleep
        if (node.type === "delay") {
          const delayMinutes = node.data.delayMinutes || 5;
          const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
          await supabase.from("flow_delayed_jobs").insert({
            session_id: sessionId,
            node_id: node.id,
            execute_at: executeAt,
          });
          const next = findNextNode(flow, node.id);
          return { nextNodeId: next?.id || null, updatedVars, status: "active" };
        }

        const execResult = await executeNode(node, customerId, phone, updatedVars, flow, sessionId, workflowId);

        if (execResult.waitForInput) {
          nextNodeId = execResult.nextNodeId;
          break;
        }
        nextNodeId = execResult.nextNodeId;
        if (!nextNodeId) break;
      }

      const status = nextNodeId ? "active" : "completed";
      return { nextNodeId, updatedVars, status };
    });

    // Step 6: Update session state
    await step.run("update-session", async () => {
      await supabase.from("subscriber_sessions").update({
        current_node_id: result.nextNodeId,
        variables: result.updatedVars,
        status: result.status || (result.nextNodeId ? "active" : "completed"),
        last_message_at: new Date().toISOString(),
      }).eq("id", sessionId);
    });

    return {
      action: "flow_executed",
      nodeId: result.nextNodeId,
      status: result.status,
    };
  },
);

// ── Serve Inngest functions ─────────────────────────────────
Deno.serve(
  serve({
    client: inngest,
    functions: [processMessage],
    servePath: "/functions/v1/inngest",
    signingKey: Deno.env.get("INNGEST_SIGNING_KEY"),
  })
);
