import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

// ── Firecrawl scraper ────────────────────────────────────────
async function scrapeWithFirecrawl(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) {
    return scrapeBasic(url);
  }
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const markdown = data.data?.markdown || "";
      if (markdown.trim()) {
        return markdown.substring(0, 15000);
      }
    }
    return scrapeBasic(url);
  } catch {
    return scrapeBasic(url);
  }
}

async function scrapeBasic(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 CLIX Bot Builder" },
    });
    if (res.ok) {
      const html = await res.text();
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 5000);
    }
  } catch { /* skip */ }
  return "";
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req);
    const { full_name, fields } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Extract URLs from fields
    const urls: string[] = [];
    for (const value of Object.values(fields || {})) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object" && (item as Record<string, unknown>).url) {
            urls.push((item as Record<string, string>).url);
          }
        }
      }
    }

    // 2. Scrape websites using Firecrawl for high-quality content
    let scrapedContent = "No website content available";
    if (urls.length > 0) {
      const scrapeResults: string[] = [];
      for (const url of urls.slice(0, 3)) {
        const content = await scrapeWithFirecrawl(url);
        if (content) scrapeResults.push(`URL: ${url}\n\n${content}`);
      }
      if (scrapeResults.length > 0) {
        scrapedContent = scrapeResults.join("\n\n---\n\n");
      }
    }

    // 3. Extract business info from fields
    const fieldEntries = Object.entries(fields || {});
    const businessName =
      fieldEntries.find(([k]) => k.includes("עסק") || k.includes("שם"))?.[1] as string ||
      (typeof fieldEntries[0]?.[1] === "string" ? (fieldEntries[0][1] as string).substring(0, 50) : full_name);

    // 4. Call Claude via OpenRouter to generate bot prompt
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY is not set");

    const systemPrompt = `אתה יוצר פרומפטים לבוטי וואטסאפ עבור עסקים. הפרומפט שתיצור מגדיר איך הבוט מדבר עם לקוחות.

הבוט חייב להרגיש כמו בעל העסק עצמו מדבר - לא כמו בוט, לא כמו מערכת, לא כמו עוזר דיגיטלי.

מבנה הפרומפט שתיצור:

1. פתיחה - "אתה [שם בעל העסק]..." עם תיאור קצר
2. כללים לסגנון - גוף ראשון, משפטים קצרים, אסורים
3. מידע על העסק - שירותים, שעות, פרטי קשר (רק מה שמופיע בטופס ובאתר!)
4. דוגמאות לטון הנכון

כללים קריטיים לפרומפט:
- גוף ראשון תמיד: "אני", "אצלי", "שלי"
- שפה טבעית, חמה, אנושית - כמו וואטסאפ בין חברים
- משפטים קצרים. תגובות של 2-4 שורות מקסימום
- אימוג'ים טבעיים אבל לא מוגזם
- אסור להמציא מידע! השתמש רק במה שמופיע בטופס ובתוכן האתר
- אסור להמציא שירותים, מוצרים, או מחירים שלא צוינו
- אסור להשתמש במילים: "בוט", "מערכת", "אוטומטי", "עוזר דיגיטלי", "שירות לקוחות", "ברוכים הבאים"
- אם הטופס אומר אסור לתת מחיר - תכתוב את זה בכללים
- אם יש חוקים וגבולות בטופס - תכלול אותם

דוגמאות לטון הנכון:
"היי! מה קורה? אני [שם], נעים מאוד! ספר לי קצת על עצמך"
"אחי מעולה! בוא נדבר על זה"
"אצלי הכל אישי, אני בונה משהו שמתאים בדיוק לך"

דוגמאות לטון הלא נכון (ככה אסור!):
"שלום וברוכים הבאים! אני הבוט של [עסק]. אשמח לסייע לכם."
"להלן פירוט השירותים שלנו:"
"כעוזר הדיגיטלי של [עסק], אני כאן בשבילך"

החזר רק את טקסט הפרומפט כטקסט פשוט. בלי code blocks, בלי backticks.`;

    const openrouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: `Here is the business information submitted by the user:\n\n${JSON.stringify(fields, null, 2)}\n\nWebsite content scraped from their site:\n${scrapedContent}`,
          },
        ],
      }),
    });

    if (!openrouterRes.ok) {
      const errText = await openrouterRes.text();
      throw new Error(`OpenRouter API error (${openrouterRes.status}): ${errText}`);
    }

    const openrouterData = await openrouterRes.json();
    const rawPrompt = openrouterData.choices?.[0]?.message?.content || "";
    const botPrompt = rawPrompt.replace(/^```[\s\S]*?\n/, "").replace(/\n```\s*$/, "").trim();

    // 5. Save to form_responses
    const { error: saveErr } = await supabase
      .from("form_responses")
      .upsert(
        {
          user_id,
          business_name: businessName || "Business",
          business_description: full_name || "User submission",
          target_audience: "",
          tone: "",
          website_url: urls[0] || "",
          has_products: false,
          additional_info: JSON.stringify(fields),
          draft_bot_prompt: botPrompt,
          scraped_content: scrapedContent.substring(0, 50000),
          workflow_id: "",
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single();

    if (saveErr) {
      console.error("Save error:", saveErr);
      await supabase.from("form_responses").insert({
        user_id,
        business_name: businessName || "Business",
        business_description: full_name || "User submission",
        target_audience: "",
        tone: "",
        website_url: urls[0] || "",
        has_products: false,
        additional_info: JSON.stringify(fields),
        bot_prompt: botPrompt,
        scraped_content: scrapedContent.substring(0, 50000),
        workflow_id: "",
      });
    }

    // 6. Trigger deep scraping in background (fire-and-forget)
    let scrapeJobId: string | null = null;
    if (urls.length > 0) {
      try {
        const triggerRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/scrape-trigger`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ user_id, urls, form_fields: fields, full_name }),
          },
        );
        if (triggerRes.ok) {
          const triggerData = await triggerRes.json();
          scrapeJobId = triggerData.scrape_job_id || null;
        }
      } catch (scrapeErr) {
        console.error("Scrape trigger error (non-blocking):", scrapeErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        bot_prompt: botPrompt,
        scrape_job_id: scrapeJobId,
        message: "Bot created successfully",
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("form-submission error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
