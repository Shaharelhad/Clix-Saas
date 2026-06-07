import type { Node, Edge } from "@xyflow/react";
import type { Tables } from "@/types/database";

// ── Node types matching flow-webhook/index.ts ──────────────────
export type FlowNodeType =
  | "start"
  | "text"
  | "image"
  | "buttons"
  | "delay"
  | "open_bot"
  | "collect_input"
  | "api_call"
  | "language"
  | "ai_router"
  | "mor_ai_agent"
  | "condition"
  | "list";

export interface ButtonItem {
  id: string;
  label: string;
  openBot?: boolean;
}

// ── Condition node: multi-rule + AND/OR combinator ──
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "exists"
  | "not_exists"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty";

export interface ConditionRule {
  id: string;
  variable: string;
  operator: ConditionOperator;
  value?: string;
}

export type ConditionCombinator = "AND" | "OR";

export interface FlowNodeData extends Record<string, unknown> {
  type: FlowNodeType;
  label?: string;
  // start
  triggerText?: string;
  triggerKeywords?: string[];
  disabled?: boolean;
  // text / image / buttons / collect_input
  message?: string;
  expectedReply?: string;
  /**
   * @deprecated Legacy "wait for any reply" flag — wait-for-any-reply is now the
   * default for text nodes, so this field is a no-op for new nodes. Kept on the
   * type for backward-compat with older flow JSON in the database.
   */
  continueAuto?: boolean;
  /**
   * Text-node auto-continue: when true, send the message and immediately advance
   * to the next node without waiting for a customer reply. Default false = wait
   * for any reply before continuing.
   */
  autoContinue?: boolean;
  // image
  imageUrl?: string;
  // buttons
  buttons?: ButtonItem[];
  buttonHeader?: string;
  buttonFooter?: string;
  isGlobalMenu?: boolean;
  // buttons — save clicked button label into a session variable for later condition gating
  answerVariable?: string;
  // condition — pure routing node, evaluates session variables
  // New shape: list of rules joined by AND/OR. Legacy single-rule fields kept for migration.
  conditionRules?: ConditionRule[];
  conditionCombinator?: ConditionCombinator;
  /** @deprecated use conditionRules instead */
  conditionVariable?: string;
  /** @deprecated use conditionRules instead */
  conditionOperator?: ConditionOperator;
  /** @deprecated use conditionRules instead */
  conditionValue?: string;
  // text / image — yes/no question mode
  yesNoMode?: boolean;
  // collect_input
  variableName?: string;
  expectedAnswer?: string;
  outputFormat?: string;
  // text (expectedReply) & collect_input — allow customer to refuse answering
  allowSkip?: boolean;
  // delay
  delayMinutes?: number;
  // open_bot (auto-created by button toggle)
  linkedButtonId?: string;
  linkedNodeId?: string;
  // api_call
  outputCurrency?: "USD" | "ILS";
  outputLanguage?: "en" | "he";
  integrationId?: string;
  endpoint?: string;
  method?: string;
  bodyTemplate?: string;
  responseMapping?: Array<{ jsonPath: string; variableName: string }>;
  errorMessage?: string;
  // api_call — operation mode
  operationId?: string;
  inputValues?: Record<string, string>;
  serviceType?: string;
  // ai_router
  routerIntents?: Array<{ id: string; label: string; description: string }>;
  routerContext?: string;
  // mor_ai_agent — read by flow-webhook's executeMorAiAgent / _shared/lead-storage-helpers.ts.
  // The 3 lead-CRM tools (save_lead / update_lead_status / mark_paid) are always-on in v1;
  // no toggles exposed in the UI.
  systemPrompt?: string;
  // list — WhatsApp list message. On reply, the tapped row's rowId + title
  // are written into the two named session variables.
  //
  // listSource modes:
  //   - "from_variable" (default) — sections+rows come from listDataVariable
  //     (typically populated by a preceding api_call node).
  //   - "calendar_months" — auto-generated month picker (current month through
  //     Dec of next year). Ignores listDataVariable.
  //   - "calendar_days" — auto-generated day picker for the month stored in
  //     listMonthVariable (rowId of a previous calendar_months pick).
  listBody?: string;
  listButtonText?: string;
  listHeader?: string;
  listFooter?: string;
  listDataVariable?: string;
  listRowIdVariable?: string;
  listTitleVariable?: string;
  listSource?: "from_variable" | "calendar_months" | "calendar_days";
  listMonthVariable?: string;
}

// XYFlow typed node / edge
export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowEdge = Edge;

// ── Workflow-level settings (pre-processing guards) ────────
export interface FlowSettings {
  ignoreGroupChats: boolean;
  cooldownEnabled: boolean;
  cooldownMode: "temporary" | "permanent";
  cooldownMinutes: number;
  deduplicateMessages: boolean;
  autoFollowUpEnabled: boolean;
  autoFollowUpDelayMinutes: number;
  autoFollowUpMaxCount: number;
  autoFollowUpMode: "bot" | "custom";
  autoFollowUpCustomMessages: string[];
  sessionResetEnabled: boolean;
  sessionResetMinutes: number;
  strictMode: boolean;
  flowLanguage: string;
  llmModel?: string;
  postFlowPauseEnabled: boolean;
  postFlowPauseMode: "temporary" | "permanent";
  postFlowPauseMinutes: number;
  resetKeyword: string;
  messageDelayEnabled: boolean;
}

