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
  | "notion_ai_agent"
  | "mor_ai_agent"
  | "condition";

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
  // notion_ai_agent
  agentSystemPrompt?: string;
  agentIntegrationId?: string;
  agentDatabaseId?: string;
  agentTools?: {
    updateNotion?: boolean;
    bookEventDate?: { enabled: boolean; webhookUrl: string };
    calendarCheck?: { enabled: boolean; webhookUrl: string };
    findSlots?: { enabled: boolean; webhookUrl: string };
    createMeeting?: { enabled: boolean; webhookUrl: string };
  };
  // mor_ai_agent — read by flow-webhook's executeMorAiAgent / _shared/lead-storage-helpers.ts.
  // The 3 lead-CRM tools (save_lead / update_lead_status / mark_paid) are always-on in v1;
  // no toggles exposed in the UI.
  systemPrompt?: string;
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
  postFlowPauseEnabled: boolean;
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
  postFlowPauseEnabled: false,
  postFlowPauseMinutes: 1440,
  resetKeyword: "",
  messageDelayEnabled: false,
};

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
  notion_ai_agent: "#10b981",
  mor_ai_agent: "#a855f7",
  condition: "#eab308",
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
  notion_ai_agent: {
    type: "notion_ai_agent",
    agentSystemPrompt: "",
    agentIntegrationId: "",
    agentDatabaseId: "",
    agentTools: {
      updateNotion: true,
      bookEventDate: { enabled: false, webhookUrl: "" },
      calendarCheck: { enabled: false, webhookUrl: "" },
      findSlots: { enabled: false, webhookUrl: "" },
      createMeeting: { enabled: false, webhookUrl: "" },
    },
  },
  mor_ai_agent: {
    type: "mor_ai_agent",
    systemPrompt: "",
  },
};
