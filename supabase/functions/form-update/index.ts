import { corsHeaders } from "../_shared/cors.ts";
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
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
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
  } catch {
    // ignore
  }
  return "";
}

// ── Extract URLs from form fields ────────────────────────────
function extractUrls(fields: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const value of Object.values(fields || {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && (item as Record<string, unknown>).url) {
          urls.push(String((item as Record<string, unknown>).url));
        }
      }
    }
  }
  return urls;
}

// ── Extract URLs from stored additional_info ─────────────────
function extractOldUrls(additionalInfo: string | Record<string, unknown> | null): string[] {
  let parsed: Record<string, unknown> = {};
  if (typeof additionalInfo === "string") {
    try {
      parsed = JSON.parse(additionalInfo);
    } catch {
      return [];
    }
  } else if (additionalInfo && typeof additionalInfo === "object") {
    parsed = additionalInfo as Record<string, unknown>;
  }
  return extractUrls(parsed);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, full_name, fields } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch existing form_responses row
    const { data: existing, error: fetchErr } = await supabase
      .from("form_responses")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchErr || !existing) {
      return new Response(
        JSON.stringify({ error: "No existing form response found. Use form-submission for first-time submissions." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Extract new and old URLs to detect changes
    const newUrls = extractUrls(fields || {});
    const oldUrls = extractOldUrls(existing.additional_info);
    const oldWebsiteUrl = existing.website_url || "";

    const newUrlSet = new Set(newUrls);
    const oldUrlSet = new Set([...oldUrls, ...(oldWebsiteUrl ? [oldWebsiteUrl] : [])]);
    const urlsChanged =
      newUrlSet.size !== oldUrlSet.size ||
      [...newUrlSet].some((u) => !oldUrlSet.has(u));

    // 3. Scrape only if URLs changed, otherwise reuse existing scraped_content
    let scrapedContent = existing.scraped_content || "No website content available";

    if (urlsChanged && newUrls.length > 0) {
      const scrapeResults: string[] = [];
      for (const url of newUrls.slice(0, 3)) {
        const content = await scrapeWithFirecrawl(url);
        if (content) scrapeResults.push(`URL: ${url}\n\n${content}`);
      }
      if (scrapeResults.length > 0) {
        scrapedContent = scrapeResults.join("\n\n---\n\n");
      }
    }

    // 4. Extract business name from fields
    const fieldEntries = Object.entries(fields || {});
    const businessName =
      fieldEntries.find(([k]) => k.includes("עסק") || k.includes("שם"))?.[1] ||
      (typeof fieldEntries[0]?.[1] === "string"
        ? (fieldEntries[0][1] as string).substring(0, 50)
        : full_name);

    // 5. Regenerate bot prompt via OpenRouter/Claude (always — field content may have changed)
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
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        max_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
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
    const botPrompt = rawPrompt
      .replace(/^```[\s\S]*?\n/, "")
      .replace(/\n```\s*$/, "")
      .trim();

    // 6. Update existing form_responses row
    const { error: updateErr } = await supabase
      .from("form_responses")
      .update({
        business_name: businessName || "Business",
        business_description: full_name || "User submission",
        website_url: newUrls[0] || oldWebsiteUrl,
        additional_info: JSON.stringify(fields),
        bot_prompt: botPrompt,
        scraped_content: scrapedContent.substring(0, 50000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      throw new Error(`Failed to update form response: ${updateErr.message}`);
    }

    // 7. Trigger deep scraping only if URLs changed
    let scrapeJobId = null;
    if (urlsChanged && newUrls.length > 0) {
      try {
        const triggerRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/scrape-trigger`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              user_id,
              urls: newUrls,
              form_fields: fields,
              full_name,
            }),
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
        urls_changed: urlsChanged,
        message: "Form updated successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("form-update error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
