# WClixAPI - Custom WhatsApp Gateway API Reference

> This replaces Green API. Use this reference when building or updating Supabase edge functions.

**Base URL:** `https://wa.clixwapp.online`

**Auth:** All `/api/*` endpoints require header: `x-api-key: <your-api-key>`

---

## Endpoints

### 1. Start Session (Get QR Code)

```
POST /api/session/start/:customerId
```

**Response (first time - needs QR scan):**
```json
{
  "status": "qr_generated",
  "qr": "data:image/png;base64,..."
}
```

**Response (already connected):**
```json
{
  "status": "already_connected"
}
```

---

### 2. Check Session Status

```
GET /api/session/status/:customerId
```

**Response:**
```json
{
  "status": "connected"
}
```

Possible statuses: `connected`, `connecting`, `qr_generated`, `not_found`

---

### 3. Send Text Message

```
POST /api/session/send/:customerId
Content-Type: application/json
```

**Body:**
```json
{
  "to": "63XXXXXXXXXX",
  "message": "Hello from our SaaS!"
}
```

**Response:**
```json
{
  "status": "sent"
}
```

> Note: `to` is just the phone number (no @s.whatsapp.net needed — the gateway adds it automatically).

---

### 4. Send Image/File

```
POST /api/session/send-file/:customerId
Content-Type: multipart/form-data
```

**Form fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chatId` | string | Yes | Phone number (e.g. `63XXXXXXXXXX`) |
| `file` | file | Yes | The image/file to send (max 16MB) |
| `fileName` | string | No | Custom file name |
| `caption` | string | No | Caption text for images |

**Response:**
```json
{
  "status": "sent"
}
```

---

### 5. Delete/Disconnect Session

```
DELETE /api/session/:customerId
```

**Response:**
```json
{
  "success": true
}
```

---

### 6. Health Check (no auth needed)

```
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

## Incoming Message Webhook

When a WhatsApp message is received, the gateway POSTs to `MAIN_SAAS_WEBHOOK_URL` with:

```json
{
  "customerId": "customer1",
  "from": "80376773001374@lid",
  "pushName": "John Doe",
  "message": "Hi there!",
  "timestamp": 1709812345
}
```

> `from` is a WhatsApp LID (Linked Identity) — NOT a phone number. Format: `<id>@lid`.
> This is how Baileys v7 identifies contacts. Use `pushName` for display and store `from` as-is for sending replies.
> `pushName` is the sender's WhatsApp display name (can be null).
> `timestamp` is Unix seconds.

---

## Migration from Green API

| Green API | WClixAPI (ours) |
|-----------|-----------------|
| `POST /waInstance.../sendMessage` | `POST /api/session/send/:customerId` |
| `POST /waInstance.../SendFileByUpload` | `POST /api/session/send-file/:customerId` |
| `POST /waInstance.../getQRCode` | `POST /api/session/start/:customerId` |
| `GET /waInstance.../getStateInstance` | `GET /api/session/status/:customerId` |
| `POST /waInstance.../logout` | `DELETE /api/session/:customerId` |
| Webhook: `stateInstanceChanged` | `GET /api/session/status/:customerId` (poll) |
| Webhook: `incomingMessageReceived` | Our gateway POSTs to `MAIN_SAAS_WEBHOOK_URL` |

### Key differences from Green API:
1. **No instance creation** — just call `/api/session/start/:customerId` with any customer ID
2. **Single API key** for all sessions (not per-instance like Green API)
3. **QR code returned as base64 PNG** directly in the response (no separate getQRCode call)
4. **Phone number format** — send `to` as plain number (`63XXXXXXXXXX`), no need for `@c.us` suffix
5. **Webhook payload is simpler** — flat object with `customerId`, `from`, `pushName`, `message`, `timestamp`
6. **No chatId@c.us** — our gateway uses LID format (`<id>@lid`) for incoming messages. For sending, use plain phone numbers.

---

## Example: Supabase Edge Function - Send Message

```typescript
const res = await fetch(
  `https://wa.clixwapp.online/api/session/send/${customerId}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": Deno.env.get("WA_GATEWAY_API_KEY")!,
    },
    body: JSON.stringify({ to: phoneNumber, message: text }),
  }
);
const data = await res.json();
```

## Example: Supabase Edge Function - Start Session

```typescript
const res = await fetch(
  `https://wa.clixwapp.online/api/session/start/${customerId}`,
  {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("WA_GATEWAY_API_KEY")!,
    },
  }
);
const data = await res.json();
// data.qr = "data:image/png;base64,..." (display this in your frontend)
```

## Example: Supabase Edge Function - Receive Incoming Messages

```typescript
// This edge function URL goes in the gateway's MAIN_SAAS_WEBHOOK_URL env var
const payload = await req.json();
// payload = { customerId, from, pushName, message, timestamp }

// payload.from is a LID like "80376773001374@lid" — use as-is for replies
// Use payload.pushName for display name
```