export const DEFAULT_FLOW_SETTINGS: FlowSettings = {
  ignoreGroupChats: true,
  cooldownEnabled: true,
  cooldownMode: "temporary",
  cooldownMinutes: 60,
  deduplicateMessages: true,
  autoFollowUpEnabled: false,
  autoFollowUpDelayMinutes: 120,
  autoFollowUpMaxCount: 1,
  autoFollowUpMode: "bot",
  autoFollowUpCustomMessages: [],
  sessionResetEnabled: false,
  sessionResetMinutes: 1440,
  strictMode: false,
  flowLanguage: "he",
  llmModel: "",
  postFlowPauseEnabled: false,
  postFlowPauseMode: "temporary",
  postFlowPauseMinutes: 1440,
  resetKeyword: "",
  messageDelayEnabled: false,
};

// ── Per-bot LLM model selector ─────────────────────────────
// OpenRouter slugs validated live against /api/v1/models on 2026-06-07.
// Re-validate before deploy (catalog slugs change over time).
export interface LLMModelOption {
  value: string;
  label: string;
}
export interface LLMModelGroup {
  labelKey: string;
  models: LLMModelOption[];
}

export const LLM_MODEL_GROUPS: LLMModelGroup[] = [
  {
    labelKey: "modelGroupGemini",
    models: [
      { value: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)" },
      { value: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
      { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (preview)" },
      { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
    ],
  },
  {
    labelKey: "modelGroupGpt",
    models: [
      { value: "openai/gpt-5.5", label: "GPT-5.5" },
      { value: "openai/gpt-5.4", label: "GPT-5.4" },
      { value: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
      { value: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano" },
      { value: "openai/gpt-5.3-chat", label: "GPT-5.3 Chat" },
      { value: "openai/gpt-5.2", label: "GPT-5.2" },
      { value: "openai/gpt-5.2-chat", label: "GPT-5.2 Chat" },
      { value: "openai/gpt-5.1", label: "GPT-5.1" },
      { value: "openai/gpt-5.1-chat", label: "GPT-5.1 Chat" },
      { value: "openai/gpt-5", label: "GPT-5" },
      { value: "openai/gpt-5-chat", label: "GPT-5 Chat" },
      { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
      { value: "openai/gpt-5-nano", label: "GPT-5 Nano" },
      { value: "openai/gpt-4.1", label: "GPT-4.1" },
      { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { value: "openai/gpt-4.1-nano", label: "GPT-4.1 Nano" },
      { value: "openai/gpt-4o", label: "GPT-4o" },
      { value: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
    ],
  },
  {
    labelKey: "modelGroupReasoning",
    models: [
      { value: "openai/o4-mini", label: "o4-mini (slower)" },
      { value: "openai/o3", label: "o3 (slower)" },
    ],
  },
  {
    labelKey: "modelGroupClaude",
    models: [
      { value: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8" },
      { value: "anthropic/claude-opus-4.7", label: "Claude Opus 4.7" },
      { value: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6" },
      { value: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5" },
      { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
      { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
      { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
      { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
      { value: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
      { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
    ],
  },
  {
    labelKey: "modelGroupGrok",
    models: [
      { value: "x-ai/grok-4.3", label: "Grok 4.3" },
      { value: "x-ai/grok-4.20", label: "Grok 4.20" },
    ],
  },
  {
    labelKey: "modelGroupDeepseek",
    models: [
      { value: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro" },
      { value: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash" },
      { value: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
      { value: "deepseek/deepseek-chat-v3.1", label: "DeepSeek V3.1" },
      { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
    ],
  },
];

export interface FlowJSON {
  nodes: FlowNode[];
  edges: FlowEdge[];
  settings?: FlowSettings;
}

// Database row type
export type Workflow = Tables<"workflows">;

// Node color mapping
export const NODE_COLORS: Record<FlowNodeType, string> = {
  start: "#22c55e",
  text: "#3b82f6",
  image: "#a855f7",
  buttons: "#f59e0b",
  delay: "#6b7280",
  open_bot: "#8B5CF6",
  collect_input: "#06b6d4",
  api_call: "#ec4899",
  language: "#2563eb",
  ai_router: "#f97316",
  mor_ai_agent: "#a855f7",
  condition: "#eab308",
  list: "#f59e0b",
};

// Default labels for each node type
export const NODE_DEFAULTS: Record<FlowNodeType, Partial<FlowNodeData>> = {
  start: { type: "start", triggerText: "" },
  text: { type: "text", message: "", continueAuto: false },
  image: { type: "image", message: "", imageUrl: "" },
  buttons: { type: "buttons", message: "", buttons: [], buttonHeader: "", buttonFooter: "" },
  delay: { type: "delay", delayMinutes: 5 },
  open_bot: { type: "open_bot" },
  collect_input: { type: "collect_input", message: "", variableName: "" },
  api_call: { type: "api_call", method: "GET", endpoint: "", responseMapping: [], errorMessage: "" },
  language: { type: "language", message: "" },
  ai_router: {
    type: "ai_router",
    routerIntents: [
      { id: "intent_1", label: "", description: "" },
    ],
    routerContext: "",
  },
  condition: {
    type: "condition",
    conditionCombinator: "AND",
    conditionRules: [
      { id: "rule_1", variable: "", operator: "equals", value: "" },
    ],
  },
  mor_ai_agent: {
    type: "mor_ai_agent",
    systemPrompt: "",
  },
  list: {
    type: "list",
    listBody: "",
    listButtonText: "",
    listDataVariable: "",
    listRowIdVariable: "",
  },
};
