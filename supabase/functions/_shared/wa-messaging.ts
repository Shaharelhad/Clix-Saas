/**
 * Shared WhatsApp messaging functions via WClixAPI gateway.
 * Used by: flow-webhook, inngest
 */

const WA_GATEWAY_BASE = "https://wa.clixwapp.online";

function getApiKey(): string {
  return Deno.env.get("WA_GATEWAY_API_KEY")!;
}

export interface ButtonItem {
  id: string;
  label: string;
}

export async function sendTextMessage(
  customerId: string,
  to: string,
  text: string,
) {
  const url = `${WA_GATEWAY_BASE}/api/session/send/${customerId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
    },
    body: JSON.stringify({ to, message: text }),
  });
  return res.json();
}

export async function sendButtonsMessage(
  customerId: string,
  to: string,
  message: string,
  buttons: ButtonItem[],
  header?: string,
  footer?: string,
) {
  const url = `${WA_GATEWAY_BASE}/api/session/send-buttons/${customerId}`;
  const wclixButtons = buttons.slice(0, 10).map((b) => ({
    buttonId: b.id,
    buttonText: b.label.substring(0, 25),
  }));

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": getApiKey(),
      },
      body: JSON.stringify({
        to,
        body: message,
        buttons: wclixButtons,
        ...(header ? { header } : {}),
        ...(footer ? { footer } : {}),
      }),
    });
    if (res.ok) return res.json();
  } catch { /* interactive buttons failed, fall through to text fallback */ }

  // Fallback: send as numbered text list
  const parts: string[] = [];
  if (header) parts.push(header);
  parts.push(message);
  if (footer) parts.push(footer);
  const buttonText = buttons
    .map((b, i) => `${i + 1}. ${b.label}`)
    .join("\n");
  const fullMessage = `${parts.join("\n\n")}\n\n${buttonText}`;
  return sendTextMessage(customerId, to, fullMessage);
}

export async function sendImageMessage(
  customerId: string,
  to: string,
  imageUrl: string,
  caption: string,
) {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
    const imgBlob = await imgRes.blob();

    const formData = new FormData();
    formData.append("chatId", to);
    formData.append("file", imgBlob, "image.jpg");
    if (caption) formData.append("caption", caption);

    const url = `${WA_GATEWAY_BASE}/api/session/send-file/${customerId}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": getApiKey() },
      body: formData,
    });
    return res.json();
  } catch (err) {
    console.error("[wa] Image send failed, falling back to text:", err);
    const fallbackMsg = caption ? `${caption}\n${imageUrl}` : imageUrl;
    return sendTextMessage(customerId, to, fallbackMsg);
  }
}
