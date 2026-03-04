# Backend Integration Guide

> How to use the Supabase and n8n backend connections in this project.
> Source repo: [github.com/Shaharelhad/CLIX-BOT-project](https://github.com/Shaharelhad/CLIX-BOT-project)

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

### Basic usage

```typescript
import { supabase } from "@/services/supabase";

// Query a table (RLS scopes to current user automatically)
const { data, error } = await supabase
  .from("faq_entries")
  .select("*")
  .eq("is_active", true)
  .order("sort_order");

// Insert a row
const { error } = await supabase
  .from("faq_entries")
  .insert({ user_id: userId, question: "...", answer: "..." });

// Update a row
const { error } = await supabase
  .from("faq_entries")
  .update({ answer: "new answer" })
  .eq("id", faqId);

// Delete a row
const { error } = await supabase
  .from("faq_entries")
  .delete()
  .eq("id", faqId);
```

---

## 3. Authentication

### Auth Hook — `Client/src/hooks/useAuth.ts`

The `useAuth()` hook is the single entry point for all auth operations.

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

Zustand store that holds auth state globally:

```typescript
import { useAuthStore } from "@/store/auth.store";

// The Profile type is derived directly from the RPC return type:
type Profile = Database["public"]["Functions"]["get_my_profile"]["Returns"][number];
// Fields: id, full_name, email, phone, role, status, language, created_at

interface AuthState {
  user: Profile | null;
  session: Session | null;
  isLoading: boolean;
  setUser: (user: Profile | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}
```

**When to use directly:** Only if you need auth state outside of React components (e.g., in a service function). In components, always use `useAuth()`.

### Route Guard Pattern

Not yet built, but here's the intended pattern:

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

## 4. Database Queries (Type-Safe)

**Types file:** `Client/src/types/database.ts` (1,174 lines, auto-generated)

### Type Helpers

```typescript
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/types/database";

// Row type (what you get from SELECT)
type Profile = Tables<"profiles">;
type Workflow = Tables<"workflows">;
type FaqEntry = Tables<"faq_entries">;

// Insert type (what you pass to INSERT — optional fields have ?)
type NewWorkflow = TablesInsert<"workflows">;

// Update type (all fields optional)
type WorkflowUpdate = TablesUpdate<"workflows">;

// Enum type
type Tier = Enums<"subscription_tier">; // "basic" | "pro" | "premium"
```

### 20 Tables Available

| Table | Purpose |
|---|---|
| `profiles` | User data (extends auth.users) |
| `form_responses` | Bot creation form submissions |
| `form_fields` | Admin-managed dynamic form fields |
| `form_settings` | Form opening/closing text |
| `bot_edit_history` | Bot prompt edit requests |
| `demo_conversations` | Preview chat history |
| `faq_entries` | User FAQ pairs (high-priority bot context) |
| `support_tickets` | Support chat tickets |
| `ticket_messages` | Support chat messages |
| `integrations` | Third-party integration configs |
| `scrape_jobs` | Web scraping job tracking |
| `scraped_pages` | Detailed scraped page content |
| `scraped_data` | Legacy simple scraped content |
| `products` | Scraped products (fuzzy Hebrew search) |
| `workflows` | Flow builder visual workflows |
| `subscriber_sessions` | Active WhatsApp chat sessions |
| `flow_message_log` | Flow message history |
| `flow_delayed_jobs` | Scheduled flow tasks |
| `flow_processed_messages` | Message deduplication |
| `node_analytics` | Flow node performance metrics |

### Direct Table Queries

```typescript
// SELECT with filtering
const { data: faqs } = await supabase
  .from("faq_entries")
  .select("*")
  .eq("user_id", userId)
  .eq("is_active", true)
  .order("sort_order");

// SELECT with joins (Supabase auto-detects FK relationships)
const { data: tickets } = await supabase
  .from("support_tickets")
  .select("*, profiles(full_name, email)")
  .eq("status", "open");

// INSERT
const { data, error } = await supabase
  .from("faq_entries")
  .insert({
    user_id: userId,
    question: "What are your hours?",
    answer: "We're open 9-5 Sun-Thu.",
    sort_order: 1,
    is_active: true,
  })
  .select()
  .single();

// UPSERT
const { error } = await supabase
  .from("form_settings")
  .upsert({ id: settingsId, opening_text: "Welcome!" });

// COUNT
const { count } = await supabase
  .from("products")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId);
```

### RLS (Row-Level Security)

All queries go through RLS automatically:
- **Users** can only read/write their own rows (filtered by `user_id = auth.uid()`)
- **Admins** bypass RLS via the `is_admin()` check in policies
- **Edge functions** use the service role key which bypasses all RLS

You never need to manually filter by `user_id` for user-scoped tables — RLS does it. But admin RPCs exist for admin operations that need cross-user access.

---

## 5. RPC Functions

Call server-side PostgreSQL functions for operations that need elevated permissions or custom logic.

```typescript
const { data, error } = await supabase.rpc("function_name", { arg1: value1 });
```

### User RPCs

| Function | Args | Returns | Use For |
|---|---|---|---|
| `get_my_profile()` | none | `Profile[]` | Fetch current user's profile |
| `is_admin()` | none | `boolean` | Check admin status |
| `search_products(p_user_id, p_query, p_limit?)` | UUID, text, int? | Products with similarity score | Fuzzy Hebrew product search |
| `get_max_revisions(tier)` | subscription_tier | `number` | Bot edit limit per plan |
| `get_monthly_credits(tier)` | subscription_tier | `number` | Monthly credits per plan |

### Admin RPCs

| Function | Args | Returns | Use For |
|---|---|---|---|
| `admin_list_profiles(p_status?)` | optional status | `Profile[]` | List users (filterable) |
| `admin_get_profile(p_id)` | UUID | `Profile` | Get specific user |
| `admin_update_profile_status(p_id, p_status)` | UUID, string | void | Approve/reject users |
| `admin_get_counts()` | none | `{open_tickets, pending_users}` | Dashboard stats |
| `admin_list_tickets()` | none | Tickets with user info | Support ticket list |
| `admin_list_user_integrations(p_user_id)` | UUID | `{integration_type}[]` | User's integrations |
| `admin_list_form_fields()` | none | `FormField[]` | Get form builder fields |
| `admin_add_form_field(...)` | field params | void | Add form field |
| `admin_update_form_field(...)` | field params | void | Edit form field |
| `admin_delete_form_field(p_id)` | UUID | void | Remove form field |
| `admin_update_field_order(p_id, p_sort_order)` | UUID, int | void | Reorder fields |
| `admin_get_form_settings()` | none | Settings | Get form UI text |
| `admin_update_form_settings(...)` | text params | void | Update form UI text |

### Usage Examples

```typescript
// Fetch current user profile
const { data, error } = await supabase.rpc("get_my_profile");
const profile = data?.[0]; // { id, full_name, email, phone, role, status, language, created_at }

// Admin: approve a user
const { error } = await supabase.rpc("admin_update_profile_status", {
  p_id: userId,
  p_status: "approved",
});

// Admin: get dashboard stats
const { data } = await supabase.rpc("admin_get_counts");
// data[0] = { open_tickets: 3, pending_users: 5 }

// Search products (fuzzy Hebrew search via pg_trgm)
const { data: products } = await supabase.rpc("search_products", {
  p_user_id: userId,
  p_query: "חולצה כחולה",
  p_limit: 10,
});

// Check plan limits
const { data: maxRevisions } = await supabase.rpc("get_max_revisions", {
  tier: "pro",
});
```

---

## 6. Webhooks & Edge Functions

**File:** `Client/src/services/webhooks.ts`

All backend operations that involve server-side logic (AI calls, scraping, WhatsApp) go through webhooks. The webhook service provides 11 pre-built functions.

### How It Works

The `callWebhook()` helper:
1. Reads the endpoint URL from the matching `VITE_*` env variable
2. **Auto-detects** Supabase edge function URLs (`.supabase.co/functions/`) and adds `Authorization: Bearer {token}`
3. POSTs JSON payload and returns `{ data, error }` tuple

```typescript
// Internal helper (you don't call this directly)
async function callWebhook<T>(envKey: string, payload: Record<string, unknown>)
  : Promise<{ data: T | null; error: string | null }>
```

### 11 Webhook Functions

#### Supabase Edge Functions (all working)

| Function | Import | Purpose | Expected Payload |
|---|---|---|---|
| `callFormSubmission()` | `@/services/webhooks` | Submit bot creation form | `{ user_id, business_name, business_description, website_url, ... }` |
| `callBotDemo()` | `@/services/webhooks` | Send message in preview chat | `{ user_id, message, conversation_id? }` |
| `callBotEditRequest()` | `@/services/webhooks` | Request bot personality change | `{ user_id, edit_request }` |
| `callGreenAPIConnect()` | `@/services/webhooks` | Connect WhatsApp account | `{ user_id, instance_id, token }` |
| `callFlowDemo()` | `@/services/webhooks` | Flow builder preview message | `{ user_id, workflow_id, message }` |
| `callScrapeTrigger()` | `@/services/webhooks` | Trigger website scraping | `{ user_id, url }` |
| `callScrapeStatus()` | `@/services/webhooks` | Poll scraping progress | `{ user_id, scrape_job_id }` |

#### n8n Webhooks

| Function | Import | Status | Purpose |
|---|---|---|---|
| `callDeepScrape()` | `@/services/webhooks` | **WORKING** | Advanced web scraping |
| `callBotEditApply()` | `@/services/webhooks` | **404 — LEGACY** | Not needed (edge function handles it) |
| `callIntegrationAdd()` | `@/services/webhooks` | **404 — LEGACY** | Not needed (old architecture) |
| `callSupportAI()` | `@/services/webhooks` | **404 — NEEDS BACKEND** | Support chat (needs deployment) |

### Usage Example

```typescript
import { callBotDemo, callScrapeStatus } from "@/services/webhooks";

// Send a message to the bot preview
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

// Poll scraping progress
const { data: status } = await callScrapeStatus({
  user_id: user.id,
  scrape_job_id: jobId,
});
// status = { status: "scraping", total_pages: 10, scraped_pages: 3, products_found: 12 }
```

### Edge Function Details

Each edge function runs server-side in Supabase's Deno runtime with access to:
- **Service role key** (bypasses RLS)
- **Environment secrets** (API keys for Claude, Gemini, Firecrawl, GreenAPI)
- Full database access

| Edge Function | What It Does Server-Side |
|---|---|
| `form-submission` | Scrapes URL via Firecrawl → Claude generates Hebrew bot prompt → saves to `form_responses` → fires `scrape-trigger` |
| `bot-demo` | Fetches bot prompt + scraped content → searches products → gets FAQs → gets conversation history → Gemini (fallback Claude) → saves to `demo_conversations` |
| `bot-edit` | Fetches current prompt → Claude generates updated prompt + summary → updates `form_responses` → inserts `bot_edit_history` |
| `greenapi-connect` | Validates GreenAPI credentials → updates `profiles` with credentials → configures webhook URL → points to `flow-webhook` |
| `flow-webhook` | Receives WhatsApp messages → deduplicates → finds user → executes flow engine nodes → LLM fallback if no trigger matches |
| `flow-demo` | Same flow engine as `flow-webhook` but runs in browser preview mode using `demo_conversations` |
| `scrape-trigger` | Scrapes URLs via Firecrawl (up to 5) → discovers subpages (up to 10 more) → re-generates enhanced bot prompt → updates `form_responses` |
| `scrape-status` | Returns `{ status, total_pages, scraped_pages, products_found }` for a scrape job |

---

## 7. React Query Integration

**Setup:** `Client/src/main.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes — data considered fresh
      retry: 1,                  // single retry on failure
    },
  },
});
```

### Wrapping Supabase in React Query

Use `useQuery` for reads and `useMutation` for writes:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

// READ: Fetch FAQ entries
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

// WRITE: Add a FAQ entry
function useAddFaq() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (faq: { user_id: string; question: string; answer: string }) => {
      const { data, error } = await supabase
        .from("faq_entries")
        .insert(faq)
        .select()
        .single();
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

// In a component:
function PreviewChat() {
  const botDemo = useBotDemo();

  const sendMessage = () => {
    botDemo.mutate(
      { user_id: user.id, message: inputText },
      {
        onSuccess: (data) => setMessages((prev) => [...prev, data]),
        onError: (err) => toast.error(err.message),
      },
    );
  };
}
```

### Wrapping RPCs in React Query

```typescript
// Admin dashboard stats
function useAdminCounts() {
  return useQuery({
    queryKey: ["admin", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_counts");
      if (error) throw error;
      return data[0]; // { open_tickets, pending_users }
    },
  });
}

// Admin: approve user (mutation)
function useApproveUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("admin_update_profile_status", {
        p_id: userId,
        p_status: "approved",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "counts"] });
    },
  });
}
```

---

## 8. n8n Connection

### What is n8n?

n8n is a workflow automation platform. The original CLIX project used it for all backend logic, but most workflows were migrated to Supabase edge functions. Only a few n8n endpoints remain.

### Current n8n Endpoints

| Endpoint | URL | Status | Notes |
|---|---|---|---|
| `clix-deep-scrape` | `seai.shop/webhook/clix-deep-scrape` | **Working** | Advanced multi-page web scraping |
| `clix-bot-edit-apply` | `seai.shop/webhook/clix-bot-edit-apply` | **404** | Legacy — `bot-edit` edge function does this now |
| `clix-integration-add` | `seai.shop/webhook/clix-integration-add` | **404** | Legacy — old AI workflow architecture |
| `clix-support-ai` | `seai.shop/webhook/clix-support-ai` | **404** | **Needed** — support chat has no backend |

### How n8n Webhooks Differ from Edge Functions

| Aspect | Supabase Edge Function | n8n Webhook |
|---|---|---|
| Auth header | Auto-added by `callWebhook()` | Not added (no `.supabase.co` in URL) |
| Runtime | Deno (Supabase) | Node.js (n8n) |
| Hosting | Supabase infrastructure | Self-hosted at seai.shop |
| Auth in payload | User token in Authorization header | Must pass `user_id` in body |

### Adding a New n8n Webhook

1. Create the workflow in n8n with a **Webhook** trigger node
2. Deploy/activate the workflow to get the webhook URL
3. Add the URL to `Client/.env` as `VITE_N8N_WEBHOOK_YOUR_NAME=https://...`
4. Add the env key to `Client/.env.sample`
5. Add a wrapper function in `Client/src/services/webhooks.ts`:

