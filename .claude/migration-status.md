# CLIX Migration Status

> Tracks what's built vs missing compared to the [original project](https://github.com/Shaharelhad/CLIX-BOT-project).
> **Last updated:** 2026-03-06
>
> **RULE:** When implementing any feature, update this file to mark it complete and update any other affected `.claude/` files.

---

## Pages

### User Pages

| Page | Original | Current | Backend Wired? | Notes |
|------|----------|---------|----------------|-------|
| Landing (/) | `Landing.tsx` | [x] `HomePage/` | N/A (no backend) | Built with sections: Hero, ProductPreview, Features, Pricing, FAQ, CTA, Footer |
| Auth (/auth) | `Auth.tsx` | [x] `AuthPage.tsx` | [x] signUp, signIn, resetPassword | 3 modes (login, signup, forgot). Original has 4 modes (+ new-password for reset link) |
| Pending (/pending) | `Pending.tsx` | [x] `PendingPage.tsx` | [x] get_my_profile RPC | Auto-polls every 30s |
| Profile (/profile) | — | [x] Redirects to `/dashboard` | N/A | Redirects to Dashboard |
| Dashboard (/dashboard) | — | [x] `DashboardPage/` | [x] `profiles.bot_status`, `subscriber_sessions`, `flow_message_log`, `callBotDemo()` | Welcome + bot status pill, Active Conversations (master-detail: phone list + message history), Demo Chat (wired to `callBotDemo()`) |
| CreateBot (/create-bot) | `CreateBot.tsx` | [x] `CreateBotPage/` | [x] FormSection + ConnectSection | Dynamic form fields from `admin_list_form_fields` RPC, form settings from `admin_get_form_settings` RPC. Submits via `callFormSubmission()`, polls `callScrapeStatus()`. ConnectSection wired to `callWClixAPIConnect()`. PreviewSection still UI-only. |
| Preview (/preview) | `Preview.tsx` | [ ] | — | Dual-panel chat: demo mode (`sendFlowDemoMessage`) + edit mode (`requestBotEdit`). Session persistence. Image/video/button rendering |
| Connect (/connect) | `Connect.tsx` | [ ] | — | 4-step WhatsApp connection. Calls `callWClixAPIConnect()`. Floating support chat calls `sendSupportMessage()` |
| FlowBuilder (/flow-builder) | `FlowBuilder.tsx` | [ ] | — | @xyflow/react visual editor. 11 flow components. `useFlowBuilder` hook. Auto-save. Keyboard shortcuts |
| BusinessContent (/business-content) | `BusinessContent.tsx` | [ ] | — | Dynamic form + file uploads + URL scraping. Calls `submitBotForm()`, `triggerScrape()` |
| FaqManager (/faq) | `FaqManager.tsx` | [ ] | — | CRUD table for `faq_entries`. 800ms debounce auto-save |
| Settings (/settings) | `Settings.tsx` | [ ] | — | Edit name, phone, language. Calls `auth.updateUser()` + `profiles` table |
| NotFound (*) | `NotFound.tsx` | [ ] | — | 404 page |

### Admin Pages

| Page | Original | Current | Backend Wired? | Notes |
|------|----------|---------|----------------|-------|
| Approvals (/admin/approvals) | `admin/Approvals.tsx` | [x] `AdminApprovalsSection.tsx` | [x] `admin_list_profiles`, `admin_update_profile_status` | Working |
| Users (/admin/users) | `admin/UsersList.tsx` | [x] `AdminUsersSection.tsx` | [x] `admin_list_profiles` | Search + dual filters (status + bot_status) |
| UserDetails (/admin/users/:id) | `admin/UserDetails.tsx` | [ ] | — | Uses `admin_get_profile`, `admin_list_user_integrations` RPCs. Has IntegrationsDialog |
| FormBuilder (/admin/form-builder) | `admin/FormBuilder.tsx` | [x] `FormBuilderSection.tsx` | [x] 7 admin RPCs | Drag-drop reorder, rich text, all field types |
| Tickets (/admin/tickets) | `admin/Tickets.tsx` | [ ] | — | Support ticket table. Uses `admin_list_tickets` RPC |
| FlowManager (/admin/flows) | `admin/FlowManager.tsx` | [ ] | — | List/create/delete workflows. Uses `workflows` table |
| FlowBuilder (/admin/flow-builder) | `FlowBuilder.tsx` (admin) | [ ] | — | Same FlowBuilder but accessed by admin |

---

## Webhook Functions (services/webhooks.ts)

**STATUS: 6 of 12 functions are now wired. 2 are N/A (legacy). 4 remain unwired.**

