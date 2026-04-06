/**
 * Shared LLM Engine — single source of truth for all LLM calls.
 * Used by: flow-webhook, flow-demo, bot-demo, inngest
 */

// deno-lint-ignore-file no-explicit-any

import { embedText } from "./embeddings.ts";

export interface LLMConfig {
  systemPromptOverride?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  includeProducts?: boolean;
  includeFaqs?: boolean;
  includeScrapedContent?: boolean;
  includeRag?: boolean;
}

export interface LLMResult {
  response: string;
  model: string;
  conversationStage?: "engaging" | "closed";
}

// ── Trigger classifier ──────────────────────────────────────

export interface TriggerInfo {
  id: string;
  trigger: string;
}

/**
 * Use LLM to semantically match a user message against available triggers.
 * Returns the matched start-node ID, or null if nothing matches.
 */
export async function classifyTrigger(
  triggers: TriggerInfo[],
  message: string,
): Promise<string | null> {
  if (triggers.length === 0) return null;

  // Quick exact match — skip LLM call
  const exactMatch = triggers.find(
    (t) => t.trigger.trim().toLowerCase() === message.trim().toLowerCase()
  );
  if (exactMatch) return exactMatch.id;

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) return null;

  const triggersJson = JSON.stringify(
    triggers.map((t) => ({ id: t.id, phrase: t.trigger })),
  );

  const systemPrompt = `You are a message classifier for a WhatsApp chatbot. Given a list of trigger phrases and a user message, determine if the user's intent semantically matches any trigger.
Consider: synonyms, related phrases, different languages expressing the same intent, casual variations, typos, and slang. A greeting like "hi" matches a trigger phrase "hello". A question about "how much" matches "pricing".
ONLY match when the intent is clearly related. Do not force a match.

Triggers: ${triggersJson}

Respond with ONLY valid JSON, nothing else.
If the message matches a trigger: {"match":"<id>"}
If no trigger matches: {"match":null}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 50,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      console.error("[classifyTrigger] API error:", res.status);
      return null;
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    // Strip markdown code fences if LLM wraps the JSON
    const cleanText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    console.log("[classifyTrigger]", { message, rawText: text, cleanText });

    const parsed = JSON.parse(cleanText);
    const matchedId = parsed?.match;
    if (!matchedId || typeof matchedId !== "string") return null;

    // Case-insensitive verify against trigger IDs
    const lower = matchedId.toLowerCase();
    const found = triggers.find((t) => t.id.toLowerCase() === lower);
    if (found) return found.id;
    return null;
  } catch (err) {
    console.error("[classifyTrigger] parse error:", err);
    return null;
  }
}

/**
 * Call the LLM with full knowledge context.
 *
 * @param supabase - Supabase client instance
 * @param userId - The business owner's user ID
 * @param userMessage - The end user's message
 * @param conversationHistory - Prior messages in {role, content} format
 * @param config - Optional LLM configuration overrides
 * @param triggerContext - Optional trigger context string (legacy, prefer workflowRecord)
 * @param useDraft - If true, prefer draft_bot_prompt over bot_prompt (for previews)
 * @param workflowRecord - Optional pre-generated workflow summary (replaces triggerContext)
 * @param classifyStage - If true, ask the LLM to classify conversation stage (engaging/closed)
 */
export async function callLLMEngine(
  supabase: any,
  userId: string,
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  config?: LLMConfig,
  triggerContext?: string,
  useDraft?: boolean,
  workflowRecord?: string,
  classifyStage?: boolean,
): Promise<LLMResult> {
  // 1. Fetch bot prompt and scraped content
  const selectFields = useDraft
    ? "bot_prompt, draft_bot_prompt, business_name, scraped_content"
    : "bot_prompt, business_name, scraped_content";

  const { data: formRow } = await supabase
    .from("form_responses")
    .select(selectFields)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Determine base prompt
  let basePrompt: string;
  if (config?.systemPromptOverride) {
    basePrompt = config.systemPromptOverride;
  } else if (useDraft) {
    basePrompt =
      formRow?.draft_bot_prompt ||
      formRow?.bot_prompt ||
      `אתה בעל עסק בשם ${formRow?.business_name || "העסק"}. דבר בגוף ראשון, בצורה טבעית ואנושית כמו בוואטסאפ.`;
  } else {
    basePrompt =
      formRow?.bot_prompt ||
      `אתה בעל עסק בשם ${formRow?.business_name || "העסק"}. דבר בגוף ראשון, בצורה טבעית ואנושית כמו בוואטסאפ.`;
  }

  // 2. Scraped content (conditional)
  let scrapedContext = "";
  if (config?.includeScrapedContent !== false && formRow?.scraped_content) {
    scrapedContext = `\n\nמידע מהאתר שלך (השתמש במידע הזה כשרלוונטי לשאלה):\n${(formRow.scraped_content as string).substring(0, 8000)}`;
  }

  // 3. Products (conditional)
  let productContext = "";
  if (config?.includeProducts !== false) {
    try {
      const { data: products } = await supabase.rpc("search_products", {
        p_user_id: userId,
        p_query: userMessage,
        p_limit: 5,
      });
      if (products && products.length > 0) {
        const productLines = products.map(
          (p: any, i: number) => {
            const parts = [`${i + 1}. ${p.name}`];
            if (p.description) parts.push(p.description);
            if (p.price) parts.push(`מחיר: ${p.price}`);
            if (p.product_url) parts.push(`קישור: ${p.product_url}`);
            if (p.image_urls && p.image_urls.length > 0)
              parts.push(`תמונה: ${p.image_urls[0]}`);
            return parts.join(" - ");
          },
        );
        productContext =
          `\n\nמוצרים/שירותים רלוונטיים:\n${productLines.join("\n")}`;
      }
    } catch { /* Products not available */ }
  }

  // 4. FAQs (conditional)
  let faqContext = "";
  if (config?.includeFaqs !== false) {
    try {
      const { data: faqs } = await supabase
        .from("faq_entries")
        .select("question, answer")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (faqs && faqs.length > 0) {
        const faqLines = faqs.map(
          (f: { question: string; answer: string }) =>
            `שאלה: ${f.question}\nתשובה: ${f.answer}`,
        );
        faqContext =
          `\n\nשאלות ותשובות נפוצות (עדיפות גבוהה — אם הלקוח שואל שאלה דומה, ענה בדיוק לפי התשובה כאן):\n${faqLines.join("\n\n")}`;
      }
    } catch { /* FAQ not available */ }
  }

  // 5. RAG context (conditional — user-uploaded document chunks)
  let ragContext = "";
  if (config?.includeRag !== false) {
    try {
      const queryEmbedding = await embedText(userMessage);
      if (queryEmbedding) {
        const { data: matchedChunks } = await supabase.rpc(
          "match_document_chunks",
          {
            p_user_id: userId,
            p_embedding: JSON.stringify(queryEmbedding),
            p_match_count: 5,
            p_match_threshold: 0.3,
          },
        );
        if (matchedChunks && matchedChunks.length > 0) {
          const sorted = [...matchedChunks].sort(
            (a: { chunk_index: number }, b: { chunk_index: number }) =>
              a.chunk_index - b.chunk_index,
          );
          ragContext =
            `\n\nמידע נוסף מהמסמך שהועלה:\n${sorted.map((c: { content: string }) => c.content).join("\n\n")}`;
        }
      }
    } catch { /* RAG failure must not break existing functionality */ }
  }

  // 6. Build system prompt
  const flowContext = workflowRecord
    ? `\n\n${workflowRecord}`
    : (triggerContext || "");
  const systemPrompt = basePrompt +
    scrapedContext +
    productContext +
    faqContext +
    ragContext +
    flowContext +
    `\n\nהנחיות קריטיות לסגנון התשובה:
