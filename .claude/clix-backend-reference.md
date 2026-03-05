# CLIX Backend & Architecture Reference

> Source: [github.com/Shaharelhad/CLIX-BOT-project](https://github.com/Shaharelhad/CLIX-BOT-project)
> Last updated: 2026-03-05
>
> For migration progress tracking, see [migration-status.md](migration-status.md).

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────┐
│              React Frontend (Vite)                │
│                                                   │
│  Pages / Components                               │
│       │                                           │
│  ┌────┴──────────────────────────────────────┐   │
│  │  Hooks & State                             │   │
│  │  useAuth()          → auth operations      │   │
│  │  useAuthStore       → Zustand auth state   │   │
│  │  useQuery/Mutation  → React Query cache    │   │
│  └────┬──────────────────────────────────────┘   │
│       │                                           │
│  ┌────┴──────────────────────────────────────┐   │
│  │  Services                                  │   │
│  │  supabase.ts   → typed Supabase client     │   │
│  │  webhooks.ts   → 11 webhook functions      │   │
│  └────┬───────────────────┬──────────────────┘   │
└───────┼───────────────────┼──────────────────────┘
        │                   │
        ▼                   ▼
┌───────────────┐   ┌──────────────┐
│   Supabase    │   │     n8n      │
│               │   │   Webhooks   │
│ • Auth        │   │              │
│ • Database    │   │ • deep-scrape│
│ • Edge Funcs  │   │ • (legacy)   │
│ • Storage     │   └──────────────┘
│ • RPC Funcs   │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ External APIs │
│ GreenAPI      │
│ Claude/Gemini │
│ Firecrawl     │
└───────────────┘
```

**Data flow:** Components call hooks/services → services call Supabase or webhook endpoints → edge functions handle server-side logic and call external APIs.

**Supabase Project**: `gctijcljpjtmpyuzaohm` at `https://gctijcljpjtmpyuzaohm.supabase.co`

---

## 2. Supabase Client

**File:** `Client/src/services/supabase.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

### Rules
- **Always** import from `@/services/supabase` — never create new clients.
- The client is typed with `Database` generics, giving full autocomplete on table/column names.
- The anon key is safe to expose (RLS enforces access control).

### Basic Usage

```typescript
import { supabase } from "@/services/supabase";

// Query (RLS scopes to current user automatically)
const { data, error } = await supabase
  .from("faq_entries")
  .select("*")
  .eq("is_active", true)
  .order("sort_order");

// Insert
const { error } = await supabase
  .from("faq_entries")
  .insert({ user_id: userId, question: "...", answer: "..." });

// Update
const { error } = await supabase
  .from("faq_entries")
  .update({ answer: "new answer" })
  .eq("id", faqId);

// Delete
const { error } = await supabase
  .from("faq_entries")
  .delete()
  .eq("id", faqId);

// Select with joins (Supabase auto-detects FK relationships)
const { data: tickets } = await supabase
  .from("support_tickets")
  .select("*, profiles(full_name, email)")
  .eq("status", "open");
```

### Type Helpers

```typescript
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/types/database";

type Profile = Tables<"profiles">;           // Row type (SELECT)
type NewWorkflow = TablesInsert<"workflows">; // Insert type (optional fields have ?)
type WorkflowUpdate = TablesUpdate<"workflows">; // Update type (all optional)
type Tier = Enums<"subscription_tier">;       // "basic" | "pro" | "premium"
```

### RLS (Row-Level Security)

- **Users** read/write only their own rows (`user_id = auth.uid()`)
- **Admins** bypass via `is_admin()` function in policies
- **Edge functions** use service role key (bypasses all RLS)
- **`form_fields`**: readable by everyone, writable by admins only
- **Flow sessions**: service role only
- You never need to manually filter by `user_id` — RLS does it.

---

## 3. Authentication

### Auth Hook — `Client/src/hooks/useAuth.ts`

```typescript
import { useAuth } from "@/hooks/useAuth";

function MyComponent() {
  const {
    user,              // Profile object or null
    session,           // Supabase Session or null
    isLoading,         // true during initial auth check
    isAuthenticated,   // !!session
    isAdmin,           // user?.role === "admin"
    isPending,         // user?.status === "pending"
    isApproved,        // user?.status === "approved"
    signUp,            // (email, password, fullName, phone) => Promise
    signIn,            // (email, password) => Promise
    signOut,           // () => Promise
    resetPassword,     // (email) => Promise
    refreshProfile,    // () => Promise — re-fetches profile from DB
  } = useAuth();
}
```

### Auth Flow Lifecycle

```
1. signUp(email, pass, name, phone)
   └─> Supabase creates auth.users row
   └─> DB trigger handle_new_user() creates profiles row
       (status="pending", plan_tier="basic", credits=25)

2. User sees /pending page (status="pending")

3. Admin approves via admin_update_profile_status RPC
   └─> profiles.status → "approved"

4. signIn(email, pass)
   └─> onAuthStateChange fires "SIGNED_IN"
   └─> fetchProfile() calls get_my_profile() RPC
   └─> Zustand store updated with profile data

5. Token refresh happens automatically
   └─> onAuthStateChange fires "TOKEN_REFRESHED"
   └─> Profile re-fetched to stay in sync
```

### Auth Store — `Client/src/store/auth.store.ts`

Zustand store holding auth state globally:

```typescript
// Profile type derived from RPC return type:
type Profile = Database["public"]["Functions"]["get_my_profile"]["Returns"][number];
// Fields: id, full_name, email, phone, role, status, language, created_at

interface AuthState {
  user: Profile | null;
  session: Session | null;
  isLoading: boolean;
  setUser / setSession / setLoading / clear
}
```

Use `useAuth()` in components. Only use `useAuthStore` directly outside React (e.g., in service functions).

### Route Guard Pattern

```typescript
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isApproved } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/auth" />;
  if (!isApproved) return <Navigate to="/pending" />;
  return children;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAdmin) return <Navigate to="/" />;
  return children;
}
```

---

## 4. Database Schema (20 Tables)

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

### Flow Builder Tables

**`workflows`** — user_id, name, flow_json (JSON with nodes+edges), status ("draft", "active", "paused")
**`subscriber_sessions`** — workflow_id, phone, current_node_id, variables (JSON), status. Unique: (workflow_id, phone)
**`flow_message_log`** — workflow_id, session_id, node_id, direction ("inbound", "outbound"), message_type, content, status
**`flow_delayed_jobs`** — session_id, node_id, execute_at, status ("pending", "executed", "cancelled")
**`flow_processed_messages`** — id_message (deduplication)
**`node_analytics`** — workflow_id, node_id, sent, delivered, clicked. Unique: (workflow_id, node_id)

---

## 5. RPC Functions

```typescript
const { data, error } = await supabase.rpc("function_name", { arg1: value1 });
```

### User RPCs

| Function | Args | Returns | Use For | Used? |
|---|---|---|---|---|
| `get_my_profile()` | none | `Profile[]` | Fetch current user's profile | **Yes** — useAuth.ts |
| `is_admin()` | none | `boolean` | Check admin status | No — AdminGuard uses profile.role instead |
| `search_products(p_user_id, p_query, p_limit?)` | UUID, text, int? | Products with similarity score | Fuzzy Hebrew product search | No — used server-side by bot-demo edge function |
| `get_max_revisions(tier)` | subscription_tier | `number` | Bot edit limit per plan | No — needs Preview/Settings page |
| `get_monthly_credits(tier)` | subscription_tier | `number` | Monthly credits per plan | No — needs Settings page |

### Admin RPCs

| Function | Args | Returns | Use For | Used? |
|---|---|---|---|---|
| `admin_list_profiles(p_status?)` | optional status | `Profile[]` | List users (filterable) | **Yes** — AdminApprovalsSection, AdminUsersSection |
| `admin_get_profile(p_id)` | UUID | `Profile` | Get specific user | No — needs UserDetails page |
| `admin_update_profile_status(p_id, p_status)` | UUID, string | void | Approve/reject users | **Yes** — AdminApprovalsSection |
| `admin_get_counts()` | none | `{open_tickets, pending_users}` | Dashboard stats | No — needs admin dashboard badges |
| `admin_list_tickets()` | none | Tickets with user info | Support ticket list | No — needs Tickets page |
| `admin_list_user_integrations(p_user_id)` | UUID | `{integration_type}[]` | User's integrations | No — needs UserDetails page |
| `admin_list_form_fields()` | none | `FormField[]` | Get form builder fields | **Yes** — FormBuilderSection |
| `admin_add_form_field(...)` | field params | void | Add form field | **Yes** — FormBuilderSection |
| `admin_update_form_field(...)` | field params | void | Edit form field | **Yes** — FormBuilderSection |
| `admin_delete_form_field(p_id)` | UUID | void | Remove form field | **Yes** — FormBuilderSection |
| `admin_update_field_order(p_id, p_sort_order)` | UUID, int | void | Reorder fields | **Yes** — FormBuilderSection |
| `admin_get_form_settings()` | none | Settings | Get form UI text | **Yes** — FormBuilderSection |
| `admin_update_form_settings(...)` | text params | void | Update form UI text | **Yes** — FormBuilderSection |

### Usage Examples

```typescript
// Fetch current user profile
const { data, error } = await supabase.rpc("get_my_profile");
const profile = data?.[0];

