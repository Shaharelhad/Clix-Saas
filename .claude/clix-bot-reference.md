# CLIX-BOT Project Reference

> Source: [github.com/Shaharelhad/CLIX-BOT-project](https://github.com/Shaharelhad/CLIX-BOT-project)
> Last verified: 2026-03-03

## Project Overview

CLIX is a **SaaS WhatsApp Bot Builder** for Israeli businesses (Hebrew-first, RTL). Business owners create AI-powered WhatsApp chatbots through a web dashboard without coding.

**Stack**: React 18 + Vite + Tailwind + shadcn/ui (frontend) | Supabase (auth, DB, edge functions, storage) | GreenAPI (WhatsApp) | Claude + Gemini (AI) | Firecrawl (scraping) | n8n (legacy workflows)

**Supabase Project**: `gctijcljpjtmpyuzaohm` at `https://gctijcljpjtmpyuzaohm.supabase.co`

---

## Database Schema (20 Tables)

### Core User Tables

**`profiles`** (extends `auth.users`, auto-created by `handle_new_user()` trigger)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | FK to auth.users |
| full_name, email, phone | TEXT | |
| role | TEXT | "user" or "admin" |
| status | TEXT | "pending", "approved", "rejected" |
| bot_status | TEXT | "not_created", "created", "connected" |
| greenapi_instance_id, greenapi_token | TEXT | WhatsApp credentials |
| workflow_id | TEXT | Legacy n8n workflow ref |
| active_flow_id | UUID FK→workflows | Visual flow builder |
| website_url | TEXT | |
| plan_tier | ENUM | "basic", "pro", "premium" |
| credits_balance | INT | Default 25 |
| language | TEXT | "he" (default) or "en" |
| subscription_start_date, subscription_end_date | TIMESTAMP | |

**`form_responses`** — Bot creation form submissions
| Column | Type | Notes |
|---|---|---|
| user_id | UUID FK→profiles | |
| business_name, business_description | TEXT | Required |
| target_audience, tone, website_url | TEXT | Optional |
| has_products | BOOL | |
| additional_info | TEXT | |
| bot_prompt | TEXT | Generated Claude system prompt |
| scraped_content | TEXT | Up to 50KB website content |
| workflow_id | TEXT | n8n workflow ID |

**`form_fields`** — Admin-managed dynamic form fields
| Column | Type |
|---|---|
| field_type | TEXT ("text", "textarea", "select", "radio", "checkbox", "url", "file") |
| label, placeholder, description | TEXT |
| is_required | BOOL |
| sort_order | INT |
| options | JSON |
| allow_other | BOOL |

**`form_settings`** — Form opening/closing text (admin-configurable)

### Bot Interaction Tables

**`bot_edit_history`** — Edit requests to bot prompt
- user_id, edit_request, proposed_changes, status ("pending", "applied", "rejected")

**`demo_conversations`** — Preview chat history
- user_id, conversation_id, user_message, bot_response

**`faq_entries`** — User FAQ pairs (high-priority bot context)
- user_id, question, answer, sort_order, is_active

### Support Tables

**`support_tickets`** — user_id, conversation_id, subject, status ("open", "in_progress", "resolved", "closed")
**`ticket_messages`** — user_id, conversation_id, user_message, bot_response
**`integrations`** — user_id, integration_type, config (JSON), status ("active", "inactive")

### Web Scraping Tables

**`scrape_jobs`** — user_id, base_url, status ("pending", "scraping", "completed", "failed"), total_pages, scraped_pages
**`scraped_pages`** — scrape_job_id, user_id, url, page_title, text_content, meta_description, images (JSON), videos (JSON), depth
**`scraped_data`** — user_id, url, content (legacy simple scraping)
**`products`** — user_id, scrape_job_id, source_url, name, description, price, currency, image_urls (JSON), product_url, category, attributes (JSON). Supports fuzzy Hebrew search via `pg_trgm`.

### Flow Builder Tables (WhatsApp Visual Bot)

**`workflows`** — user_id, name, flow_json (JSON with nodes+edges), status ("draft", "active", "paused")
**`subscriber_sessions`** — workflow_id, phone, current_node_id, variables (JSON), status. Unique: (workflow_id, phone)
**`flow_message_log`** — workflow_id, session_id, node_id, direction ("inbound", "outbound"), message_type, content, status
**`flow_delayed_jobs`** — session_id, node_id, execute_at, status ("pending", "executed", "cancelled")
**`flow_processed_messages`** — id_message (deduplication)
**`node_analytics`** — workflow_id, node_id, sent, delivered, clicked. Unique: (workflow_id, node_id)

---

## RPC Functions

| Function | Args | Returns | Notes |
|---|---|---|---|
| `get_my_profile()` | none | {id, full_name, email, phone, role, status, language, created_at}[] | Current user profile |
| `is_admin()` | none | boolean | |
| `admin_list_profiles(p_status?)` | optional status filter | profiles[] | Admin only |
| `admin_get_profile(p_id)` | user UUID | profile | Admin only |
| `admin_update_profile_status(p_id, p_status)` | UUID, status string | void | Approve/reject users |
| `admin_get_counts()` | none | {open_tickets, pending_users} | |
| `admin_list_tickets()` | none | tickets with user info | |
| `admin_list_user_integrations(p_user_id)` | UUID | {integration_type}[] | |
| `admin_list_form_fields()` | none | form_fields[] | |
| `admin_add_form_field(...)` | field params | void | |
| `admin_update_form_field(...)` | field params | void | |
| `admin_delete_form_field(p_id)` | UUID | void | |
| `admin_update_field_order(p_id, p_sort_order)` | UUID, int | void | |
| `admin_get_form_settings()` | none | settings | |
| `admin_update_form_settings(...)` | text params | void | |
| `search_products(p_user_id, p_query, p_limit?)` | UUID, text, optional int | products with similarity score | Fuzzy Hebrew search via pg_trgm |
| `get_max_revisions(tier)` | subscription_tier enum | int | Bot edit limits per tier |
| `get_monthly_credits(tier)` | subscription_tier enum | int | |

---

## Supabase Edge Functions (8 Functions)

All at: `https://gctijcljpjtmpyuzaohm.supabase.co/functions/v1/`

### 1. `form-submission`
- **Trigger**: User submits bot creation form
- **Process**: Extract URLs → scrape via Firecrawl (fallback: basic HTML) → Claude generates Hebrew bot prompt → save to form_responses → fire-and-forget scrape-trigger
- **Returns**: `{success, bot_prompt, scrape_job_id}`
- **Env**: FIRECRAWL_API_KEY, ANTHROPIC_API_KEY

### 2. `bot-demo`
- **Trigger**: User sends message in Preview chat
- **Process**: Fetch bot_prompt + scraped_content → search products → fetch FAQs → fetch last 10 conversation turns → try Gemini first, fallback Claude → save conversation
- **Env**: GEMINI_API_KEY, ANTHROPIC_API_KEY

### 3. `bot-edit`
- **Trigger**: User requests bot personality change
- **Process**: Fetch current bot_prompt → Claude produces updated prompt + summary → update form_responses → insert bot_edit_history
- **Returns**: `{proposed_changes, conversation_id}`

### 4. `greenapi-connect`
- **Trigger**: User connects WhatsApp
- **Process**: Validate credentials (GET getStateInstance → must be "authorized") → update profiles → configure GreenAPI webhook → point to flow-webhook
- **Returns**: `{success, webhook_url, webhook_configured}`

### 5. `flow-webhook`
- **Trigger**: All incoming WhatsApp messages from GreenAPI
- **Process**: Deduplicate → find user by greenapi_instance_id → find active workflow → execute flow engine nodes (start, text, image, buttons, collect_input, delay, follow_up) → if no trigger matches, LLM fallback conversation
- **GreenAPI sends**: text via sendMessage, buttons via sendInteractiveButtonsReply (max 3, 25 chars), images via sendFileByUrl

### 6. `flow-demo`
- **Trigger**: Flow builder preview mode
- **Process**: Same flow engine as flow-webhook but in browser preview (no real WhatsApp messages). Uses demo_conversations for history.

### 7. `scrape-trigger`
- **Trigger**: Called by form-submission after bot creation
- **Process**: Create scrape_jobs → scrape URLs via Firecrawl (up to 5) → discover subpages via /v1/map (up to 10 more) → re-generate enhanced bot prompt with Claude → update form_responses

### 8. `scrape-status`
- **Trigger**: Frontend polls for scraping progress
- **Returns**: `{status, total_pages, scraped_pages, products_found}`

### 9. `upload-media-batch` (storage utility)
- Downloads remote media → re-uploads to Supabase Storage bucket `bot-media`
- Limits: images 5MB, videos 20MB

---

## Webhook Mapping

| Env Variable | Endpoint | Type | Status |
|---|---|---|---|
| `VITE_N8N_WEBHOOK_FORM_SUBMISSION` | supabase.co/functions/v1/form-submission | Edge Function | **WORKING** |
| `VITE_N8N_WEBHOOK_BOT_DEMO` | supabase.co/functions/v1/bot-demo | Edge Function | **WORKING** |
| `VITE_N8N_WEBHOOK_BOT_EDIT_REQUEST` | supabase.co/functions/v1/bot-edit | Edge Function | **WORKING** |
| `VITE_N8N_WEBHOOK_BOT_EDIT_APPLY` | seai.shop/webhook/clix-bot-edit-apply | n8n | **404 NOT FOUND** |
| `VITE_N8N_WEBHOOK_GREENAPI_CONNECT` | supabase.co/functions/v1/greenapi-connect | Edge Function | **WORKING** |
| `VITE_N8N_WEBHOOK_SUPPORT_AI` | seai.shop/webhook/clix-support-ai | n8n | **404 NOT FOUND** |
| `VITE_N8N_WEBHOOK_INTEGRATION_ADD` | seai.shop/webhook/clix-integration-add | n8n | **404 NOT FOUND** |
| `VITE_N8N_WEBHOOK_SCRAPE_STATUS` | supabase.co/functions/v1/scrape-status | Edge Function | **WORKING** |
| `VITE_N8N_WEBHOOK_DEEP_SCRAPE` | seai.shop/webhook/clix-deep-scrape | n8n | **WORKING** |
| `VITE_N8N_WEBHOOK_FLOW_DEMO` | supabase.co/functions/v1/flow-demo | Edge Function | **WORKING** |
| `VITE_N8N_WEBHOOK_SCRAPE_TRIGGER` | supabase.co/functions/v1/scrape-trigger | Edge Function | **WORKING** |

**Summary**: 7/11 go to Supabase edge functions (all working). 4/11 go to n8n — `deep-scrape` works, `support-ai` needs deployment or replacement, `bot-edit-apply` and `integration-add` are legacy (not needed).

---

## Authentication Flow

1. **Register**: `supabase.auth.signUp()` with `full_name` + `phone` in metadata
2. Trigger `handle_new_user()` auto-creates profile with status="pending", plan_tier="basic", credits=25
3. User redirected to `/pending` page
4. **Admin approves** via admin panel → `admin_update_profile_status` RPC
5. On next login, `get_my_profile()` checks status — if approved, redirect to `/create-bot`
6. **Admin check**: `useAuth()` hook calls `get_my_profile()`, checks `role === "admin"`
7. **Password reset**: `resetPasswordForEmail` with redirect to `/auth`
8. **Language sync**: User's DB language synced to i18next on login

---

## GreenAPI Integration (WhatsApp)

1. User provides Instance ID + API Token from GreenAPI dashboard
2. `greenapi-connect` edge function validates via `GET /waInstance{id}/getStateInstance/{token}` → must return `stateInstance: "authorized"`
3. Updates `profiles` with credentials + `bot_status: "connected"`
4. Auto-configures webhook: `POST /waInstance{id}/setSettings/{token}` → points to `flow-webhook`
5. All incoming WhatsApp messages → `flow-webhook` edge function

**GreenAPI API calls**:
- `GET /waInstance{id}/getStateInstance/{token}` — validate
- `POST /waInstance{id}/setSettings/{token}` — configure webhook
- `POST /waInstance{id}/sendMessage/{token}` — send text
- `POST /waInstance{id}/sendInteractiveButtonsReply/{token}` — send buttons (max 3, 25 chars each)
- `POST /waInstance{id}/sendFileByUrl/{token}` — send image/file

---

## Visual Flow Builder

**Node types** (stored in `workflows.flow_json`):
| Type | Purpose |
|---|---|
| `start` | Entry point with trigger text keyword |
| `text` | Send text message (optional expectedReply, continueAuto) |
| `image` | Send image with caption |
| `buttons` | Interactive buttons (max 3) with per-button edges |
| `collect_input` | Prompt user, store reply in variable `{{variableName}}` |
| `delay` | Pause flow for N minutes |
| `follow_up` | Send delayed message after N minutes |

**Flow Engine** (in `flow-webhook` and `flow-demo`):
- Trigger matching: exact or contains on `triggerText`
- Variable substitution: `{{variableName}}` in messages
- Button matching: by button ID, by label (exact), by number (1, 2, 3)
- If no trigger matches → LLM fallback (open conversation)
- Sessions tracked in `subscriber_sessions`, messages in `flow_message_log`

---

## AI Integration

- **Primary**: Google Gemini `gemini-2.0-flash` (cost efficiency)
- **Fallback**: Anthropic Claude `claude-sonnet-4-5-20250929`
- For structured outputs (prompt generation, bot editing): Claude only

**Context provided to AI**:
- Bot system prompt (from form_responses.bot_prompt)
- Scraped website content (up to 8000 chars)
- Product search results (fuzzy Hebrew search via pg_trgm)
- FAQ entries (high-priority context)
- Conversation history (last 10-20 messages)

---

## Original Frontend Routes

| Path | Component | Access |
|---|---|---|
| `/` | Index (Landing) | Public |
| `/auth` | Auth (Login/Register) | Public |
| `/pending` | Pending approval | Logged in, pending |
| `/create-bot` | CreateBot form | Approved user |
| `/preview` | Preview chat | Approved user |
| `/connect` | Connect WhatsApp | Approved user |
| `/flow-builder` | FlowBuilder | Approved user |
| `/business-content` | BusinessContent (scraping) | Approved user |
| `/faq` | FaqManager | Approved user |
| `/settings` | Settings | Approved user |
| `/admin/approvals` | Approvals | Admin only |
| `/admin/users` | UsersList | Admin only |
| `/admin/users/:id` | UserDetails | Admin only |
| `/admin/form-builder` | FormBuilder | Admin only |
| `/admin/tickets` | Tickets | Admin only |
| `/admin/flows` | FlowManager | Admin only |
| `/admin/flow-builder` | FlowBuilder (admin) | Admin only |

**User sidebar**: Preview (home), Business Content, FAQ, Connect WhatsApp, Flow Builder

**Original UI**: shadcn/ui components, i18next (he/en), RTL support via `use-direction.ts` hook

---

## Internationalization (Original)

- **Languages**: Hebrew (he, default RTL) + English (en, LTR)
- **Library**: i18next + react-i18next + i18next-browser-languagedetector
- **Namespaces**: admin, auth, businessContent, common, connect, createBot, faq, flow, landing, notFound, pending, preview, settings, sidebar
- Direction managed by `use-direction.ts` hook applied to `document.dir`
- Language persisted in `profiles.language`, synced on login

---

## Migration Status (as of 2026-03-03)

### Migrated (Backend Connections)
| Component | Local File | Status |
|---|---|---|
| Supabase client | `Client/src/services/supabase.ts` | Typed client with Database generics |
| Auth hook | `Client/src/hooks/useAuth.ts` | signUp, signIn, signOut, resetPassword, profile fetch |
| Auth store | `Client/src/store/auth.store.ts` | Zustand store for user/session/loading |
| Webhook service | `Client/src/services/webhooks.ts` | 11 functions, auto-auth for edge functions |
| Database types | `Client/src/types/database.ts` | 1174 lines, all 20 tables + RPCs + enums |
| .env config | `Client/.env` + `Client/.env.sample` | All keys configured |
| React Query | `Client/src/main.tsx` | QueryClient with 5min staleTime |
| Dependencies | `Client/package.json` | @supabase/supabase-js, react-query, zustand |

### Not Migrated (Frontend — By Design)
- All page components (Auth, CreateBot, Preview, Connect, FlowBuilder, etc.)
- Route guards (AuthGuard, AdminGuard)
- shadcn/ui components
- i18n (i18next + translations)
- RTL direction handling
- Sidebar/navigation
- Flow builder UI (@xyflow/react)

### Removed
- Server directory (replaced by Supabase edge functions). Only `Server/info.txt` remains.
- Original boilerplate sample components (Card.tsx, HomePage.tsx, api.ts)

### n8n Webhook Status
The original repo has 8 n8n workflow JSON exports in `workflows/`. These are backup files — they need to be imported into an n8n instance to run. The seai.shop n8n instance has **0 CLIX workflows** (only an unrelated "Autofit" workflow).

| n8n Webhook | Status | Verdict |
|---|---|---|
| `clix-deep-scrape` | **200 OK** | Working |
| `clix-bot-edit-apply` | **404** | **Legacy/not needed** — `bot-edit` edge function already applies edits directly to `form_responses.bot_prompt` |
| `clix-integration-add` | **404** | **Legacy/not needed** — was for dynamically modifying n8n bot workflows via AI (old architecture) |
| `clix-support-ai` | **404** | **Needed** — only backend for support chat. Either import the workflow JSON or create a Supabase edge function. It's simple: receives message → fetches ticket history → Claude response in Hebrew → saves to ticket_messages → returns response |

---

## External Services

| Service | Purpose | API Base |
|---|---|---|
| Supabase | Auth, DB, Edge Functions, Storage | gctijcljpjtmpyuzaohm.supabase.co |
| GreenAPI | WhatsApp Business API | api.green-api.com |
| Anthropic Claude | Prompt generation, bot editing, fallback AI | api.anthropic.com |
| Google Gemini | Primary AI for bot responses | generativelanguage.googleapis.com |
| Firecrawl | Website scraping | api.firecrawl.dev |
| n8n | Legacy workflow automation | seai.shop |
| Supabase Storage | Bot media (bucket: `bot-media`) | supabase.co/storage/v1 |

---

## RLS Policies Summary

- Users read/write only their own data
- Admins bypass via `is_admin()` function
- Service role key bypasses all RLS (used by edge functions)
- `form_fields`: readable by everyone, writable by admins only
- Flow sessions: service role only
