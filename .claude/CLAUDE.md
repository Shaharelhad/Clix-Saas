# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CLIX** — SaaS WhatsApp Bot Builder for Israeli businesses (Hebrew-first, RTL). Users create AI-powered WhatsApp chatbots through a web dashboard without coding.

Built from a React/Vite boilerplate. Backend is fully serverless via **Supabase** (auth, DB, edge functions, storage). No Express server — the `Server/` directory is unused (only `Server/info.txt` remains as a placeholder).

For the full original project architecture, database schema, edge functions, and webhook mapping, see [`.claude/clix-bot-reference.md`](.claude/clix-bot-reference.md).

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
- **Pages:** `src/pages/` — page-level components (currently empty — to be built)
- **Components:** `src/components/` — reusable UI (includes `ErrorBoundary`)
- **Services:**
  - `src/services/supabase.ts` — typed Supabase client (`createClient<Database>`)
  - `src/services/webhooks.ts` — 11 webhook functions for Supabase edge functions + n8n
- **Hooks:** `src/hooks/useAuth.ts` — auth hook (signUp, signIn, signOut, resetPassword, profile)
- **Store:** `src/store/auth.store.ts` — Zustand auth state (user, session, loading)
- **Types:** `src/types/database.ts` — auto-generated Supabase types (20 tables, RPCs, enums)
- **Styling:** Tailwind CSS 4.x via `@tailwindcss/vite` plugin
- **Path aliases:** `@/*` maps to `./src/*` (configured in tsconfig.app.json + vite.config.ts)

### Backend (Supabase — no local server)
- **Auth:** Supabase Auth with `handle_new_user()` trigger → auto-creates `profiles` row
- **Database:** 20 tables in Supabase PostgreSQL (see `clix-bot-reference.md` for schema)
- **Edge Functions:** 8 deployed at `https://gctijcljpjtmpyuzaohm.supabase.co/functions/v1/`
  - form-submission, bot-demo, bot-edit, greenapi-connect, flow-webhook, flow-demo, scrape-trigger, scrape-status
- **RPC Functions:** 17 PostgreSQL functions (admin operations, profile, product search, etc.)
- **n8n Webhooks:** 4 endpoints on seai.shop (1 working: deep-scrape; 2 legacy/unused: bot-edit-apply, integration-add; 1 needs deployment or replacement: support-ai)

### Environment Variables
- **Client/.env:** Supabase credentials, API keys (Anthropic, Gemini, OpenRouter, Firecrawl), n8n config, 11 webhook URLs
- **Client/.env.sample:** Template with all keys (no values)
- See `clix-bot-reference.md` → "Webhook Mapping" for which env var maps to which endpoint

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

## What's Ready (Backend Connections)
- Supabase client with typed Database generics
- Auth flow (signUp → pending → admin approval → approved)
- 11 webhook functions with auto-auth for Supabase edge functions
- All 20 DB tables exist and are queryable
- All 8 edge functions deployed and responding
- All RPC functions working

## What Needs Building (Frontend)
- All page components (Auth, CreateBot, Preview, Connect, FlowBuilder, FAQ, Settings, Admin pages)
- Route guards (AuthGuard, AdminGuard)
- UI component library (shadcn/ui in original — user decides)
- i18n (Hebrew/English with RTL support)
- Sidebar/navigation
- Flow builder UI (@xyflow/react in original)
- Support chat (needs backend — either deploy n8n workflow or create edge function)
