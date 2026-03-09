import type { Node, Edge } from "@xyflow/react";
import type { Tables } from "@/types/database";

// ── Node types matching flow-webhook/index.ts ──────────────────
export type FlowNodeType =
  | "start"
  | "text"
  | "image"
  | "buttons"
  | "collect_input"
  | "delay"
  | "follow_up"
  | "condition"; // visual-only — no backend execution yet

export interface ButtonItem {
  id: string;
  label: string;
}

export interface FlowNodeData extends Record<string, unknown> {
  type: FlowNodeType;
  label?: string;
  // start
  triggerText?: string;
  // text / image / buttons / collect_input
  message?: string;
  expectedReply?: string;
  continueAuto?: boolean;
  // image
  imageUrl?: string;
  // buttons
  buttons?: ButtonItem[];
  // collect_input
  variableName?: string;
  // delay / follow_up
  delayMinutes?: number;
  followUpMessage?: string;
  // condition (visual-only)
  variable?: string;
  operator?: "equals" | "contains" | "not_empty";
  value?: string;
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
}

export const DEFAULT_FLOW_SETTINGS: FlowSettings = {
  ignoreGroupChats: true,
  cooldownEnabled: true,
  cooldownMinutes: 60,
  deduplicateMessages: true,
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
  collect_input: "#06b6d4",
  delay: "#6b7280",
  follow_up: "#ec4899",
  condition: "#ef4444",
};

// Default labels for each node type
export const NODE_DEFAULTS: Record<FlowNodeType, Partial<FlowNodeData>> = {
  start: { type: "start", triggerText: "" },
  text: { type: "text", message: "", continueAuto: false },
  image: { type: "image", message: "", imageUrl: "" },
  buttons: { type: "buttons", message: "", buttons: [] },
  collect_input: { type: "collect_input", message: "", variableName: "" },
  delay: { type: "delay", delayMinutes: 5 },
  follow_up: { type: "follow_up", followUpMessage: "", delayMinutes: 30 },
  condition: { type: "condition", variable: "", operator: "equals", value: "" },
};
