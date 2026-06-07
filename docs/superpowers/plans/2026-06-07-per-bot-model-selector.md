# Per-Bot LLM Model Selector — As-Built (2026-06-07)

**Status: SHIPPED & DEPLOYED.** Per-bot model dropdown in Flow Settings + system default switched to Gemini 2.5 Pro (with `ruppinai@gmail.com` pinned to Flash).

## What it does
- A **Bot model** dropdown in the Flow Settings modal (visible to everyone) writes an OpenRouter slug to `workflows.flow_json.settings.llmModel`. Empty = system default.
- The three main-reply paths pass it into `callLLMEngine` as `config.model`. Unset bots use the engine default.
- **System default is now `google/gemini-2.5-pro`** (was `google/gemini-2.5-flash`, commit `228baeb`). Changed in `_shared/llm-engine.ts`.
- **Exception:** `ruppinai@gmail.com`'s workflow (`ecd7cf2e-d4d4-4ed2-8f30-99b2d28452ee`, "שיחה חופשית") is pinned to `google/gemini-2.5-flash` via `flow_json.settings.llmModel` so it stays on Flash.

## Files changed
**Frontend**
- `Client/src/types/flow.ts` — `FlowSettings.llmModel?: string`, `DEFAULT_FLOW_SETTINGS.llmModel: ""`, and `LLM_MODEL_GROUPS` catalog (44 slugs, 6 provider groups).
- `Client/src/pages/FlowBuilderPage/Components/FlowSettingsModal.tsx` — `<select>` with `<optgroup>`s, as the first (primary) control. Auto-saves via the existing debounced `saveMutation`.
- `Client/src/i18n/locales/{en,he}/flow.ts` — `settingsLlmModel*` + `modelGroup*` keys. Default label = "System default (Gemini 2.5 Pro)".

**Backend** (per-bot override = main reply only; helper calls unchanged)
- `_shared/llm-engine.ts` — engine default `google/gemini-2.5-flash` → `google/gemini-2.5-pro` (one line; fallback logic now resolves pro→flash). Bundled into every consumer, so all were redeployed.
- `flow-webhook/index.ts` — `FlowSettings.llmModel?`; `getFlowSettings` returns it; `callOpenLLM` **self-fetches** the override by `workflowId` (placed after the `USE_INNGEST` early-return, so Inngest-mode prod pays no extra query) and passes `{ model }`. Avoided editing all 16 call sites.
- `inngest/index.ts` — `FlowSettings.llmModel?`; `callLLMForAgent` builds `effectiveConfig = { ...agentConfig, model: agentConfig?.model || flow.settings?.llmModel || undefined }`. This makes the `llm_fallback` path honor the per-bot model while leaving agent-node models (Mor) intact.
- `flow-demo/index.ts` — `callLLMFallback` gains a `modelOverride?` param; the handler reads `flow.settings.llmModel` once and threads it to all 5 post-load call sites.

## Model catalog (validated live against OpenRouter `/api/v1/models` on 2026-06-07 — all 44 present)
Default option (`""`) + groups: **Gemini** (3.5-flash, 3.1-pro-preview, 3.1-flash-lite, 3-flash-preview, 2.5-pro, 2.5-flash, 2.5-flash-lite) · **GPT** (5.5, 5.4/-mini/-nano, 5.3-chat, 5.2/-chat, 5.1/-chat, 5/-chat/-mini/-nano, 4.1/-mini/-nano, 4o/-mini) · **OpenAI reasoning** (o4-mini, o3 — slower) · **Claude** (opus 4.8/4.7/4.6/4.5, sonnet 4.6/4.5/4, haiku 4.5, 3.5-haiku, 3-haiku) · **Grok** (4.3, 4.20) · **DeepSeek** (v4-pro, v4-flash, v3.2, chat-v3.1, chat).
> Note: memory's old `x-ai/grok-4.1-fast` was **gone** from the catalog — replaced with `grok-4.3`/`grok-4.20`. Always re-validate slugs; the dropdown only ships catalog-confirmed ones.

## Safety invariant
The per-bot override is inert unless `llmModel` is set (`… || undefined` everywhere). The system-default change is the only thing that moved existing bots (Flash→Pro), per explicit instruction; ruppinai was pre-pinned to Flash in the DB **before** the deploy so it never saw Pro. A bad slug self-heals via the engine's existing fallback retry.

## Verification performed
- Frontend `npm run build` green.
- `node scripts/check-shared-exports.mjs` exit 0; all 4 edited files esbuild syntax-OK.
- All 44 dropdown slugs confirmed present in the live OpenRouter catalog (0 missing).
- DB: only ruppinai has `llmModel` set (`google/gemini-2.5-flash`); 11 active workflows, 10 fall through to the Pro default.
- Deployed `flow-demo`, `flow-webhook`, `inngest`, `bot-demo` with `--no-verify-jwt`; OPTIONS boot-check: flow-webhook/bot-demo/flow-demo 200, inngest 405 (framework handled → booted).
- **Not tested:** a live WhatsApp reply (would require messaging a real customer number) and a full flow-demo reply (requires a user JWT; minting a customer token was declined as out-of-scope). Confidence rests on boot + DB + catalog + additive-wiring review.

## Out of scope / future
- Per-bot override controls the **main reply** only; helper calls (classifyTrigger/validate/translate) untouched.
- No backend allowlist (dropdown constrains choices; engine fallback covers a bad slug).
- No `reasoning` param yet — "thinks-by-default" models (Pro, o-series, etc.) add latency; a future `reasoning:{effort}` could tame it.

## Git
Code changes are uncommitted on `dev` as of writing (Phase 1 commits `6c7c6cb`, `84bce84` also unpushed). Commit/push pending user request.