// Admin: approve a user
const { error } = await supabase.rpc("admin_update_profile_status", {
  p_id: userId,
  p_status: "approved",
});

// Admin: get dashboard stats
const { data } = await supabase.rpc("admin_get_counts");
// data[0] = { open_tickets: 3, pending_users: 5 }

// Fuzzy Hebrew product search
const { data: products } = await supabase.rpc("search_products", {
  p_user_id: userId,
  p_query: "חולצה כחולה",
  p_limit: 10,
});
```

---

## 6. Webhooks & Edge Functions

**File:** `Client/src/services/webhooks.ts`

> **⚠ As of 2026-03-05:** All 11 functions are defined but **none are imported or called from any page**. They need to be wired into the respective page components.

### How It Works

The `callWebhook()` helper:
1. Reads the endpoint URL from the matching `VITE_*` env variable
2. **Auto-detects** Supabase edge function URLs (`.supabase.co/functions/`) and adds `Authorization: Bearer {token}`
3. POSTs JSON payload and returns `{ data, error }` tuple

### Webhook Functions

#### Supabase Edge Functions (all working)

| Function | Purpose | Expected Payload | Needs Wiring To |
|---|---|---|---|
| `callFormSubmission()` | Submit bot creation form | `{ user_id, business_name, business_description, website_url, ... }` | CreateBotPage |
| `callBotDemo()` | Send message in preview chat | `{ user_id, message, conversation_id? }` | Preview page |
| `callBotEditRequest()` | Request bot personality change | `{ user_id, edit_request }` | Preview page |
| `callGreenAPIConnect()` | Connect WhatsApp account | `{ user_id, instance_id, token }` | Connect page |
| `callFlowDemo()` | Flow builder preview message | `{ user_id, workflow_id, message }` | FlowBuilder page |
| `callScrapeTrigger()` | Trigger website scraping | `{ user_id, url }` | CreateBot/BusinessContent |
| `callScrapeStatus()` | Poll scraping progress | `{ user_id, scrape_job_id }` | CreateBot/BusinessContent |

#### n8n Webhooks

| Function | Status | Purpose | Notes |
|---|---|---|---|
| `callDeepScrape()` | **WORKING** | Advanced web scraping | Needs wiring to BusinessContent |
| `callBotEditApply()` | **404 — LEGACY** | Not needed | `bot-edit` edge function handles this |
| `callIntegrationAdd()` | **404 — LEGACY** | Not needed | Old architecture |
| `callSupportAI()` | **404 — NEEDS BACKEND** | Support chat | Deploy n8n workflow or create edge function |

### Edge Function Details

Each runs server-side in Supabase's Deno runtime with service role key + API secrets.

| Edge Function | What It Does Server-Side |
|---|---|
| `form-submission` | Scrapes URL via Firecrawl → Claude generates Hebrew bot prompt → saves to `form_responses` → fires `scrape-trigger` |
| `bot-demo` | Fetches bot prompt + scraped content → searches products → gets FAQs → gets history → Gemini (fallback Claude) → saves to `demo_conversations` |
| `bot-edit` | Fetches current prompt → Claude generates updated prompt + summary → updates `form_responses` → inserts `bot_edit_history` |
| `greenapi-connect` | Validates GreenAPI credentials → updates `profiles` → configures webhook URL → points to `flow-webhook` |
| `flow-webhook` | Receives WhatsApp messages → deduplicates → finds user → executes flow engine → LLM fallback if no trigger matches |
| `flow-demo` | Same flow engine as `flow-webhook` but in browser preview using `demo_conversations` |
| `scrape-trigger` | Scrapes URLs via Firecrawl (up to 5) → discovers subpages (up to 10) → re-generates enhanced bot prompt → updates `form_responses` |
| `scrape-status` | Returns `{ status, total_pages, scraped_pages, products_found }` |

### Usage Example

```typescript
import { callBotDemo, callScrapeStatus } from "@/services/webhooks";

