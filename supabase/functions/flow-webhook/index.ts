import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// ── Flow Navigation Engine ──────────────────────────────────
function findStartNode(flow: FlowJSON): FlowNode | undefined {
  return flow.nodes.find((n) => n.type === "start");
}

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

function resolveVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || "");
}

// ── Open LLM Chat (used when no trigger matches) ────────────
async function callOpenLLM(
  userId: string,
  userMessage: string,
  sessionId: string,
  workflowId: string,
  customerId: string,
  phone: string
): Promise<void> {
  // Fetch bot prompt and scraped content
  const { data: formRow } = await supabase
    .from("form_responses")
    .select("bot_prompt, business_name, scraped_content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const basePrompt =
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

  // Fetch recent conversation history from message log
  const { data: history } = await supabase
    .from("flow_message_log")
    .select("direction, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(20);

  const systemPrompt = basePrompt + scrapedContext + productContext + faqContext + `\n\nהנחיות קריטיות לסגנון התשובה:
- אתה בעל העסק, לא בוט. דבר בגוף ראשון: "אצלי", "אני", "שלי"
- כתוב בצורה טבעית, קצרה וחמה
- תשובות קצרות וממוקדות! מקסימום 3-4 שורות לכל הודעה
- אל תכתוב פסקאות ארוכות, אל תעשה רשימות מפורטות
- אל תשתמש במילים: "בוט", "מערכת", "שירות לקוחות", "אוטומטי"
- תגיב כמו בשיחת וואטסאפ אמיתית בין שני אנשים
- אל תשתמש באימוג'ים בשום מקרה, אלא אם הפרומפט למעלה מציין במפורש להשתמש באימוג'ים. ברירת המחדל היא ללא אימוג'ים`;

  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];
  if (history) {
    for (const row of history) {
      messages.push({
        role: row.direction === "inbound" ? "user" : "assistant",
        content: row.content,
      });
    }
  }
  messages.push({ role: "user", content: userMessage });

  let botResponse = "";
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

  // Try Grok 4 Fast via OpenRouter
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

  // Fallback to Grok 4.1 Fast via OpenRouter
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

  if (!botResponse) {
    botResponse = "איך אפשר לעזור?";
  }

  // Send response via WClixAPI
  await sendTextMessage(customerId, phone, botResponse);

  // Log outbound message
  await supabase.from("flow_message_log").insert({
    workflow_id: workflowId,
    session_id: sessionId,
    node_id: null,
    direction: "outbound",
    message_type: "llm_response",
    content: botResponse,
  });
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

  if (node.type === "text") {
    const msg = resolveVariables(node.data.message || "", variables);
    await sendTextMessage(customerId, phone, msg);
    await logMessage(msg, "text");
    // continueAuto ON = wait for any response then continue
    // expectedReply set = wait for specific response
    // neither = send and immediately continue (chain mode)
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
    // Wait for user to click a button
    return { nextNodeId: node.id, waitForInput: true };
  }

  if (node.type === "collect_input") {
    const msg = resolveVariables(node.data.message || "", variables);
    await sendTextMessage(customerId, phone, msg);
    await logMessage(msg, "collect_input");
    // Wait for user reply
    return { nextNodeId: node.id, waitForInput: true };
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

    // Only process incoming messages from WClixAPI
    if (body.type !== "incoming") {
      return new Response(JSON.stringify({ ok: true, skipped: body.type || "unknown" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate using customerId + from + timestamp combo
    const dedupKey = `${body.customerId}:${body.from}:${body.timestamp}`;
    if (dedupKey && await isDuplicateDb(dedupKey)) {
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
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the user (bot owner) by customerId (= Supabase user UUID)
    let profile: { id: string; active_flow_id: string | null } | null = null;

    const { data } = await supabase
      .from("profiles")
      .select("id, active_flow_id")
      .eq("id", customerId)
      .single();
    profile = data;

    if (!profile) {
      return new Response(JSON.stringify({ ok: true, reason: "no_profile" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
        // Auto-create a default workflow for open LLM conversation
        const { data: newFlow } = await supabase
          .from("workflows")
          .insert({
            user_id: profile.id,
            name: "שיחה חופשית",
            flow_json: { nodes: [], edges: [] },
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
      return new Response(JSON.stringify({ ok: true, reason: "no_active_flow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the workflow
    const { data: workflow } = await supabase
      .from("workflows")
      .select("id, flow_json, status")
      .eq("id", activeFlowId)
      .single();

    if (!workflow || workflow.status !== "active") {
      return new Response(JSON.stringify({ ok: true, reason: "workflow_not_active" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const flow = workflow.flow_json as FlowJSON;

    // Find or create subscriber session
    const { data: sessions } = await supabase
      .from("subscriber_sessions")
      .select("*")
      .eq("workflow_id", workflow.id)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);

    let session = sessions?.[0] || null;

    if (!session) {
      const triggerStart = findStartNodeByTrigger(flow, userMessage);
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
        // No trigger match — use open LLM conversation
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
            await callOpenLLM(profile.id, userMessage, existingSession.id, workflow.id, customerId, phone);
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
          await callOpenLLM(profile.id, userMessage, newSession.id, workflow.id, customerId, phone);
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

    // ── Database-based dedup (in-memory map doesn't persist in serverless) ──
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

    // Log inbound message
    await supabase.from("flow_message_log").insert({
      workflow_id: workflow.id,
      session_id: session.id,
      node_id: session.current_node_id,
      direction: "inbound",
      message_type: "text",
      content: userMessage,
    });

    // Cancel any pending follow-ups — user responded
    await supabase
      .from("flow_delayed_jobs")
      .update({ status: "cancelled" })
      .eq("session_id", session.id)
      .eq("status", "pending");

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
      const triggerStartNode = findStartNodeByTrigger(flow, userMessage);
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
        // No trigger match on completed session — use open LLM conversation
        await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone);
        return new Response(JSON.stringify({ ok: true, action: "llm_response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If no current node, try trigger match or fall back to LLM
    if (!currentNodeId) {
      const startNode = findStartNodeByTrigger(flow, userMessage);
      if (startNode) {
        currentNodeId = startNode.id;
      } else {
        // No trigger match and no active flow — use LLM
        await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone);
        return new Response(JSON.stringify({ ok: true, action: "llm_response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    let nextNodeId: string | null = null;

    // Check if message matches a trigger — restart flow even if session is active
    // Allow trigger restart from ANY state so the user can always restart the flow
    if (messageMatchesAnyTrigger(flow, userMessage)) {
      const triggerNode = findStartNodeByTrigger(flow, userMessage);
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
          const result = await executeNode(node, customerId, phone, updatedVariables, flow, session.id, workflow.id);
          if (result.waitForInput) {
            nextNodeId = result.nextNodeId;
            break;
          }
          nextNodeId = result.nextNodeId;
          if (!nextNodeId) break;
        }

        const restartStatus = nextNodeId ? "active" : "completed";
        console.log("[flow] Trigger restart: updating session to:", nextNodeId, restartStatus);
        await updateSessionDirect(session.id, {
          current_node_id: nextNodeId,
          variables: updatedVariables,
          status: restartStatus,
          last_message_at: new Date().toISOString(),
        });

        return new Response(
          JSON.stringify({ ok: true, current_node: nextNodeId, status: restartStatus }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle user input for waiting nodes
    if (currentNode.type === "buttons") {
      const buttons = currentNode.data.buttons || [];
      const matched = matchButton(buttons, userMessage, buttonClickId);
      if (matched) {
        let nextNode = findNextNode(flow, currentNode.id, `btn-${matched.id}`);
        // If button leads to a follow_up, skip through to its next node
        if (nextNode?.type === "follow_up") {
          nextNode = findNextNode(flow, nextNode.id);
        }
        nextNodeId = nextNode?.id || null;
      } else {
        // Re-send buttons
        await sendButtonsMessage(customerId, phone, "לא הבנתי, בחר אפשרות:", buttons);
        // Stay on same node
        await supabase
          .from("subscriber_sessions")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", session.id);
        return new Response(JSON.stringify({ ok: true, action: "resent_buttons" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if ((currentNode.type === "text" || currentNode.type === "image") && (currentNode.data.continueAuto || currentNode.data.expectedReply)) {
      // Node is waiting for a response from the user
      if (currentNode.data.expectedReply) {
        // Check if user's message matches the expected reply
        const expected = currentNode.data.expectedReply.trim().toLowerCase();
        const userInput = userMessage.trim().toLowerCase();
        console.log("[flow] expectedReply check:", { expected, userInput, match: userInput === expected, nodeId: currentNode.id });
        if (userInput === expected) {
          const nextNode = findNextNode(flow, currentNode.id);
          console.log("[flow] expectedReply matched, nextNode:", nextNode?.id || "null", "edges from node:", flow.edges.filter(e => e.source === currentNode.id));
          nextNodeId = nextNode?.id || null;
        } else {
          // No match — open LLM conversation (stay on same node for flow)
          await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone);
          await supabase
            .from("subscriber_sessions")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", session.id);
          return new Response(JSON.stringify({ ok: true, action: "llm_response" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
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
      const varName = currentNode.data.variableName || "answer";
      updatedVariables[varName] = userMessage;
      const nextNode = findNextNode(flow, currentNode.id);
      nextNodeId = nextNode?.id || null;
    } else if (currentNode.type === "start") {
      // Start node: only advance if message matches this start node's trigger
      const hasTrigger = currentNode.data.triggerText?.trim();
      if (hasTrigger && triggerMatches(currentNode.data.triggerText!, userMessage)) {
        const nextNode = findNextNode(flow, currentNode.id);
        nextNodeId = nextNode?.id || null;
      } else {
        // Message does NOT match the trigger — fall back to LLM
        console.log("[flow] Start node trigger mismatch:", {
          trigger: currentNode.data.triggerText,
          message: userMessage,
        });
        await callOpenLLM(profile.id, userMessage, session.id, workflow.id, customerId, phone);
        await supabase
          .from("subscriber_sessions")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", session.id);
        return new Response(JSON.stringify({ ok: true, action: "llm_response" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
        // IMMEDIATELY update session when a node waits for input
        console.log("[flow] waitForInput: saving session to node:", nextNodeId, "sessionId:", session.id);

        // Debug: log before update
        await supabase.from("flow_message_log").insert({
          workflow_id: workflow.id,
          session_id: session.id,
          direction: "outbound",
          message_type: "debug",
          content: `DEBUG_BEFORE_UPDATE: nextNode=${nextNodeId} sessionId=${session.id}`,
        });

        // Try BOTH supabase client AND direct fetch
        const { error: clientErr } = await supabase
          .from("subscriber_sessions")
          .update({
            current_node_id: nextNodeId,
            variables: updatedVariables,
            status: "active",
            last_message_at: new Date().toISOString(),
          })
          .eq("id", session.id);

        if (clientErr) {
          console.error("[flow] Client update failed:", clientErr);
        }

        // Also try direct fetch as backup
        await updateSessionDirect(session.id, {
          current_node_id: nextNodeId,
          variables: updatedVariables,
          status: "active",
          last_message_at: new Date().toISOString(),
        });

        // Verify: read back
        const { data: verifySession } = await supabase
          .from("subscriber_sessions")
          .select("current_node_id")
          .eq("id", session.id)
          .single();

        // Debug: log after update with verification
        await supabase.from("flow_message_log").insert({
          workflow_id: workflow.id,
          session_id: session.id,
          direction: "outbound",
          message_type: "debug",
          content: `DEBUG_AFTER_UPDATE: wanted=${nextNodeId} got=${verifySession?.current_node_id} clientErr=${clientErr?.message || "none"}`,
        });

        break;
      }

      nextNodeId = result.nextNodeId;
      if (!nextNodeId) {
        // Flow completed
        break;
      }
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