```typescript
export function callYourNewWebhook(data: Record<string, unknown>) {
  return callWebhook("VITE_N8N_WEBHOOK_YOUR_NAME", data);
}
```

### Support Chat — What's Missing

The `clix-support-ai` endpoint is needed but returns 404. Options:
1. **Import the n8n workflow** from the original repo's `workflows/` directory into the seai.shop n8n instance
2. **Create a Supabase edge function** — the logic is simple: receive message → fetch ticket history → Claude response in Hebrew → save to `ticket_messages` → return response

---

## 9. Environment Variables

**File:** `Client/.env.sample`

| Variable | Purpose | Used By |
|---|---|---|
| **Supabase** | | |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier | Reference only |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key (safe to expose) | `supabase.ts` |
| `VITE_SUPABASE_URL` | Supabase API base URL | `supabase.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key (server-side only) | Edge functions |
| `SUPABASE_ACCESS_TOKEN` | PAT for CLI/management | CLI tools |
| **AI APIs** | | |
| `ANTHROPIC_API_KEY` | Claude API key | Edge functions |
| `GEMINI_API_KEY` | Google Gemini API key | Edge functions |
| `OPENROUTER_API_KEY` | OpenRouter API key | Edge functions |
| `FIRECRAWL_API_KEY` | Firecrawl scraping API | Edge functions |
| **n8n** | | |
| `VITE_N8N_API_BASE_URL` | n8n instance URL | n8n management |
| `VITE_N8N_API_KEY` | n8n API key | n8n management |
| `VITE_N8N_MCP_SERVER_URL` | n8n MCP server URL | MCP integration |
| **Webhooks (11)** | | |
| `VITE_N8N_WEBHOOK_FORM_SUBMISSION` | → Supabase edge function | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_BOT_DEMO` | → Supabase edge function | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_BOT_EDIT_REQUEST` | → Supabase edge function | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_BOT_EDIT_APPLY` | → n8n (404 — legacy) | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_GREENAPI_CONNECT` | → Supabase edge function | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_SUPPORT_AI` | → n8n (404 — needs backend) | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_INTEGRATION_ADD` | → n8n (404 — legacy) | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_SCRAPE_STATUS` | → Supabase edge function | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_DEEP_SCRAPE` | → n8n (working) | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_FLOW_DEMO` | → Supabase edge function | `webhooks.ts` |
| `VITE_N8N_WEBHOOK_SCRAPE_TRIGGER` | → Supabase edge function | `webhooks.ts` |