- אתה בעל העסק, לא בוט. דבר בגוף ראשון: "אצלי", "אני", "שלי"
- כתוב בצורה טבעית, קצרה וחמה
- תשובות קצרות וממוקדות! מקסימום 3-4 שורות לכל הודעה
- אל תכתוב פסקאות ארוכות, אל תעשה רשימות מפורטות
- אל תשתמש במילים: "בוט", "מערכת", "שירות לקוחות", "אוטומטי"
- תגיב כמו בשיחת וואטסאפ אמיתית בין שני אנשים
- אל תשתמש באימוג'ים בשום מקרה, אלא אם הפרומפט למעלה מציין במפורש להשתמש באימוג'ים. ברירת המחדל היא ללא אימוג'ים

הנחיות קריטיות למידע:
- השתמש אך ורק במידע שסופק לך למעלה (פרומפט, מוצרים, שאלות נפוצות, תוכן מהאתר)
- אל תמציא מוצרים, מחירים, שירותים, או פרטים שלא מופיעים בהקשר
- אם אין לך מידע על משהו שהלקוח שואל, אמור בצורה טבעית שתבדוק ותחזור אליו` +
    (classifyStage
      ? `\n\nAfter your response, on a NEW line, output exactly one of these tags (the user will NOT see this):
<!-- stage:engaging --> if the conversation is still active and the customer hasn't been fully helped yet
<!-- stage:closed --> if the customer's needs have been fully addressed, they said goodbye, or the conversation reached a natural conclusion`
      : "");

  // 7. Build messages array
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  // 8. Call OpenRouter
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    return { response: "איך אפשר לעזור?", model: "none" };
  }

  const primaryModel = config?.model || "google/gemini-2.5-pro-preview";
  const fallbackModel = primaryModel === "google/gemini-2.5-pro-preview"
    ? "google/gemini-2.5-flash-preview"
    : "google/gemini-2.5-pro-preview";
  const temperature = config?.temperature ?? 0.4;
  const maxTokens = config?.maxTokens ?? 2048;

  // Try primary model
  let botResponse = "";
  let usedModel = primaryModel;
  let primaryOk = false;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: primaryModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        botResponse = text;
        primaryOk = true;
      }
    }
  } catch { /* primary model failed */ }

  // Fallback model
  if (!primaryOk) {
    usedModel = fallbackModel;
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({
          model: fallbackModel,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          botResponse = text;
        }
      }
    } catch { /* fallback also failed */ }
  }

  if (!botResponse) {
    botResponse = "איך אפשר לעזור?";
    usedModel = "none";
  }

  // Parse conversation stage tag if classifyStage was requested
  let conversationStage: "engaging" | "closed" | undefined;
  if (classifyStage && botResponse) {
    const stageMatch = botResponse.match(/<!--\s*stage:(engaging|closed)\s*-->/);
    if (stageMatch) {
      conversationStage = stageMatch[1] as "engaging" | "closed";
      botResponse = botResponse.replace(/\s*<!--\s*stage:(engaging|closed)\s*-->/, "").trim();
    }
  }

  return { response: botResponse, model: usedModel, conversationStage };
}

