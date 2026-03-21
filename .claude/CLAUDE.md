# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview 

**CLIX** — SaaS WhatsApp Bot Builder for Israeli businesses (Hebrew-first, RTL). Users create AI-powered WhatsApp chatbots through a web dashboard without coding.

Built from a React/Vite boilerplate. Backend is fully serverless via **Supabase** (auth, DB, edge functions, storage). No Express server — the `Server/` directory is unused (only `Server/info.txt` remains as a placeholder).

For the full architecture, database schema, edge functions, webhook mapping, and code patterns, see [`.claude/clix-backend-reference.md`](.claude/clix-backend-reference.md).

## Commands

### Client (from `Client/`)
- `npm run dev` — Start Vite dev server (http://localhost:5173)
- `npm run build` — TypeScript check + Vite production build
- `npm run lint` — ESLint
- `npm run preview` — Preview production build

Only `Client/` has a package.json. Run `npm install` from there.

## Architecture

### Client (`Client/`)
- **Entry:** `src/main.tsx` → mounts `<App>` inside `<QueryClientProvider>`, `<ErrorBoundary>`, `<BrowserRouter>`, `<StrictMode>`
- **Routing:** React Router v7 in `src/App.tsx` — add new routes here
- **Pages:** `src/pages/` — page-level components (see Page Structure convention below)
- **Components:** `src/components/` — reusable UI (includes `ErrorBoundary`)
- **Services:**
  - `src/services/supabase.ts` — typed Supabase client (`createClient<Database>`)
  - `src/services/edge-functions.ts` — 7 typed wrappers for Supabase edge functions (auto-adds auth headers)
- **Hooks:** `src/hooks/useAuth.ts` — auth hook (signUp, signIn, signOut, resetPassword, profile)
- **Store:** `src/store/auth.store.ts` — Zustand auth state (user, session, loading)
- **Types:** `src/types/database.ts` — auto-generated Supabase types (20 tables, RPCs, enums)
- **Styling:** Tailwind CSS 4.x via `@tailwindcss/vite` plugin
- **Path aliases:** `@/*` maps to `./src/*` (configured in tsconfig.app.json + vite.config.ts)

### Backend (Supabase — no local server)
- **Auth:** Supabase Auth with `handle_new_user()` trigger → auto-creates `profiles` row
- **Database:** 20 tables in Supabase PostgreSQL (see `clix-backend-reference.md` for schema)
- **Edge Functions:** 10 at `https://gctijcljpjtmpyuzaohm.supabase.co/functions/v1/`
  - form-submission, form-update, bot-demo, bot-edit, wclixapi-connect, flow-webhook, flow-demo, scrape-trigger, scrape-status, inngest
  - **Shared modules:** `_shared/llm-engine.ts` (single LLM calling logic + `classifyTrigger()` semantic trigger matcher), `_shared/wa-messaging.ts` (WhatsApp via WClixAPI), `_shared/cors.ts`
- **RPC Functions:** 19 PostgreSQL functions (admin operations, profile, product search, draft/publish bot, etc.)

### Environment Variables
- **Client/.env:** Supabase credentials, API keys (Anthropic, Gemini, OpenRouter, Firecrawl), 7 edge function URLs
- **Client/.env.sample:** Template with all keys (no values)
- See `clix-backend-reference.md` → "Edge Function Mapping" for which env var maps to which endpoint

## Key Conventions
- ES modules (`"type": "module"` in package.json)
- TypeScript strict mode
- ESLint 9 flat config
- Prettier config at project root (`.prettierrc`)
- Path aliases: use `@/` for all imports (e.g., `import { supabase } from "@/services/supabase"`)
- Supabase client: always import from `@/services/supabase`, never create new clients
- Edge functions: use wrappers from `@/services/edge-functions.ts`, never call endpoints directly
- Auth: use `useAuth()` hook from `@/hooks/useAuth.ts` for all auth operations
- State: Zustand for client state (`src/store/`), React Query for server state
- Database types: import from `@/types/database` (e.g., `Tables<"profiles">`, `TablesInsert<"form_responses">`)
- External operations (Supabase, APIs, third-party services): always read `Client/.env` first to get credentials/URLs before asking the user for access details (includes `SUPABASE_ACCESS_TOKEN` for CLI deploys)

### Page Structure (`src/pages/`)
- **Naming:** pages are `{Name}Page.tsx`, sections are `{Name}Section.tsx`
- **Single-file page:** if a page has no sections, place it directly in `pages/` — e.g., `pages/ProfilePage.tsx`
- **Multi-section page:** if a page has distinct sections, create a folder for it:
  ```
  pages/{Name}Page/
  ├── {Name}Page.tsx          # main page component
  └── Sections/
      ├── HeroSection.tsx     # individual section components
      └── PricingSection.tsx
  ```
  - The folder and main file share the same name (e.g., `HomePage/HomePage.tsx`)
  - All section components go inside a `Sections/` subfolder
  - The main page imports and composes its sections

## What's Ready

### Backend Connections
- Supabase client with typed Database generics
- Auth flow (signUp → pending → admin approval → approved)
- 7 edge function wrappers in `edge-functions.ts` with auto-auth
  - `callWClixAPIConnect()` is wired to ConnectSection (QR code flow)
- All 20 DB tables exist and are queryable
- All 8 edge functions deployed and responding
- 13/19 RPC functions used from frontend (6 unused — see `migration-status.md`)
- **Draft/Publish system:** `form_responses.draft_bot_prompt` column separates preview from live bot. Edits go to draft, published on WhatsApp connect or via "Publish Changes" button in dashboard
- **Google Sheets Knowledge Base:** Users paste a public Google Sheet URL → data is fetched via Google Sheets API, chunked, embedded, and added to the RAG pipeline. Auto-syncs every 10 min via Inngest cron. Manual refresh also available. Edge function: `sheets-sync`. Shared helpers: `_shared/sheets-helpers.ts`, `_shared/chunking.ts`.

### Frontend Pages Built
- **HomePage** — full landing page with 6 sections (Hero, ProductPreview, Features, FAQ, CTA, Footer)
- **AuthPage** — login, signup, forgot-password modes (wired to Supabase Auth)
- **PendingPage** — approval waiting screen with 30s auto-refresh (wired to `get_my_profile` RPC)
- **CreateBotPage** — multi-step 3-section wizard: FormSection (`callFormSubmission()` + `callScrapeStatus()`), PreviewSection (`callBotDemo()` + `callBotEditRequest()`), ConnectSection (`callWClixAPIConnect()`). All wired to backend.
- **AdminPage** — 3 working sections:
  - Approvals — approve/reject users (wired to RPCs)
  - Users — list + search + filter (wired to RPCs)
  - FormBuilder — drag-drop field editor (wired to 7 RPCs)
- **FlowBuilderPage** — visual @xyflow/react flow editor at `/dashboard/flow-builder`. 3-panel layout (editor sidebar, canvas, node palette) + toolbar + preview simulator. 8 node types (start, text, image, buttons, collect_input, delay, follow_up, condition). 1 workflow per account (auto-created). Default template: single Start node. LLM works implicitly behind the scenes — no AI Agent node. **Smart triggers:** LLM-based semantic matching via `classifyTrigger()` in `_shared/llm-engine.ts` (e.g., "hi" matches a "hello" trigger). **workflow_record:** auto-generated Hebrew summary of flow paths, stored in `workflows.workflow_record` on publish, passed to LLM as context for fallback responses. Legacy ai_agent nodes are auto-stripped on load (frontend) and treated as pass-through (backend). Dashboard demo chat unified with flow preview (both use `callFlowDemo()`).
- **Auto-Follow-Up System** — LLM-generated re-engagement messages when customers stop replying during active funnels. Configurable delay (15-1440 min) and max count (1-2) in FlowSettingsModal. Stage classification via hidden `<!-- stage:engaging/closed -->` LLM tags. Background job executor via Inngest cron (`process-delayed-jobs`, every 2 min). Also fixes existing broken `delay` and `follow_up` node executors. DB: `subscriber_sessions.conversation_stage`, `subscriber_sessions.follow_up_count`, `flow_delayed_jobs.job_type`, `claim_pending_delayed_jobs` RPC.
- **AdminGuard** — route protection for admin pages
- **i18n** — 15 namespaces (including `flow`), Hebrew + English, RTL support via i18next

### Frontend Not Yet Built
See [`.claude/migration-status.md`](.claude/migration-status.md) for the full gap analysis with checklists.

**Key missing items:**
- 2 user pages (Settings, NotFound)
- 3 admin pages (UserDetails, Tickets, FlowManager)

## Implementation Workflow

**For every feature (especially when multiple features are requested in one prompt), follow this strict loop per feature:**

### Per-Feature Loop

1. **Implement** the feature
2. **Build check** — run `npm run build` from `Client/`
   - If fails → fix and re-run build until it passes
3. **Feature complete** → proceed to next feature

**Do NOT automatically run code-simplifier, browser-tester, or /simplify agents after each feature.** Only run them when the user explicitly asks for it.

**Never batch-implement multiple features. Each feature must pass the build before starting the next.**

## Maintenance Rule

**After each feature is confirmed working, check if docs need updating:**
1. Update `.claude/migration-status.md` to mark the feature as complete (change `[ ]` to `[x]`)
2. Update webhook/RPC usage tables if you wire new backend calls
3. Update this file's "What's Ready" section if a major feature is added
4. Update `.claude/clix-backend-reference.md` if new backend patterns, services, or integrations are added
