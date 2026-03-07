import { supabase } from "@/services/supabase";

type WebhookResponse<T = unknown> = {
  data: T | null;
  error: string | null;
};

async function callWebhook<T = unknown>(
  envKey: string,
  payload: Record<string, unknown>,
): Promise<WebhookResponse<T>> {
  const url = import.meta.env[envKey] as string | undefined;

  if (!url) {
    return { data: null, error: `Webhook URL not configured: ${envKey}` };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Auto-detect Supabase Edge Function URLs and add auth headers
  if (url.includes(".supabase.co/functions/")) {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    if (anonKey) {
      headers["apikey"] = anonKey;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `Webhook error (${response.status}): ${errorText}` };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown webhook error";
    return { data: null, error: message };
  }
}

export function callFormSubmission(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_FORM_SUBMISSION", data);
}

export function callFormUpdate(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_FORM_UPDATE", data);
}

export function callBotDemo(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_BOT_DEMO", data);
}

export function callBotEditRequest(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_BOT_EDIT_REQUEST", data);
}

export function callBotEditApply(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_BOT_EDIT_APPLY", data);
}

export function callWClixAPIConnect(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_WCLIXAPI_CONNECT", data);
}

export function callSupportAI(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_SUPPORT_AI", data);
}

export function callScrapeStatus(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_SCRAPE_STATUS", data);
}

export function callScrapeTrigger(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_SCRAPE_TRIGGER", data);
}

export function callFlowDemo(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_FLOW_DEMO", data);
}

export function callIntegrationAdd(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_INTEGRATION_ADD", data);
}

export function callDeepScrape(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_DEEP_SCRAPE", data);
}
