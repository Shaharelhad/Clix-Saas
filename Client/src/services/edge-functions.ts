import { supabase } from "@/services/supabase";

type EdgeFnResponse<T = unknown> = {
  data: T | null;
  error: string | null;
};

async function callEdgeFn<T = unknown>(
  envKey: string,
  payload: Record<string, unknown>,
): Promise<EdgeFnResponse<T>> {
  const url = import.meta.env[envKey] as string | undefined;

  if (!url) {
    return { data: null, error: `Edge function URL not configured: ${envKey}` };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add Supabase auth headers
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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `Edge function error (${response.status}): ${errorText}` };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown edge function error";
    return { data: null, error: message };
  }
}

export function callFormSubmission(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_FORM_SUBMISSION", data);
}

export function callFormUpdate(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_FORM_UPDATE", data);
}

export function callBotDemo(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_BOT_DEMO", data);
}

export function callBotEditRequest(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_BOT_EDIT_REQUEST", data);
}

export function callWClixAPIConnect(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_WCLIXAPI_CONNECT", data);
}

export function callScrapeStatus(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_SCRAPE_STATUS", data);
}

export function callFlowDemo(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_FLOW_DEMO", data);
}

export function callRagUpload(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_RAG_UPLOAD", data);
}

export function callRagDelete(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_RAG_DELETE", data);
}

export function callFlowAssistant(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_FLOW_ASSISTANT", data);
}

export function callTestIntegration(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_TEST_INTEGRATION", data);
}

export function callSheetsSync(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_SHEETS_SYNC", data);
}

export function callGatewayAdmin(data: Record<string, unknown>) {
  return callEdgeFn("VITE_EDGE_FN_GATEWAY_ADMIN", data);
}
