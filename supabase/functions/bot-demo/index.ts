import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, message, conversation_id } = await req.json();

    if (!user_id || !message) {
      return new Response(
        JSON.stringify({ error: "user_id and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const convId = conversation_id || crypto.randomUUID();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch bot_prompt and scraped content from the latest form_responses
    const { data: formRow } = await supabase
      .from("form_responses")
      .select("bot_prompt, business_name, scraped_content")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const basePrompt =
      formRow?.bot_prompt ||
      `אתה בעל עסק בשם ${formRow?.business_name || "העסק"}. דבר בגוף ראשון, בצורה טבעית ואנושית כמו בוואטסאפ.`;

    // Include scraped website content as knowledge base
    const scrapedContext = formRow?.scraped_content
      ? `\n\nמידע מהאתר שלך (השתמש במידע הזה כשרלוונטי לשאלה):\n${formRow.scraped_content.substring(0, 8000)}`
      : "";

    // Search for relevant products based on the user's message
    let productContext = "";
    try {
      const { data: products } = await supabase.rpc("search_products", {
        p_user_id: user_id,
        p_query: message,
        p_limit: 5,
      });
      if (products && products.length > 0) {
        const productLines = products.map((p: Record<string, unknown>, i: number) => {
          const parts = [`${i + 1}. ${p.name}`];
          if (p.description) parts.push(p.description as string);
          if (p.price) parts.push(`מחיר: ${p.price}`);
          if (p.product_url) parts.push(`קישור: ${p.product_url}`);
          if (p.image_urls && (p.image_urls as string[]).length > 0) parts.push(`תמונה: ${(p.image_urls as string[])[0]}`);
          return parts.join(" - ");
        });
        productContext = `\n\nמוצרים/שירותים רלוונטיים שנמצאו באתר שלך (השתמש במידע הזה כשרלוונטי):\n${productLines.join("\n")}`;
      }
    } catch {
      // Products not available yet, continue without them
    }

    // Fetch FAQ entries
    let faqContext = "";
    try {
      const { data: faqs } = await supabase
        .from("faq_entries")
        .select("question, answer")
        .eq("user_id", user_id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (faqs && faqs.length > 0) {
        const faqLines = faqs.map((f: Record<string, string>) => `שאלה: ${f.question}\nתשובה: ${f.answer}`);
        faqContext = `\n\nשאלות ותשובות נפוצות (עדיפות גבוהה — אם הלקוח שואל שאלה דומה, ענה בדיוק לפי התשובה כאן):\n${faqLines.join("\n\n")}`;
      }
    } catch { /* skip */ }

    const systemPrompt =
      basePrompt +
      scrapedContext +
      productContext +
      faqContext +
      `\n\nהנחיות קריטיות לסגנון התשובה:
- אתה בעל העסק, לא בוט. דבר בגוף ראשון: "אצלי", "אני", "שלי"
- כתוב בצורה טבעית, קצרה וחמה
- תשובות קצרות וממוקדות! מקסימום 3-4 שורות לכל הודעה
- אל תכתוב פסקאות ארוכות, אל תעשה רשימות מפורטות
- אל תשתמש במילים: "בוט", "מערכת", "שירות לקוחות", "אוטומטי"
- תגיב כמו בשיחת וואטסאפ אמיתית בין שני אנשים
- אל תשתמש באימוג'ים בשום מקרה, אלא אם הפרומפט למעלה מציין במפורש להשתמש באימוג'ים. ברירת המחדל היא ללא אימוג'ים`;

    // 2. Fetch last 10 conversation messages for context
    const { data: history } = await supabase
      .from("demo_conversations")
      .select("user_message, bot_response")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(10);

    // Build conversation history for OpenRouter (OpenAI-compatible format)
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (history) {
      for (const row of history) {
        messages.push({ role: "user", content: row.user_message });
        messages.push({ role: "assistant", content: row.bot_response });
      }
    }
    messages.push({ role: "user", content: message });

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    let botResponse = "";

    // 3. Try primary model (Grok 4 Fast), fallback to Grok 4.1 Fast
    let primaryOk = false;
    try {
      const primaryRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({
          model: "x-ai/grok-4-fast",
          max_tokens: 2048,
          temperature: 1.0,
          messages,
        }),
      });

      if (primaryRes.ok) {
        const data = await primaryRes.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          botResponse = text;
          primaryOk = true;
        }
      }
    } catch { /* fallback */ }

    // Fallback to Grok 4.1 Fast
    if (!primaryOk) {
      const fallbackRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({
          model: "x-ai/grok-4.1-fast",
          max_tokens: 2048,
          temperature: 1.0,
          messages,
        }),
      });

      if (!fallbackRes.ok) {
        const errText = await fallbackRes.text();
        throw new Error(`OpenRouter fallback API error (${fallbackRes.status}): ${errText}`);
      }

      const fallbackData = await fallbackRes.json();
      botResponse = fallbackData.choices?.[0]?.message?.content || "סורי, לא הצלחתי לענות. נסה שוב";
    }

    // 4. Save conversation turn
    await supabase.from("demo_conversations").insert({
      user_id,
      conversation_id: convId,
      user_message: message,
      bot_response: botResponse,
    });

    // 5. Return response
    return new Response(
      JSON.stringify({ response: botResponse, conversation_id: convId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bot-demo error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
