# CLIX Migration Status

> Tracks what's built vs missing compared to the [original project](https://github.com/Shaharelhad/CLIX-BOT-project).
> **Last updated:** 2026-03-08
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
| Dashboard (/dashboard) | — | [x] `DashboardPage/` | [x] `profiles.bot_status`, `subscriber_sessions`, `flow_message_log`, `callBotDemo()` | Welcome + bot status pill, Active Conversations (master-detail: phone list + message history), Demo Chat (wired to `callBotDemo()`), EditBot (wired to `callBotEditRequest()`) |
| Dashboard: BusinessContent (/dashboard/business-content) | `BusinessContent.tsx` | [x] `BusinessContentSection.tsx` | [x] `callFormUpdate()`, `callScrapeStatus()` | Built as DashboardPage section/sub-route. Dynamic form + scraping |
| Dashboard: FAQ (/dashboard/faq) | `FaqManager.tsx` | [x] `FaqSection.tsx` | [x] Supabase CRUD on `faq_entries` | Built as DashboardPage section/sub-route. Add/edit/delete FAQ entries |
| CreateBot (/create-bot) | `CreateBot.tsx` | [x] `CreateBotPage/` | [x] All 3 sections wired | 3-step wizard: FormSection (`callFormSubmission()` + `callScrapeStatus()`), PreviewSection (`callBotDemo()` + `callBotEditRequest()`), ConnectSection (`callWClixAPIConnect()`) |
| FlowBuilder (/dashboard/flow-builder) | `FlowBuilder.tsx` | [x] `FlowBuilderPage/` | [x] `callFlowDemo()`, Supabase CRUD on `workflows` | @xyflow/react visual editor. 8 node types. `useFlowBuilder` hook. Auto-save. Preview simulator wired to `callFlowDemo()` |
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

## Edge Functions (services/edge-functions.ts)

**STATUS: All 7 functions are wired.**

| Function | Env Key | Backend | Called From | Status |
|----------|---------|---------|-------------|--------|
| `callFormSubmission()` | `VITE_EDGE_FN_FORM_SUBMISSION` | Edge Function (working) | `FormSection.tsx` | [x] Wired |
| `callBotDemo()` | `VITE_EDGE_FN_BOT_DEMO` | Edge Function (working) | `DemoChatSection.tsx`, `PreviewSection.tsx` | [x] Wired |
| `callBotEditRequest()` | `VITE_EDGE_FN_BOT_EDIT_REQUEST` | Edge Function (working) | `EditBotSection.tsx`, `PreviewSection.tsx` | [x] Wired |
| `callWClixAPIConnect()` | `VITE_EDGE_FN_WCLIXAPI_CONNECT` | Edge Function (working) | `ConnectSection.tsx` | [x] Wired |
| `callScrapeStatus()` | `VITE_EDGE_FN_SCRAPE_STATUS` | Edge Function (working) | `FormSection.tsx`, `BusinessContentSection.tsx` | [x] Wired |
| `callFlowDemo()` | `VITE_EDGE_FN_FLOW_DEMO` | Edge Function (working) | `FlowPreviewSimulator.tsx` | [x] Wired |
| `callFormUpdate()` | `VITE_EDGE_FN_FORM_UPDATE` | Edge Function (working) | `BusinessContentSection.tsx` | [x] Wired |

---

## RPC Functions