const { data, error } = await callBotDemo({
  user_id: user.id,
  message: "What products do you sell?",
  conversation_id: currentConversationId,
});
if (error) {
  console.error("Bot demo failed:", error);
  return;
}
// data = { response: "We sell...", conversation_id: "..." }
```

### Webhook Mapping (Env Vars)

| Env Variable | Endpoint | Status |
|---|---|---|
| `VITE_N8N_WEBHOOK_FORM_SUBMISSION` | supabase.co/functions/v1/form-submission | **WORKING** |
| `VITE_N8N_WEBHOOK_BOT_DEMO` | supabase.co/functions/v1/bot-demo | **WORKING** |
| `VITE_N8N_WEBHOOK_BOT_EDIT_REQUEST` | supabase.co/functions/v1/bot-edit | **WORKING** |
| `VITE_N8N_WEBHOOK_BOT_EDIT_APPLY` | seai.shop/webhook/clix-bot-edit-apply | **404 — LEGACY** |
| `VITE_N8N_WEBHOOK_GREENAPI_CONNECT` | supabase.co/functions/v1/greenapi-connect | **WORKING** |
| `VITE_N8N_WEBHOOK_SUPPORT_AI` | seai.shop/webhook/clix-support-ai | **404 — NEEDS BACKEND** |
| `VITE_N8N_WEBHOOK_INTEGRATION_ADD` | seai.shop/webhook/clix-integration-add | **404 — LEGACY** |
| `VITE_N8N_WEBHOOK_SCRAPE_STATUS` | supabase.co/functions/v1/scrape-status | **WORKING** |
| `VITE_N8N_WEBHOOK_DEEP_SCRAPE` | seai.shop/webhook/clix-deep-scrape | **WORKING** |
| `VITE_N8N_WEBHOOK_FLOW_DEMO` | supabase.co/functions/v1/flow-demo | **WORKING** |
| `VITE_N8N_WEBHOOK_SCRAPE_TRIGGER` | supabase.co/functions/v1/scrape-trigger | **WORKING** |

### Adding a New n8n Webhook

1. Create the workflow in n8n with a **Webhook** trigger node
2. Deploy/activate to get the webhook URL
3. Add URL to `Client/.env` as `VITE_N8N_WEBHOOK_YOUR_NAME=https://...`
4. Add the env key to `Client/.env.sample`
5. Add wrapper function in `Client/src/services/webhooks.ts`