**Note:** Variables prefixed with `VITE_` are exposed to the browser. Non-prefixed variables (API keys) are only available server-side in edge functions.

---

## 10. Common Patterns

### Fetch user profile on page load

```typescript
const { user, isLoading, isApproved } = useAuth();

if (isLoading) return <Spinner />;
if (!isApproved) return <Navigate to="/pending" />;

return <Dashboard user={user} />;
```

### Call an edge function with auth

```typescript
import { callFormSubmission } from "@/services/webhooks";

const handleSubmit = async (formData: FormValues) => {
  const { data, error } = await callFormSubmission({
    user_id: user.id,
    business_name: formData.businessName,
    business_description: formData.description,
    website_url: formData.websiteUrl,
  });

  if (error) {
    toast.error(error);
    return;
  }
  // data = { success: true, bot_prompt: "...", scrape_job_id: "..." }
};
```

### Admin RPC with React Query

```typescript
function useAdminProfiles(status?: string) {
  return useQuery({
    queryKey: ["admin", "profiles", status],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_profiles", {
        p_status: status ?? null,
      });
      if (error) throw error;
      return data;
    },
  });
}
```

### Poll for async operation status

```typescript
import { useQuery } from "@tanstack/react-query";
import { callScrapeStatus } from "@/services/webhooks";

function useScrapeProgress(jobId: string | null) {
  return useQuery({
    queryKey: ["scrape-status", jobId],
    queryFn: async () => {
      const { data, error } = await callScrapeStatus({
        scrape_job_id: jobId,
      });
      if (error) throw new Error(error);
      return data as { status: string; total_pages: number; scraped_pages: number; products_found: number };
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling when complete or failed
      if (status === "completed" || status === "failed") return false;
      return 3000; // Poll every 3 seconds while in progress
    },
  });
}
```

### Error handling pattern

```typescript
// For Supabase queries
const { data, error } = await supabase.from("table").select("*");
if (error) {
  // error.message, error.code, error.details
  console.error("Query failed:", error.message);
  return;
}

// For webhooks
const { data, error } = await callBotDemo({ ... });
if (error) {
  // error is a string
  console.error("Webhook failed:", error);
  return;
}

// For RPCs
const { data, error } = await supabase.rpc("function_name", { ... });
if (error) {
  // Same as query errors
  console.error("RPC failed:", error.message);
  return;
}
```