// ── Collect-input validator ──────────────────────────────────

/**
 * Validate a user's response against the expected answer description.
 * Returns "valid", "invalid", or "refused" (user explicitly declines to answer).
 */
export async function validateCollectInput(
  question: string,
  expectedAnswer: string,
  userResponse: string,
  outputFormat?: string,
  variables?: Record<string, string>,
): Promise<{ result: "valid" | "invalid" | "refused"; formatted?: string }> {
  if (!expectedAnswer.trim()) return { result: "valid" };

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) return { result: "valid" }; // fail open if no API key

  const todayISO = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const isDateFormat = outputFormat && /YYYY|MM|DD/i.test(outputFormat);
  const dateInstruction = isDateFormat
    ? `\nDate-specific rules (today is ${todayISO}, current year: ${currentYear}):
- Users may write dates in ANY format: DD/MM/YY, YY/MM/DD, MM/DD/YY, DD-MM-YYYY, DD.MM.YY, "March 26", etc.
- For 2-digit years, assume 2000s (e.g., "25" → 2025, "26" → 2026).
- The formatted date MUST be a valid calendar date (month 1-12, day 1-31).
- CRITICAL: This is for hotel booking dates which are ALWAYS in the future. The result MUST be a future date (after ${todayISO}). If one interpretation gives a past date and another gives a future date, you MUST pick the future date.
- Try all valid interpretations (DD/MM/YY, YY/MM/DD, MM/DD/YY) and pick the one that gives a valid future date.
- Handle RELATIVE dates: "today" → ${todayISO}, "tomorrow" → tomorrow's date, "next week" / "another week" / "in a week" → +7 days, "3 days" / "for 3 days" / "another 3 days" → +3 days. If prior context has a relevant date (e.g., check-in date), calculate relative to that date. Otherwise, calculate relative to today.
- Example: "26/03/24" today being ${todayISO}:
  - DD/MM/YY → 2024-03-26 (PAST — reject)
  - YY/MM/DD → 2026-03-24 (FUTURE — use this!)
  - Result: {"result":"valid","formatted":"2026-03-24"}
- Output format: "${outputFormat}"`
    : "";
  const variablesContext = variables && Object.keys(variables).length > 0
    ? `\nPreviously collected information in this conversation:\n${JSON.stringify(variables)}\nUse this context to resolve relative references (e.g., "another week" relative to a previously collected date, "for 3 days" means check-in + 3 days).`
    : "";

  const systemPrompt = `You validate user responses in a WhatsApp chatbot.
The bot asked the customer: "${question}"
The expected type of answer is: "${expectedAnswer}"
The customer responded: "${userResponse}"

Determine if the customer's response is:
1. A valid answer matching the expected type → {"result":"valid"}
2. An explicit refusal to answer (e.g., "I don't want to share", "skip", "pass", "לא רוצה", "אני מעדיף לא", "no thanks") → {"result":"refused"}
3. An unrelated or invalid response that doesn't match the expected type → {"result":"invalid"}

Be lenient with valid answers — accept reasonable variations, different formats, and different languages.
For example: if expecting "a name", accept "John", "מיכאל", "sarah cohen" etc.
If expecting "phone number", accept "0501234567", "050-123-4567", "+972501234567" etc.

IMPORTANT: If the response is valid, ALWAYS try to extract a clean, normalized value and include it in a "formatted" field in your JSON response.
Normalization rules by expected type:
- Number / count / quantity (e.g., "number of guests"): extract the numeric value. "couple" or "זוג" → "2", "single" or "יחיד" → "1", "family of 4" or "משפחה של 4" → "4", "שלושה" → "3", "3 adults and 2 kids" → "5".
- Phone number: normalize to digits with country code if possible.
- Email: lowercase and trim whitespace.
- Name: trim whitespace, keep as-is.
${outputFormat && !isDateFormat ? `- The user specified output format: "${outputFormat}". Try to convert to this format.` : ""}
If you cannot normalize meaningfully, omit the "formatted" field.
${dateInstruction}${variablesContext}
Respond with ONLY valid JSON.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userResponse },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      console.error("[validateCollectInput] API error:", res.status);
      return { result: "valid" }; // fail open
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { result: "valid" };

    const cleanText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    console.log("[validateCollectInput]", { question, expectedAnswer, userResponse, outputFormat, result: cleanText });

    const parsed = JSON.parse(cleanText);
    if (parsed?.result === "refused") return { result: "refused" };
    if (parsed?.result === "valid") return { result: "valid", formatted: parsed.formatted || undefined };
    // Legacy format support ({"valid":true/false})
    if (parsed?.valid === true) return { result: "valid" };
    return { result: "invalid" };
  } catch (err) {
    console.error("[validateCollectInput] error:", err);
    return { result: "valid" }; // fail open
  }
}

/**
 * Detect if a user message is a refusal to answer/participate.
 * Used for text nodes with expectedReply + allowSkip.
 */
export async function detectRefusal(userMessage: string): Promise<boolean> {
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) return false;

  const systemPrompt = `You determine if a customer's WhatsApp message is an explicit refusal to answer or participate.
