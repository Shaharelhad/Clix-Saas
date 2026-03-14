import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req, body);
    const { urls, form_fields, full_name } = body;

    if (!urls || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "urls are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Create scrape job record
    const { data: job, error: jobErr } = await supabase
      .from("scrape_jobs")
      .insert({
        user_id,
        base_url: urls[0],
        status: "scraping",
        total_pages: urls.length,
        scraped_pages: 0,
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      throw new Error("Failed to create scrape job: " + (jobErr?.message || "unknown"));
    }

    const scrapeJobId = job.id;

    // ── Scrape each URL with Firecrawl ────────────────────────
    const allScrapedContent: string[] = [];
    let scrapedCount = 0;

    for (const url of urls.slice(0, 5)) {
      try {
        let pageContent = "";

        if (FIRECRAWL_API_KEY) {
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
            pageContent = data.data?.markdown || "";
          }
        }

        // Fallback to basic scraping
        if (!pageContent) {
          try {
            const res = await fetch(url, {
              headers: { "User-Agent": "Mozilla/5.0 CLIX Bot Builder" },
            });
            if (res.ok) {
              const html = await res.text();
              pageContent = html
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
            }
          } catch { /* skip */ }
        }

        if (pageContent) {
          allScrapedContent.push(pageContent.substring(0, 10000));
          scrapedCount++;
          await supabase
            .from("scrape_jobs")
            .update({ scraped_pages: scrapedCount })
            .eq("id", scrapeJobId);
        }
      } catch (err) {
        console.error(`Error scraping ${url}:`, err);
      }
    }

    // ── Discover and scrape subpages ──────────────────────────
    if (FIRECRAWL_API_KEY && urls[0]) {
      try {
        const mapRes = await fetch("https://api.firecrawl.dev/v1/map", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
          },
          body: JSON.stringify({ url: urls[0], limit: 10 }),
        });

        if (mapRes.ok) {
          const mapData = await mapRes.json();
          const subPages: string[] = (mapData.links || [])
            .filter((link: string) => !urls.includes(link))
            .slice(0, 5);

          const totalPages = urls.length + subPages.length;
          await supabase
            .from("scrape_jobs")
            .update({ total_pages: totalPages })
            .eq("id", scrapeJobId);

          for (const subUrl of subPages) {
            try {
              const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
                },
                body: JSON.stringify({
                  url: subUrl,
                  formats: ["markdown"],
                  onlyMainContent: true,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                const content = data.data?.markdown || "";
                if (content.trim()) {
                  allScrapedContent.push(content.substring(0, 5000));
                  scrapedCount++;
                  await supabase
                    .from("scrape_jobs")
                    .update({ scraped_pages: scrapedCount })
                    .eq("id", scrapeJobId);
                }
              }
            } catch { /* skip subpage */ }
          }
        }
      } catch (err) {
        console.error("Map/crawl error (non-blocking):", err);
      }
    }

    // ── Combine all scraped content ───────────────────────────
    const fullScrapedContent = allScrapedContent.join("\n\n---\n\n");

    // ── Re-generate enhanced bot prompt with full website content ──
    if (fullScrapedContent.trim()) {
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (anthropicKey) {
        try {
          const { data: formRow } = await supabase
            .from("form_responses")
            .select("additional_info, business_name")
            .eq("user_id", user_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          const formData = formRow?.additional_info
            ? (typeof formRow.additional_info === "string"
                ? JSON.parse(formRow.additional_info)
                : formRow.additional_info)
            : (form_fields || {});

          const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-5-20250929",
              max_tokens: 4096,
              system: `אתה יוצר פרומפטים לבוטי וואטסאפ עבור עסקים. הפרומפט מגדיר איך הבוט מדבר עם לקוחות.

הבוט חייב להרגיש כמו בעל העסק עצמו מדבר.

מבנה הפרומפט:
1. פתיחה - "אתה [שם בעל העסק]..."
2. כללים לסגנון - גוף ראשון, משפטים קצרים
3. מידע מלא על העסק - שירותים, מוצרים, מחירים, שעות, פרטי קשר
4. דוגמאות לטון

כללים קריטיים:
- גוף ראשון: "אני", "אצלי", "שלי"
- שפה טבעית וחמה כמו וואטסאפ
- אסור להמציא מידע - רק מה שבטופס ובאתר
- אסור: "בוט", "מערכת", "אוטומטי", "עוזר דיגיטלי"
- כלול את כל המידע מהאתר: מוצרים, שירותים, מחירים, שעות, כתובת

חשוב: הפרומפט חייב לכלול את כל המידע העסקי מהאתר כדי שהבוט יוכל לענות על כל שאלה.

החזר רק טקסט פשוט.`,
              messages: [
                {
                  role: "user",
                  content: `Business form data:\n${JSON.stringify(formData, null, 2)}\n\nFull website content (all pages):\n${fullScrapedContent.substring(0, 30000)}`,
                },
              ],
            }),
          });

          if (anthropicRes.ok) {
            const anthropicData = await anthropicRes.json();
            const rawPrompt = anthropicData.content?.[0]?.text || "";
            const enhancedPrompt = rawPrompt.replace(/^```[\s\S]*?\n/, "").replace(/\n```\s*$/, "").trim();

            if (enhancedPrompt) {
              await supabase
                .from("form_responses")
                .update({
                  bot_prompt: enhancedPrompt,
                  scraped_content: fullScrapedContent.substring(0, 50000),
                })
                .eq("user_id", user_id);
            }
          }
        } catch (err) {
          console.error("Enhanced prompt generation error:", err);
        }
      }
    }

    // ── Mark job as completed ─────────────────────────────────
    await supabase
      .from("scrape_jobs")
      .update({
        status: "completed",
        scraped_pages: scrapedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scrapeJobId);

    return new Response(
      JSON.stringify({
        success: true,
        scrape_job_id: scrapeJobId,
        pages_scraped: scrapedCount,
        message: `Scraped ${scrapedCount} page(s) successfully`,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("scrape-trigger error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
