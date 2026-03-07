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
  - `src/services/webhooks.ts` — 12 webhook functions for Supabase edge functions + n8n
- **Hooks:** `src/hooks/useAuth.ts` — auth hook (signUp, signIn, signOut, resetPassword, profile)
- **Store:** `src/store/auth.store.ts` — Zustand auth state (user, session, loading)
- **Types:** `src/types/database.ts` — auto-generated Supabase types (20 tables, RPCs, enums)
- **Styling:** Tailwind CSS 4.x via `@tailwindcss/vite` plugin
- **Path aliases:** `@/*` maps to `./src/*` (configured in tsconfig.app.json + vite.config.ts)

### Backend (Supabase — no local server)
- **Auth:** Supabase Auth with `handle_new_user()` trigger → auto-creates `profiles` row
- **Database:** 20 tables in Supabase PostgreSQL (see `clix-backend-reference.md` for schema)
- **Edge Functions:** 9 deployed at `https://gctijcljpjtmpyuzaohm.supabase.co/functions/v1/`
  - form-submission, form-update, bot-demo, bot-edit, greenapi-connect, flow-webhook, flow-demo, scrape-trigger, scrape-status
- **RPC Functions:** 17 PostgreSQL functions (admin operations, profile, product search, etc.)
- **n8n Webhooks:** 4 endpoints on seai.shop (1 working: deep-scrape; 2 legacy/unused: bot-edit-apply, integration-add; 1 needs deployment or replacement: support-ai)

### Environment Variables
- **Client/.env:** Supabase credentials, API keys (Anthropic, Gemini, OpenRouter, Firecrawl), n8n config, 11 webhook URLs
- **Client/.env.sample:** Template with all keys (no values)
- See `clix-backend-reference.md` → "Webhook Mapping" for which env var maps to which endpoint

## Key Conventions
- ES modules (`"type": "module"` in package.json)
- TypeScript strict mode
- ESLint 9 flat config
- Prettier config at project root (`.prettierrc`)
- Path aliases: use `@/` for all imports (e.g., `import { supabase } from "@/services/supabase"`)
- Supabase client: always import from `@/services/supabase`, never create new clients
- Webhooks: use functions from `@/services/webhooks.ts`, never call endpoints directly
- Auth: use `useAuth()` hook from `@/hooks/useAuth.ts` for all auth operations
- State: Zustand for client state (`src/store/`), React Query for server state
- Database types: import from `@/types/database` (e.g., `Tables<"profiles">`, `TablesInsert<"form_responses">`)

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
- 11 webhook functions defined in `webhooks.ts` with auto-auth for Supabase edge functions
  - **WARNING:** All 11 are defined but NONE are called from any page yet — they need to be wired in
- All 20 DB tables exist and are queryable
- All 8 edge functions deployed and responding
- 10/17 RPC functions used from frontend (7 unused — see `migration-status.md`)

### Frontend Pages Built
- **HomePage** — full landing page with 7 sections (Hero, ProductPreview, Features, Pricing, FAQ, CTA, Footer)
- **AuthPage** — login, signup, forgot-password modes (wired to Supabase Auth)
- **PendingPage** — approval waiting screen with 30s auto-refresh (wired to `get_my_profile` RPC)
- **CreateBotPage** — multi-step form with 3 sections (Form, Preview, Connect) — **UI only, no backend calls yet**
- **AdminPage** — 3 working sections:
  - Approvals — approve/reject users (wired to RPCs)
  - Users — list + search + filter (wired to RPCs)
  - FormBuilder — drag-drop field editor (wired to 7 RPCs)
- **AdminGuard** — route protection for admin pages
- **i18n** — 14 namespaces, Hebrew + English, RTL support via i18next

### Frontend Not Yet Built
See [`.claude/migration-status.md`](.claude/migration-status.md) for the full gap analysis with checklists.

**Key missing items:**
- 10 pages (Preview, Connect, FlowBuilder, BusinessContent, FaqManager, Settings, NotFound, Admin/UserDetails, Admin/Tickets, Admin/FlowManager)
- UserLayout + AppSidebar (user navigation/auth guard wrapper)
- AuthGuard for user routes
- Flow builder (needs @xyflow/react + 11 components)
- All webhook function calls (none are wired to pages)
- Support chat backend (n8n endpoint returns 404)

## Maintenance Rule

**When implementing any feature, you MUST:**
1. Update `.claude/migration-status.md` to mark the feature as complete (change `[ ]` to `[x]`)
2. Update webhook/RPC usage tables if you wire new backend calls
3. Update this file's "What's Ready" section if a major feature is added
4. Update `.claude/clix-backend-reference.md` if new backend patterns, services, or integrations are added