| Function | Env Key | Backend | Called From | Status |
|----------|---------|---------|-------------|--------|
| `callFormSubmission()` | `VITE_N8N_WEBHOOK_FORM_SUBMISSION` | Edge Function (working) | `FormSection.tsx` | [x] Wired |
| `callBotDemo()` | `VITE_N8N_WEBHOOK_BOT_DEMO` | Edge Function (working) | `DemoChatSection.tsx` | [x] Wired |
| `callBotEditRequest()` | `VITE_N8N_WEBHOOK_BOT_EDIT_REQUEST` | Edge Function (working) | `EditBotSection.tsx` | [x] Wired |
| `callBotEditApply()` | `VITE_N8N_WEBHOOK_BOT_EDIT_APPLY` | n8n (404 — legacy) | — | N/A — not needed |
| `callWClixAPIConnect()` | `VITE_N8N_WEBHOOK_WCLIXAPI_CONNECT` | Edge Function (working) | `ConnectSection.tsx` | [x] Wired |
| `callSupportAI()` | `VITE_N8N_WEBHOOK_SUPPORT_AI` | n8n (404 — needs backend) | — | [ ] Not wired + no backend |
| `callScrapeStatus()` | `VITE_N8N_WEBHOOK_SCRAPE_STATUS` | Edge Function (working) | `FormSection.tsx` | [x] Wired |
| `callScrapeTrigger()` | `VITE_N8N_WEBHOOK_SCRAPE_TRIGGER` | Edge Function (working) | `EditBotSection.tsx` | [x] Wired |
| `callFlowDemo()` | `VITE_N8N_WEBHOOK_FLOW_DEMO` | Edge Function (working) | `EditBotSection.tsx` | [x] Wired |
| `callIntegrationAdd()` | `VITE_N8N_WEBHOOK_INTEGRATION_ADD` | n8n (404 — legacy) | — | N/A — not needed |
| `callFormUpdate()` | `VITE_N8N_WEBHOOK_FORM_UPDATE` | Edge Function (working) | `BusinessContentSection.tsx` | [x] Wired |
| `callDeepScrape()` | `VITE_N8N_WEBHOOK_DEEP_SCRAPE` | n8n (working) | — | [ ] Not wired |

---

## RPC Functions

| Function | Used? | Called From |
|----------|-------|------------|
| `get_my_profile()` | [x] | useAuth.ts |
| `is_admin()` | [ ] | — (AdminGuard checks role from profile instead) |
| `admin_list_profiles(p_status?)` | [x] | AdminApprovalsSection, AdminUsersSection |
| `admin_get_profile(p_id)` | [ ] | — (needs UserDetails page) |
| `admin_update_profile_status(p_id, p_status)` | [x] | AdminApprovalsSection |
| `admin_get_counts()` | [ ] | — (needs admin dashboard badges) |
| `admin_list_tickets()` | [ ] | — (needs Tickets page) |
| `admin_list_user_integrations(p_user_id)` | [ ] | — (needs UserDetails page) |
| `admin_list_form_fields()` | [x] | FormBuilderSection |
| `admin_add_form_field(...)` | [x] | FormBuilderSection |
| `admin_update_form_field(...)` | [x] | FormBuilderSection |
| `admin_delete_form_field(p_id)` | [x] | FormBuilderSection |
| `admin_update_field_order(p_id, p_sort_order)` | [x] | FormBuilderSection |
| `admin_get_form_settings()` | [x] | FormBuilderSection |
| `admin_update_form_settings(...)` | [x] | FormBuilderSection |
| `search_products(p_user_id, p_query, p_limit?)` | [ ] | — (used server-side by bot-demo edge function) |
| `get_max_revisions(tier)` | [ ] | — (needs Preview/Settings page) |
| `get_monthly_credits(tier)` | [ ] | — (needs Settings page) |

**Summary: 10/17 used, 7 unused**

---

## Components

### Layout & Navigation

| Component | Original | Current | Notes |
|-----------|----------|---------|-------|
| UserLayout (auth guard + sidebar) | [x] `UserLayout.tsx` | [x] `UserLayout.tsx` | Wraps all user routes with AuthGuard + warm cream sidebar. 6 nav items |
| AppSidebar (user nav) | [x] `AppSidebar.tsx` | [x] Built into `UserLayout.tsx` | 6 items: Dashboard, Preview, Business Content, FAQ, Connect, Flow Builder |
| AdminLayout (admin sidebar) | [x] `AdminLayout.tsx` | [x] Built into `AdminPage.tsx` | Admin sidebar with nav + badge counts |
| AdminGuard | [x] | [x] `AdminGuard.tsx` | Working — checks auth + admin role |
| AuthGuard (user routes) | [x] Built into UserLayout | [ ] | Not a separate component yet |
| IntegrationsDialog | [x] | [ ] | Dialog for WClixAPI, n8n, Claude connections |
| Logo | [x] | [ ] | Reusable logo component |
| NavLink | [x] | [ ] | Active link styling |

