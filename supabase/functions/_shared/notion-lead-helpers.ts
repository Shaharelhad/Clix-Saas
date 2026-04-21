// deno-lint-ignore-file no-explicit-any
/**
 * Shared helpers for inline Notion lead lookup/create from flow-webhook.
 * Scoped to notion_ai_agent-based workflows. Safe to import from any edge function.
 */

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972") || digits.startsWith("639")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  if (/^5\d{8}$/.test(digits)) return "972" + digits;
  return digits;
}

export async function getNotionHeadersForNode(
  node: { data?: { agentIntegrationId?: string } },
  supabase: any,
): Promise<Record<string, string> | null> {
  const integrationId = node?.data?.agentIntegrationId;
  if (!integrationId) return null;
  const { data: intg } = await supabase
    .from("integrations")
    .select("config")
    .eq("id", integrationId)
    .single();
  const config = (intg?.config as Record<string, unknown>) || null;
  const apiKey = (config?.apiKey as string) || "";
  if (!apiKey) return null;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
  if (config?.customHeaders && typeof config.customHeaders === "object") {
    Object.assign(headers, config.customHeaders as Record<string, string>);
  }
  return headers;
}

type LookupOrCreateParams = {
  databaseId: string;
  normalizedPhone: string;
  pushName: string | null;
  notionHeaders: Record<string, string>;
};

export async function lookupOrCreateNotionLead(
  params: LookupOrCreateParams,
): Promise<{ pageId: string; isNew: boolean; botActivated: boolean }> {
  const { databaseId, normalizedPhone, pushName, notionHeaders } = params;

  // Step 1: query by מספר טלפון (phone_number) exact match.
  // We deliberately do NOT filter by the טלפון מנורמל formula column:
  // Notion's new Formula 2.0 properties can't be filtered via the API
  // (returns "Unable to filter based on a formula of unknown type").
  // Bot-created rows always write מספר טלפון in normalized 972XXXXXXXXX form,
  // so exact-match works for everything the bot creates.
  // Pre-existing rows (e.g. Optimo imports with mixed formats) need a
  // one-time normalization pass before prod cutover.
  const queryResp = await fetch(
    `https://api.notion.com/v1/databases/${databaseId}/query`,
    {
      method: "POST",
      headers: notionHeaders,
      body: JSON.stringify({
        filter: {
          property: "מספר טלפון",
          phone_number: { equals: normalizedPhone },
        },
      }),
    },
  );
  if (!queryResp.ok) {
    const errText = await queryResp.text();
    throw new Error(`Notion query failed ${queryResp.status}: ${errText.slice(0, 300)}`);
  }
  const queryData = await queryResp.json() as {
    results?: Array<{ id: string; properties?: Record<string, { checkbox?: boolean }> }>;
  };
  if (queryData.results && queryData.results.length > 0) {
    const hit = queryData.results[0];
    // מנוהל ע"י בוט — defaults to false if the property is missing (Optimo-legacy rows
    // predate the column). Callers use this flag to silence the bot on non-bot rows.
    const botActivated = hit.properties?.["מנוהל ע\"י בוט"]?.checkbox === true;
    return { pageId: hit.id, isNew: false, botActivated };
  }

  // Step 2: create new page — always tag as bot-managed so follow-up crons pick it up.
  const title = (pushName || "").trim();
  const createBody = {
    parent: { database_id: databaseId },
    properties: {
      "שם לקוח": {
        title: title ? [{ text: { content: title } }] : [],
      },
      "מספר טלפון": { phone_number: normalizedPhone },
      "סטטוס": { status: { name: "ליד חדש" } },
      "מקור הגעה": { select: { name: "אחר" } },
      "נשלח הודעה ראשונה": { checkbox: true },
      "מנוהל ע\"י בוט": { checkbox: true },
      "תאריך פולואפ": { date: { start: new Date().toISOString() } },
    },
  };
  const createResp = await fetch(`https://api.notion.com/v1/pages`, {
    method: "POST",
    headers: notionHeaders,
    body: JSON.stringify(createBody),
  });
  if (!createResp.ok) {
    const errText = await createResp.text();
    throw new Error(`Notion page create failed ${createResp.status}: ${errText.slice(0, 300)}`);
  }
  const newPage = await createResp.json() as { id: string };
  return { pageId: newPage.id, isNew: true, botActivated: true };
}
