import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();
    const user_id = await getAuthenticatedUserId(req);
    const { edit_request, conversation_id } = body;

    if (!edit_request) {
      return new Response(
        JSON.stringify({ error: "edit_request is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const convId = conversation_id || crypto.randomUUID();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch the user's current bot prompt
    const { data: formRow, error: fetchErr } = await supabase
      .from("form_responses")
      .select("id, bot_prompt, draft_bot_prompt, business_name")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchErr || !formRow) {
      return new Response(
        JSON.stringify({
          proposed_changes: "לא נמצא בוט קיים למשתמש. יש למלא קודם את הטופס.",
          conversation_id: convId,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const currentPrompt = formRow.draft_bot_prompt || formRow.bot_prompt || "";

    // 2. Call OpenRouter (Claude Sonnet 4.5) to analyze and produce the updated prompt
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }

    const systemPrompt = `אתה CLIX, עוזר AI שעוזר למשתמשים לערוך ולשפר את הבוט שלהם בוואטסאפ.
כשמשתמש מבקש שינוי, אתה צריך:
1. להבין מה הוא רוצה לשנות
2. ליצור פרומפט מעודכן שמשלב את השינוי
3. להחזיר תשובה בפורמט JSON מדויק

החזר תמיד JSON תקין בפורמט הבא (ללא markdown, ללא backticks):
{"summary": "תקציר קצר של מה שינית בעברית", "updated_prompt": "הפרומפט המלא המעודכן"}

כללים חשובים לפרומפט המעודכן:
- הפרומפט המעודכן חייב לכלול את כל התוכן הקודם עם השינויים המבוקשים
- אל תמחק חלקים קיימים אלא אם המשתמש ביקש במפורש
- שמור על המבנה והפורמט של הפרומפט המקורי
- הבוט תמיד מדבר בגוף ראשון כאילו הוא בעל העסק עצמו, לא בוט
- השפה חייבת להישאר טבעית, אנושית, חמה - כמו בן אדם אמיתי בוואטסאפ
- לא להשתמש במילים כמו "בוט", "מערכת", "אוטומטי", "דיגיטלי"
- בסיכום תן תשובה ידידותית וברורה למשתמש`;

    const openrouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `הפרומפט הנוכחי של הבוט:\n\n${currentPrompt}\n\n---\nהמשתמש מבקש: "${edit_request}"`,
          },
        ],
      }),
    });

    if (!openrouterRes.ok) {
      const errText = await openrouterRes.text();
      throw new Error(`OpenRouter API error (${openrouterRes.status}): ${errText}`);
    }

    const openrouterData = await openrouterRes.json();
    const rawText = openrouterData.choices?.[0]?.message?.content || "";

    // 3. Parse the JSON response
    let summary: string;
    let updatedPrompt: string;

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
      summary = parsed.summary || "השינויים בוצעו.";
      updatedPrompt = parsed.updated_prompt || currentPrompt;
    } catch {
      summary = rawText;
      updatedPrompt = currentPrompt;
    }

    // 4. Update the bot_prompt in form_responses
    if (updatedPrompt !== currentPrompt) {
      await supabase
        .from("form_responses")
        .update({ draft_bot_prompt: updatedPrompt, updated_at: new Date().toISOString() })
        .eq("id", formRow.id);
    }

    // 5. Save edit history
    await supabase.from("bot_edit_history").insert({
      user_id,
      edit_request,
      proposed_changes: summary,
      status: "pending",
    });

    // 6. Return the summary to the user
    return new Response(
      JSON.stringify({
        proposed_changes: summary + "\n\nהשינויים נשמרו בהצלחה ✅",
        conversation_id: convId,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("bot-edit error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
