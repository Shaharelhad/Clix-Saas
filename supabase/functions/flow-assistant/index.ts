/**
 * flow-assistant — LLM-powered help assistant for the flow builder.
 * Answers user questions about node types, connections, settings, etc.
 */

import { getCorsHeaders } from "../_shared/cors.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";

const SYSTEM_PROMPT = `אתה עוזר חכם של בונה התהליכים (Flow Builder) במערכת CLIX — פלטפורמה לבניית בוטים לוואטסאפ.
תפקידך לענות על שאלות של משתמשים לגבי איך להשתמש בבונה התהליכים, מה כל צומת עושה, ואיך לבנות תהליכים אפקטיביים.

## כללי תשובה
- ענה ב-2-4 משפטים קצרים בלבד. אל תכתוב מדריכים ארוכים.
- אל תשתמש בכותרות (##), רשימות ממוספרות, או עיצוב מורכב.
- תן את המידע החיוני בלבד. אם המשתמש רוצה פירוט נוסף, הוא ישאל.
- ענה בעברית. אם המשתמש שואל באנגלית, ענה באנגלית.

## סוגי צמתים (Nodes)

1. **התחלה (Start)** — צומת ההתחלה של כל תהליך. אפשר להגדיר מילת טריגר (למשל "שלום", "מחיר") שמפעילה את התהליך כשלקוח שולח הודעה דומה. אם שדה הטריגר ריק, הצומת תופס כל הודעה שלא תואמת טריגר אחר (catch-all). התאמת הטריגר היא סמנטית — "היי" יתאים לטריגר "שלום".

2. **הודעת טקסט (Text)** — שולח הודעת טקסט ללקוח. אפשר להגדיר "תשובה מצופה" — אם הלקוח עונה משהו דומה סמנטית לתשובה המצופה, התהליך ממשיך הלאה. אם לא, הבוט יכול לחזור על השאלה.

3. **תמונה (Image)** — שולח תמונה ללקוח עם כיתוב אופציונלי. אפשר להעלות תמונה או להדביק URL.

4. **כפתורים (Buttons)** — מציג עד 10 כפתורים אינטראקטיביים ללקוח. הלקוח לוחץ על כפתור והתהליך ממשיך בהתאם. אפשר לחבר כל כפתור לנתיב שונה או להשאיר חיבור אחד לכל הכפתורים.

5. **השהייה (Delay)** — ממתין זמן מוגדר (1 עד 1440 דקות) לפני שממשיך לצומת הבא. שימושי להודעות מתוזמנות.

## חיבור צמתים
- גרור קו מנקודת החיבור (handle) של צומת אחד לצומת אחר כדי ליצור חיבור.
- כל צומת יכול להתחבר לצומת אחד או יותר.
- צומת כפתורים יכול לחבר כל כפתור לנתיב נפרד.
- למחוק חיבור: לחץ על הקו ולחץ Delete או Backspace.

## פרסום ומצב תהליך
- **טיוטה (Draft)**: תהליך חדש מתחיל כטיוטה. אפשר לערוך בחופשיות.
- **פעיל (Active/Live)**: לאחר פרסום, התהליך פעיל בוואטסאפ. בזמן שהוא פעיל, העריכה נעולה — צריך לבטל פרסום כדי לערוך.
- **מושהה (Paused)**: תהליך שבוטל פרסומו. אפשר לערוך ולפרסם מחדש.
- רק תהליך אחד יכול להיות פעיל בכל רגע. פרסום תהליך חדש משהה אוטומטית את הקודם.

## הגדרות תהליך
- **מצב קפדני (Strict Mode)**: הבוט עוקב רק אחרי שלבי התהליך ללא תשובות AI חופשיות.
- **מעקב אוטומטי (Auto Follow-Up)**: שולח הודעת מעקב אוטומטית אם הלקוח לא מגיב תוך זמן מוגדר.
- **זמן קולדאון (Cooldown)**: מונע שליחת הודעות חוזרות לאותו לקוח בתוך פרק זמן.
- **התעלם מקבוצות**: הבוט לא מגיב בקבוצות וואטסאפ.
- **איפוס סשן**: מגדיר כמה זמן עד שהשיחה מתאפסת ומתחילה מחדש.

## תבניות
בעת יצירת תהליך חדש, אפשר לבחור מתבנית מוכנה:
- **איסוף לידים** — שואל שם, טלפון ומייל
- **קביעת תור** — בחירת שירות ותיאום זמן
- **בירור מוצר** — בחירת קטגוריה ותקציב
- **ריק** — מתחיל מאפס עם צומת התחלה בלבד

## ריבוי תהליכים
- אפשר ליצור עד 5 תהליכים.
- אפשר לעבור בין תהליכים מהתפריט בסרגל הכלים.
- רק תהליך אחד פעיל בכל רגע.

## טיפים
- תמיד התחל עם צומת התחלה.
- השתמש בכפתורים כשאתה רוצה תשובות מובנות מהלקוח.
- שמור על תהליכים קצרים וממוקדים — עד 10-15 צמתים.
- בדוק את התהליך לפני פרסום.
- השתמש במצב קפדני אם אתה רוצה שהבוט יעקוב רק אחרי התהליך.`;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const body = await req.json();
    await getAuthenticatedUserId(req); // verify auth, user_id not needed for this function
    const { message, history } = body as {
      message?: string;
      history?: { role: string; content: string }[];
    };

    if (!message?.trim()) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      return new Response(
        JSON.stringify({ error: "LLM not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Build messages: system + last 10 history turns + current message
    const msgs: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (history && Array.isArray(history)) {
      const trimmed = history.slice(-10);
      for (const h of trimmed) {
        if (h.role === "user" || h.role === "assistant") {
          msgs.push({ role: h.role, content: h.content });
        }
      }
    }

    msgs.push({ role: "user", content: message.trim() });

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "x-ai/grok-4-fast",
        messages: msgs,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenRouter error:", res.status, errText);
      return new Response(
        JSON.stringify({ error: "LLM request failed" }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    const response = data.choices?.[0]?.message?.content?.trim() || "אין תשובה כרגע, נסה שוב.";

    return new Response(
      JSON.stringify({ response }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("flow-assistant error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Authorization") || message.includes("token") ? 401 : 500;
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