Refusal examples: "I don't want to answer", "skip", "pass", "לא רוצה", "לא מעוניין", "אני מעדיף לא", "no thanks", "rather not", "not interested".
NOT a refusal: random text, questions, unrelated messages, wrong answers.

Customer message: "${userMessage}"

Respond with ONLY valid JSON: {"refused":true} or {"refused":false}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 20,
        temperature: 0,
      }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return false;

    const cleanText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    console.log("[detectRefusal]", { userMessage, result: cleanText });

    const parsed = JSON.parse(cleanText);
    return parsed?.refused === true;
  } catch (err) {
    console.error("[detectRefusal] error:", err);
    return false;
  }
}

// ── Message translation ──────────────────────────────────────

/**
 * Translate a message from one language to another using LLM.
 * Returns original text on failure (fail-graceful).
 */
export async function translateMessage(
  text: string,
  fromLang: string,
  toLang: string,
): Promise<string> {
  if (!text.trim() || fromLang.toLowerCase() === toLang.toLowerCase()) return text;

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) return text;

  const systemPrompt = `You are a translator. Translate the following message from ${fromLang} to ${toLang}.
Return ONLY the translated text, nothing else. Preserve formatting, line breaks, and any special characters like {{variableName}} placeholders.
Do not add explanations, notes, or extra text.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 1024,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      console.error("[translateMessage] API error:", res.status);
      return text;
    }

    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim();
    if (!translated) return text;

    console.log("[translateMessage]", { fromLang, toLang, original: text.substring(0, 50), translated: translated.substring(0, 50) });
    return translated;
  } catch (err) {
    console.error("[translateMessage] error:", err);
    return text;
  }
}

/**
 * Translate an array of button labels in a single LLM call.
 * Returns original labels on failure.
 */
export async function translateButtonLabels(
  labels: string[],
  fromLang: string,
  toLang: string,
): Promise<string[]> {
  if (labels.length === 0 || fromLang.toLowerCase() === toLang.toLowerCase()) return labels;

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) return labels;

  const systemPrompt = `Translate each label from ${fromLang} to ${toLang}.