---

## 7. React Query Integration

**Setup:** `Client/src/main.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});
```

### Wrapping Supabase in React Query

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

// READ
function useFaqs(userId: string) {
  return useQuery({
    queryKey: ["faqs", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faq_entries")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

// WRITE
function useAddFaq() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (faq: { user_id: string; question: string; answer: string }) => {
      const { data, error } = await supabase.from("faq_entries").insert(faq).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["faqs", variables.user_id] });
    },
  });
}
```

### Wrapping Webhooks in React Query

```typescript
import { useMutation } from "@tanstack/react-query";
import { callBotDemo } from "@/services/webhooks";

function useBotDemo() {
  return useMutation({
    mutationFn: async (payload: { user_id: string; message: string; conversation_id?: string }) => {
      const { data, error } = await callBotDemo(payload);
      if (error) throw new Error(error);
      return data;
    },
  });
}
```

### Polling Pattern

```typescript
function useScrapeProgress(jobId: string | null) {
  return useQuery({
    queryKey: ["scrape-status", jobId],
    queryFn: async () => {
      const { data, error } = await callScrapeStatus({ scrape_job_id: jobId });
      if (error) throw new Error(error);
      return data as { status: string; total_pages: number; scraped_pages: number; products_found: number };
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "completed" || status === "failed") return false;
      return 3000;
    },
  });
}
```

### Error Handling

```typescript
// Supabase queries — error.message, error.code, error.details
const { data, error } = await supabase.from("table").select("*");
if (error) { console.error("Query failed:", error.message); return; }

