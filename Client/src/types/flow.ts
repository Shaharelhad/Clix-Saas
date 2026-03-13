import type { Node, Edge } from "@xyflow/react";
import type { Tables } from "@/types/database";

// ── Node types matching flow-webhook/index.ts ──────────────────
export type FlowNodeType =
  | "start"
  | "text"
  | "image"
  | "buttons"
  | "delay";

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
  // delay
  delayMinutes?: number;
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
  sessionResetEnabled: boolean;
  sessionResetMinutes: number;
  strictMode: boolean;
}

export const DEFAULT_FLOW_SETTINGS: FlowSettings = {
  ignoreGroupChats: true,
  cooldownEnabled: true,
  cooldownMinutes: 60,
  deduplicateMessages: true,
  autoFollowUpEnabled: false,
  autoFollowUpDelayMinutes: 120,
  autoFollowUpMaxCount: 1,
  sessionResetEnabled: false,
  sessionResetMinutes: 1440,
  strictMode: false,
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
};

// Default labels for each node type
export const NODE_DEFAULTS: Record<FlowNodeType, Partial<FlowNodeData>> = {
  start: { type: "start", triggerText: "" },
  text: { type: "text", message: "", continueAuto: false },
  image: { type: "image", message: "", imageUrl: "" },
  buttons: { type: "buttons", message: "", buttons: [] },
  delay: { type: "delay", delayMinutes: 5 },
};