### Flow Builder (11 components — all missing)

| Component | Purpose |
|-----------|---------|
| [ ] FlowCanvas | @xyflow/react canvas |
| [ ] FlowToolbar | Top bar (name, save, status) |
| [ ] NodePalette | Draggable node types |
| [ ] NodeEditorSidebar | Selected node property editor |
| [ ] FlowNodeWrapper | Generic node wrapper |
| [ ] FlowPreviewSimulator | In-browser flow testing |
| [ ] StartNode | Entry point node |
| [ ] WhatsAppNode | Text/image/buttons node |
| [ ] CollectInputNode | User input collection |
| [ ] DelayNode | Timed delay |
| [ ] FollowUpNode | Scheduled follow-up |

### UI Library

| Item | Original | Current |
|------|----------|---------|
| shadcn/ui setup | [x] 64 components | [ ] Not installed |
| accordion | [x] | [x] Radix-based custom |
| anime-navbar | [x] | [x] Custom |
| dark-gradient-pricing | [x] | [x] Custom |
| rich-text-editor | [x] | [x] TipTap-based |
| button, card, dialog, input, etc. | [x] shadcn | [ ] Not installed |

---

## Hooks

| Hook | Original | Current | Notes |
|------|----------|---------|-------|
| useAuth | [x] `use-auth.ts` | [x] `useAuth.ts` | Current version is more complete (signUp, signIn, signOut, resetPassword) |
| useDirection | [x] `use-direction.ts` | [ ] | Sets document.dir + lang based on i18n. Currently handled inline per page |
| useFlowBuilder | [x] `use-flow-builder.ts` | [ ] | Full flow state: nodes, edges, load, save, auto-save, toggle active |
| useMobile | [x] `use-mobile.tsx` | [ ] | Responsive breakpoint detection |
| useToast | [x] `use-toast.ts` | [ ] | Toast notification system (sonner in original) |

---

## Dependencies Missing

| Package | Purpose | Original Has | Current Has |
|---------|---------|:---:|:---:|
| @xyflow/react | Flow builder canvas | [x] | [ ] |
| shadcn/ui (components.json) | UI component library | [x] | [ ] |
| zod | Schema validation | [x] | [ ] |
| react-hook-form | Form management | [x] | [ ] |
| recharts | Charts/analytics | [x] | [ ] |
| sonner | Toast notifications | [x] | [ ] |
| next-themes | Theme management | [x] | [ ] |
| date-fns | Date formatting | [x] | [ ] |
| cmdk | Command palette | [x] | [ ] |
| vaul | Drawer component | [x] | [ ] |
| embla-carousel-react | Carousel | [x] | [ ] |
| three / @react-three/fiber | 3D effects (landing) | [x] | [ ] |

**Already in current:** @supabase/supabase-js, @tanstack/react-query, zustand, framer-motion, i18next, react-i18next, lucide-react, @radix-ui/react-accordion, @tiptap/react, @dnd-kit/core, clsx, tailwind-merge, class-variance-authority

---

## n8n Webhooks

| Webhook | Status | Action Needed |
|---------|--------|--------------|
| `clix-deep-scrape` | Working (200) | Wire to BusinessContent page |
| `clix-support-ai` | 404 — no backend | Deploy n8n workflow OR create Supabase edge function |
| `clix-bot-edit-apply` | 404 — legacy | Not needed (bot-edit edge function handles it) |
| `clix-integration-add` | 404 — legacy | Not needed (old architecture) |

---

## Build Priority (suggested order)

1. ~~**AuthGuard + UserLayout + AppSidebar**~~ — DONE
2. **Wire CreateBotPage to webhooks** — form already exists, just needs `callFormSubmission()` + `callScrapeStatus()` polling
3. **Preview page** — core feature, uses `callBotDemo()` + `callBotEditRequest()`
4. **Connect page** — uses `callWClixAPIConnect()`
5. **FaqManager page** — simple CRUD, direct Supabase queries
6. **Settings page** — simple form, direct Supabase queries
7. **BusinessContent page** — similar to CreateBot, uses webhooks
8. **Admin: UserDetails** — uses 2 unused RPCs
9. **Admin: Tickets** — uses `admin_list_tickets` RPC
10. **FlowBuilder** — most complex, needs @xyflow/react + 11 components + useFlowBuilder hook
11. **Admin: FlowManager** — depends on FlowBuilder
12. **Support chat backend** — deploy n8n workflow or create edge function
13. **NotFound page** — low priority
