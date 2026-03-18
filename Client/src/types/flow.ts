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
  | "language";

export interface ButtonItem {
  id: string;
  label: string;
  openBot?: boolean;
}

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
  continueAuto?: boolean;
  // image
  imageUrl?: string;
  // buttons
  buttons?: ButtonItem[];
  buttonHeader?: string;
  buttonFooter?: string;
  isGlobalMenu?: boolean;
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
}

// XYFlow typed node / edge
export type FlowNode = Node<FlowNodeData, FlowNodeType>;
export type FlowEdge = Edge;

// ── Workflow-level settings (pre-processing guards) ────────
export interface FlowSettings {
  ignoreGroupChats: boolean;
  cooldownEnabled: boolean;
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
}

export const DEFAULT_FLOW_SETTINGS: FlowSettings = {
  ignoreGroupChats: true,
  cooldownEnabled: true,
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
};