// Webhooks — error is a string
const { data, error } = await callBotDemo({ ... });
if (error) { console.error("Webhook failed:", error); return; }

// RPCs — same as query errors
const { data, error } = await supabase.rpc("function_name", { ... });
if (error) { console.error("RPC failed:", error.message); return; }
```

---

## 8. GreenAPI Integration (WhatsApp)

1. User provides Instance ID + API Token from GreenAPI dashboard
2. `greenapi-connect` edge function validates via `GET /waInstance{id}/getStateInstance/{token}` → must return `stateInstance: "authorized"`
3. Updates `profiles` with credentials + `bot_status: "connected"`
4. Auto-configures webhook: `POST /waInstance{id}/setSettings/{token}` → points to `flow-webhook`
5. All incoming WhatsApp messages → `flow-webhook` edge function

**GreenAPI API calls:**
- `GET /waInstance{id}/getStateInstance/{token}` — validate credentials
- `POST /waInstance{id}/setSettings/{token}` — configure webhook
- `POST /waInstance{id}/sendMessage/{token}` — send text
- `POST /waInstance{id}/sendInteractiveButtonsReply/{token}` — send buttons (max 3, 25 chars each)
- `POST /waInstance{id}/sendFileByUrl/{token}` — send image/file

---

## 9. Visual Flow Builder

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

## 10. AI Integration

- **Primary**: Google Gemini `gemini-2.0-flash` (cost efficiency)
- **Fallback**: Anthropic Claude `claude-sonnet-4-5-20250929`
- For structured outputs (prompt generation, bot editing): Claude only

**Context provided to AI:**
- Bot system prompt (from form_responses.bot_prompt)
- Scraped website content (up to 8000 chars)
- Product search results (fuzzy Hebrew search via pg_trgm)
- FAQ entries (high-priority context)
- Conversation history (last 10-20 messages)

---

## 11. Original Frontend Routes

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

---

## 12. Internationalization

- **Languages**: Hebrew (he, default RTL) + English (en, LTR)
- **Library**: i18next + react-i18next + i18next-browser-languagedetector
- **Namespaces**: admin, auth, businessContent, common, connect, createBot, faq, flow, landing, notFound, pending, preview, settings, sidebar
- Direction managed by `use-direction.ts` hook applied to `document.dir`
- Language persisted in `profiles.language`, synced on login

---

## 13. Environment Variables

| Variable | Purpose |
|---|---|
| **Supabase** | |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier (reference only) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (safe to expose) |
| `VITE_SUPABASE_URL` | Supabase API base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (server-side only) |
| `SUPABASE_ACCESS_TOKEN` | PAT for CLI/management |
| **AI APIs** | |
| `ANTHROPIC_API_KEY` | Claude API key (edge functions) |
| `GEMINI_API_KEY` | Google Gemini API key (edge functions) |
| `OPENROUTER_API_KEY` | OpenRouter API key (edge functions) |
| `FIRECRAWL_API_KEY` | Firecrawl scraping API (edge functions) |
| **n8n** | |
| `VITE_N8N_API_BASE_URL` | n8n instance URL |
| `VITE_N8N_API_KEY` | n8n API key |
| `VITE_N8N_MCP_SERVER_URL` | n8n MCP server URL |
| **Webhooks (11)** | See webhook mapping table above |

Variables prefixed with `VITE_` are exposed to the browser. Non-prefixed variables are server-side only.

---

## 14. External Services

| Service | Purpose | API Base |
|---|---|---|
| Supabase | Auth, DB, Edge Functions, Storage | gctijcljpjtmpyuzaohm.supabase.co |
| GreenAPI | WhatsApp Business API | api.green-api.com |
| Anthropic Claude | Prompt generation, bot editing, fallback AI | api.anthropic.com |
| Google Gemini | Primary AI for bot responses | generativelanguage.googleapis.com |
| Firecrawl | Website scraping | api.firecrawl.dev |
| n8n | Legacy workflow automation | seai.shop |
| Supabase Storage | Bot media (bucket: `bot-media`) | supabase.co/storage/v1 |
