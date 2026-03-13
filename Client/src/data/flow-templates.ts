import {
  FileText,
  ClipboardList,
  CalendarCheck,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import type { FlowJSON } from "@/types/flow";
import { DEFAULT_FLOW_SETTINGS } from "@/types/flow";

export interface FlowTemplate {
  id: string;
  nameKey: string;
  descKey: string;
  icon: LucideIcon;
  flowJson: FlowJSON;
}

// ── Helper: build linear edges between ordered node IDs ──────
function linearEdges(ids: string[]) {
  return ids.slice(1).map((target, i) => ({
    id: `e-${ids[i]}-${target}`,
    source: ids[i],
    target,
    type: "smoothstep" as const,
    animated: true,
  }));
}

// ── Y position helper (vertical waterfall) ───────────────────
const X = 400;
const Y_START = 50;
const Y_GAP = 150;
const yAt = (i: number) => Y_START + i * Y_GAP;

// ═══════════════════════════════════════════════════════════════
// Templates
// ═══════════════════════════════════════════════════════════════

const blankFlow: FlowJSON = {
  nodes: [
    {
      id: "start-default",
      type: "start",
      position: { x: X, y: Y_START },
      data: { type: "start", triggerText: "" },
    },
  ],
  edges: [],
  settings: { ...DEFAULT_FLOW_SETTINGS },
};

// ── Lead Collection ──────────────────────────────────────────
const leadIds = [
  "lead-start",
  "lead-ask-name",
  "lead-ask-phone",
  "lead-ask-email",
  "lead-thanks",
];

const leadCollectionFlow: FlowJSON = {
  nodes: [
    {
      id: leadIds[0],
      type: "start",
      position: { x: X, y: yAt(0) },
      data: { type: "start", triggerText: "" },
    },
    {
      id: leadIds[1],
      type: "text",
      position: { x: X, y: yAt(1) },
      data: {
        type: "text",
        message: "שלום! אשמח לעזור 😊 מה השם שלך?",
        continueAuto: true,
      },
    },
    {
      id: leadIds[2],
      type: "text",
      position: { x: X, y: yAt(2) },
      data: {
        type: "text",
        message: "נעים מאוד! מה מספר הטלפון שלך?",
        continueAuto: true,
      },
    },
    {
      id: leadIds[3],
      type: "text",
      position: { x: X, y: yAt(3) },
      data: {
        type: "text",
        message: "מעולה! מה כתובת המייל שלך?",
        continueAuto: true,
      },
    },
    {
      id: leadIds[4],
      type: "text",
      position: { x: X, y: yAt(4) },
      data: {
        type: "text",
        message: "תודה רבה! נציג ייצור איתך קשר בהקדם 🙏",
      },
    },
  ],
  edges: linearEdges(leadIds),
  settings: { ...DEFAULT_FLOW_SETTINGS, strictMode: true },
};

// ── Appointment Booking ──────────────────────────────────────
const apptIds = [
  "appt-start",
  "appt-greeting",
  "appt-service",
  "appt-time",
  "appt-confirm",
];

const appointmentFlow: FlowJSON = {
  nodes: [
    {
      id: apptIds[0],
      type: "start",
      position: { x: X, y: yAt(0) },
      data: { type: "start", triggerText: "" },
    },
    {
      id: apptIds[1],
      type: "text",
      position: { x: X, y: yAt(1) },
      data: {
        type: "text",
        message: "שלום! נשמח לקבוע לך תור. איזה שירות מעניין אותך?",
        continueAuto: true,
      },
    },
    {
      id: apptIds[2],
      type: "buttons",
      position: { x: X, y: yAt(2) },
      data: {
        type: "buttons",
        message: "בחר את סוג השירות:",
        buttons: [
          { id: "btn-consult", label: "ייעוץ" },
          { id: "btn-treatment", label: "טיפול" },
          { id: "btn-other", label: "אחר" },
        ],
      },
    },
    {
      id: apptIds[3],
      type: "text",
      position: { x: X, y: yAt(3) },
      data: {
        type: "text",
        message: "מתי נוח לך? (תאריך ושעה)",
        continueAuto: true,
      },
    },
    {
      id: apptIds[4],
      type: "text",
      position: { x: X, y: yAt(4) },
      data: {
        type: "text",
        message: "מעולה! ניצור איתך קשר לאישור התור. תודה! 🙏",
      },
    },
  ],
  edges: linearEdges(apptIds),
  settings: { ...DEFAULT_FLOW_SETTINGS, strictMode: true },
};

// ── Product Inquiry ──────────────────────────────────────────
const prodIds = [
  "prod-start",
  "prod-greeting",
  "prod-category",
  "prod-budget",
  "prod-thanks",
];

const productInquiryFlow: FlowJSON = {
  nodes: [
    {
      id: prodIds[0],
      type: "start",
      position: { x: X, y: yAt(0) },
      data: { type: "start", triggerText: "" },
    },
    {
      id: prodIds[1],
      type: "text",
      position: { x: X, y: yAt(1) },
      data: {
        type: "text",
        message: "היי! 👋 אשמח לעזור לך למצוא את המוצר המתאים.",
        continueAuto: true,
      },
    },
    {
      id: prodIds[2],
      type: "buttons",
      position: { x: X, y: yAt(2) },
      data: {
        type: "buttons",
        message: "מה מעניין אותך?",
        buttons: [
          { id: "btn-prod-a", label: "מוצר א׳" },
          { id: "btn-prod-b", label: "מוצר ב׳" },
          { id: "btn-prod-c", label: "מוצר ג׳" },
        ],
      },
    },
    {
      id: prodIds[3],
      type: "text",
      position: { x: X, y: yAt(3) },
      data: {
        type: "text",
        message: "מה התקציב שלך?",
        continueAuto: true,
      },
    },
    {
      id: prodIds[4],
      type: "text",
      position: { x: X, y: yAt(4) },
      data: {
        type: "text",
        message: "תודה! נחזור אליך עם הצעה מותאמת 🎯",
      },
    },
  ],
  edges: linearEdges(prodIds),
  settings: { ...DEFAULT_FLOW_SETTINGS, strictMode: true },
};

// ═══════════════════════════════════════════════════════════════

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: "lead-collection",
    nameKey: "templateLeadCollection",
    descKey: "templateLeadCollectionDesc",
    icon: ClipboardList,
    flowJson: leadCollectionFlow,
  },
  {
    id: "appointment",
    nameKey: "templateAppointment",
    descKey: "templateAppointmentDesc",
    icon: CalendarCheck,
    flowJson: appointmentFlow,
  },
  {
    id: "product-inquiry",
    nameKey: "templateProductInquiry",
    descKey: "templateProductInquiryDesc",
    icon: ShoppingBag,
    flowJson: productInquiryFlow,
  },
  {
    id: "blank",
    nameKey: "templateBlank",
    descKey: "templateBlankDesc",
    icon: FileText,
    flowJson: blankFlow,
  },
];
