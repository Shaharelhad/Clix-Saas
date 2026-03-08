import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

  return { nextNodeId: null, waitForInput: false };
}

// ── LLM Fallback (same as bot-demo) ────────────────────────
async function callLLMFallback(
  userId: string,
  userMessage: string,
  conversationId: string
): Promise<string> {
  // Fetch bot prompt and scraped content
  const { data: formRow } = await supabase
    .from("form_responses")
    .select("bot_prompt, draft_bot_prompt, business_name, scraped_content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const basePrompt =
    formRow?.draft_bot_prompt ||
    formRow?.bot_prompt ||
    `אתה בעל עסק בשם ${formRow?.business_name || "העסק"}. דבר בגוף ראשון, בצורה טבעית ואנושית כמו בוואטסאפ.`;

  const scrapedContext = formRow?.scraped_content
    ? `\n\nמידע מהאתר שלך (השתמש במידע הזה כשרלוונטי לשאלה):\n${(formRow.scraped_content as string).substring(0, 8000)}`
    : "";

  // Search for relevant products
  let productContext = "";
  try {
    const { data: products } = await supabase.rpc("search_products", {
      p_user_id: userId,
      p_query: userMessage,
      p_limit: 5,
    });
    if (products && products.length > 0) {
      const productLines = products.map(
        (p: { name: string; description: string; price: string; product_url: string; image_urls: string[] }, i: number) => {
          const parts = [`${i + 1}. ${p.name}`];
          if (p.description) parts.push(p.description);
          if (p.price) parts.push(`מחיר: ${p.price}`);
          if (p.product_url) parts.push(`קישור: ${p.product_url}`);
          if (p.image_urls && p.image_urls.length > 0) parts.push(`תמונה: ${p.image_urls[0]}`);
          return parts.join(" - ");
        }
      );
      productContext = `\n\nמוצרים/שירותים רלוונטיים:\n${productLines.join("\n")}`;
    }
  } catch { /* Products not available */ }

  // Fetch FAQ entries
  let faqContext = "";
  try {
    const { data: faqs } = await supabase
      .from("faq_entries")
      .select("question, answer")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (faqs && faqs.length > 0) {
      const faqLines = faqs.map(
        (f: { question: string; answer: string }) => `שאלה: ${f.question}\nתשובה: ${f.answer}`
      );
      faqContext = `\n\nשאלות ותשובות נפוצות (עדיפות גבוהה — אם הלקוח שואל שאלה דומה, ענה בדיוק לפי התשובה כאן):\n${faqLines.join("\n\n")}`;
    }
  } catch { /* FAQ not available */ }

  const systemPrompt = basePrompt + scrapedContext + productContext + faqContext + `\n\nהנחיות קריטיות לסגנון התשובה:
- אתה בעל העסק, לא בוט. דבר בגוף ראשון: "אצלי", "אני", "שלי"
- כתוב בצורה טבעית, קצרה וחמה
- תשובות קצרות וממוקדות! מקסימום 3-4 שורות לכל הודעה
- אל תכתוב פסקאות ארוכות, אל תעשה רשימות מפורטות
- אל תשתמש במילים: "בוט", "מערכת", "שירות לקוחות", "אוטומטי"
- תגיב כמו בשיחת וואטסאפ אמיתית בין שני אנשים
- אל תשתמש באימוג'ים בשום מקרה, אלא אם הפרומפט למעלה מציין במפורש להשתמש באימוג'ים. ברירת המחדל היא ללא אימוג'ים`;

  // Fetch conversation history
  const { data: history } = await supabase
    .from("demo_conversations")
    .select("user_message, bot_response")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(10);

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];
  if (history) {
    for (const row of history) {
      messages.push({ role: "user", content: row.user_message });
      messages.push({ role: "assistant", content: row.bot_response });
    }
  }
  messages.push({ role: "user", content: userMessage });

  let botResponse = "";
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

  // Try Grok 4 Fast
  let primaryOk = false;
  if (openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({
          model: "x-ai/grok-4-fast",
          messages,
          max_tokens: 2048,
          temperature: 1.0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) { botResponse = text; primaryOk = true; }
      }
    } catch { /* Grok 4 Fast failed */ }
  }

  // Fallback to Grok 4.1 Fast
  if (!primaryOk && openrouterKey) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({
          model: "x-ai/grok-4.1-fast",
          messages,
          max_tokens: 2048,
          temperature: 1.0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) { botResponse = text; }
      }
    } catch { /* Grok 4.1 Fast also failed */ }
  }

  return botResponse || "איך אפשר לעזור?";
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
      // Empty flow — pure LLM fallback
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

    // If session completed or no current node, check for trigger match
    if (sessionStatus === "completed" || !currentNodeId) {
      const triggerNode = findStartNodeByTrigger(flow, message);
      if (triggerNode) {
        currentNodeId = triggerNode.id;
        variables = {};
        sessionStatus = "active";
      } else {
        // No trigger match — LLM fallback
        const botResponse = await callLLMFallback(user_id, message, convId);
        await supabase.from("demo_conversations").insert({
          user_id,
          conversation_id: convId,
          user_message: message,
          bot_response: botResponse,
        });
        return new Response(
          JSON.stringify({
            response: botResponse,
            conversation_id: convId,
            session_state: { current_node_id: currentNodeId, variables, status: sessionStatus },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
      const botResponse = await callLLMFallback(user_id, message, convId);
      await supabase.from("demo_conversations").insert({
        user_id,
        conversation_id: convId,
        user_message: message,
        bot_response: botResponse,
      });
      return new Response(
        JSON.stringify({
          response: botResponse,
          conversation_id: convId,
          session_state: { current_node_id: null, variables, status: "completed" },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
          const botResponse = await callLLMFallback(user_id, message, convId);
          await supabase.from("demo_conversations").insert({
            user_id,
            conversation_id: convId,
            user_message: message,
            bot_response: botResponse,
          });
          return new Response(
            JSON.stringify({
              response: botResponse,
              conversation_id: convId,
              session_state: { current_node_id: currentNodeId, variables, status: "active" },
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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
        // No trigger match — LLM fallback
        const botResponse = await callLLMFallback(user_id, message, convId);
        await supabase.from("demo_conversations").insert({
          user_id,
          conversation_id: convId,
          user_message: message,
          bot_response: botResponse,
        });
        return new Response(
          JSON.stringify({
            response: botResponse,
            conversation_id: convId,
            session_state: { current_node_id: currentNodeId, variables, status: "active" },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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

      const result = executeNodeDemo(node, variables, flow, responses);
      if (result.waitForInput) {
        nextNodeId = result.nextNodeId;
        break;
      }
      nextNodeId = result.nextNodeId;
      if (!nextNodeId) break;
    }

    // If flow executed but produced no responses (e.g., disconnected nodes), fallback to LLM
    if (responses.length === 0) {
      const botResponse = await callLLMFallback(user_id, message, convId);
      await supabase.from("demo_conversations").insert({
        user_id,
        conversation_id: convId,
        user_message: message,
        bot_response: botResponse,
      });
      return new Response(
        JSON.stringify({
          response: botResponse,
          conversation_id: convId,
          session_state: { current_node_id: null, variables, status: "completed" },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