| Function | Used? | Called From |
|----------|-------|------------|
| `get_my_profile()` | [x] | useAuth.ts |
| `is_admin()` | [ ] | — (AdminGuard checks role from profile instead) |
| `admin_list_profiles(p_status?)` | [x] | AdminApprovalsSection, AdminUsersSection, DashboardSection |
| `admin_get_profile(p_id)` | [ ] | — (needs UserDetails page) |
| `admin_update_profile_status(p_id, p_status)` | [x] | AdminApprovalsSection, DashboardSection |
| `admin_get_counts()` | [x] | DashboardSection |
| `admin_list_tickets()` | [ ] | — (needs Tickets page) |
| `admin_list_user_integrations(p_user_id)` | [ ] | — (needs UserDetails page) |
| `admin_list_form_fields()` | [x] | FormBuilderSection, FormSection, BusinessContentSection |
| `admin_add_form_field(...)` | [x] | FormBuilderSection |
| `admin_update_form_field(...)` | [x] | FormBuilderSection |
| `admin_delete_form_field(p_id)` | [x] | FormBuilderSection |
| `admin_update_field_order(p_id, p_sort_order)` | [x] | FormBuilderSection |
| `admin_get_form_settings()` | [x] | FormBuilderSection, FormSection, BusinessContentSection |
| `admin_update_form_settings(...)` | [x] | FormBuilderSection |
| `search_products(p_user_id, p_query, p_limit?)` | [ ] | — (used server-side by bot-demo edge function) |
| `get_max_revisions(tier)` | [ ] | — (needs Preview/Settings page) |
| `get_monthly_credits(tier)` | [ ] | — (needs Settings page) |
| `publish_bot_changes(p_user_id)` | [x] | EditBotSection (publish button), wclixapi-connect (auto-publish on connect) |
| `discard_bot_draft(p_user_id)` | [x] | EditBotSection (discard button) |

**Summary: 13/19 used, 6 unused**

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

### Flow Builder (14 components — all built)

| Component | Purpose |
|-----------|---------|
| [x] FlowCanvas | @xyflow/react canvas with drag-drop, connections |
| [x] FlowToolbar | Top bar (name, save, status, pause/play) |
| [x] NodePalette | 8 draggable node types with icons |
| [x] NodeEditorSidebar | Dynamic property editor per node type |
| [x] FlowNodeWrapper | Generic node wrapper with colored headers |
| [x] FlowPreviewSimulator | In-browser flow testing via `callFlowDemo()` |
| [x] StartNode | Entry point node with trigger text |
| [x] TextNode | Text message node |
| [x] ImageNode | Image + caption node |
| [x] ButtonsNode | Interactive buttons with per-button handles |
| [x] CollectInputNode | User input collection |
| [x] DelayNode | Timed delay |
| [x] FollowUpNode | Scheduled follow-up |
| [x] ConditionNode | Visual-only branching (no backend execution) |

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
| useFlowBuilder | [x] `use-flow-builder.ts` | [x] `useFlowBuilder.ts` | React Query based: nodes, edges, load, save, auto-save (3s debounce), toggle active, CRUD workflows |
| useMobile | [x] `use-mobile.tsx` | [ ] | Responsive breakpoint detection |
| useToast | [x] `use-toast.ts` | [ ] | Toast notification system (sonner in original) |

---

## Dependencies Missing

| Package | Purpose | Original Has | Current Has |
|---------|---------|:---:|:---:|
| @xyflow/react | Flow builder canvas | [x] | [x] |
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

---

## Build Priority (suggested order)

1. ~~**AuthGuard + UserLayout + AppSidebar**~~ — DONE
2. ~~**Wire CreateBotPage to webhooks**~~ — DONE (FormSection, PreviewSection, ConnectSection all wired)
3. ~~**Preview**~~ — DONE (built as PreviewSection in CreateBotPage, wired to `callBotDemo()` + `callBotEditRequest()`)
4. ~~**Connect**~~ — DONE (built as ConnectSection in CreateBotPage, wired to `callWClixAPIConnect()`)
5. ~~**FaqManager**~~ — DONE (built as FaqSection in DashboardPage, sub-route `/dashboard/faq`)
6. ~~**BusinessContent**~~ — DONE (built as BusinessContentSection in DashboardPage, sub-route `/dashboard/business-content`)
7. **Settings page** — simple form, direct Supabase queries
8. **Admin: UserDetails** — uses 2 unused RPCs
9. **Admin: Tickets** — uses `admin_list_tickets` RPC
10. ~~**FlowBuilder**~~ — DONE (FlowBuilderPage with 14 components + useFlowBuilder hook + callFlowDemo() wired)
11. **Admin: FlowManager** — depends on FlowBuilder
12. **NotFound page** — low priority