Input: a JSON array of strings.
Output: a JSON array of translated strings in the SAME order. Return ONLY the JSON array, nothing else.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(labels) },
        ],
        max_tokens: 256,
        temperature: 0,
      }),
    });

    if (!res.ok) {
      console.error("[translateButtonLabels] API error:", res.status);
      return labels;
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return labels;

    const cleanText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    console.log("[translateButtonLabels]", { fromLang, toLang, original: labels, translated: cleanText });

    const parsed = JSON.parse(cleanText);
    if (Array.isArray(parsed) && parsed.length === labels.length) return parsed;
    return labels;
  } catch (err) {
    console.error("[translateButtonLabels] error:", err);
    return labels;
  }
}

// ── API response formatter ───────────────────────────────────

/**
 * Format raw API response JSON into a clean, human-readable WhatsApp message.
 * Falls back to raw JSON string on failure.
 */
export async function formatApiResponse(
  rawJson: string,
  variableName: string,
): Promise<string> {
  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) return rawJson;

  const systemPrompt = `You format API response data into clean, readable WhatsApp messages.

Given raw JSON data from an API response stored in variable "${variableName}", format it into a concise, visually structured message.

Rules:
- Use emojis for visual structure (✅, 📅, 👥, 🏡, 💰, etc.)
- Show only the most important details (names, dates, prices, quantities, status)
- Keep it concise — this will be sent as a WhatsApp message
- Use line breaks for readability
- Format prices with currency symbols
- Format dates in DD/MM/YYYY format
- If the data is an array, summarize the best/first match
- Output ONLY the formatted text, no explanations or markdown code fences
- Do NOT wrap in quotes`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: rawJson },
        ],
        max_tokens: 512,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      console.error("[formatApiResponse] API error:", res.status);
      return rawJson;
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return rawJson;

    console.log("[formatApiResponse]", { variableName, formatted: text.substring(0, 100) });
    return text;
  } catch (err) {
    console.error("[formatApiResponse] error:", err);
    return rawJson;
  }
}

// ── Follow-up message generator ──────────────────────────────

/**
 * Generate a contextual follow-up re-engagement message using the LLM.
 * Called by the background job executor when a customer stops replying.
 */
export async function generateFollowUpMessage(
  supabase: any,
  userId: string,
  conversationHistory: { role: string; content: string }[],
  config?: Partial<LLMConfig>,
): Promise<string> {
  const followUpConfig: LLMConfig = {
    ...config,
    includeProducts: false,
    includeRag: false,
  };

  // Prepend follow-up instructions to conversationHistory so the LLM sees them as context
  const followUpInstruction = {
    role: "system",
    content: `הנחיות מיוחדות להודעת מעקב:
- הלקוח לא הגיב כבר תקופה. שלח הודעת מעקב אחת קצרה וטבעית.
- התייחס לנושא האחרון שדוברו עליו. אל תחזור על הודעות קודמות.
- משפט אחד עד שניים מקסימום. חם ולא דוחף.
- אל תגיד שאתה שולח "תזכורת" או "מעקב" — פשוט תמשיך את השיחה בטבעיות.`,
  };

  const result = await callLLMEngine(
    supabase,
    userId,
    "[SYSTEM: הלקוח הפסיק להגיב. צור הודעת מעקב קצרה וטבעית כדי להחזיר אותו לשיחה]",
    [...conversationHistory, followUpInstruction],
    followUpConfig,
  );

  return result.response;
}
