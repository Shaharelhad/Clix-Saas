import type { DragEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  MessageSquareText,
  MessageSquare,
  Image,
  SquareMousePointer,
  Clock,
  TextCursorInput,
  Globe,
  Languages,
} from "lucide-react";
import { NODE_COLORS, type FlowNodeType } from "@/types/flow";

const PALETTE_ITEMS: { type: FlowNodeType; icon: typeof MessageSquareText; labelKey: string; descKey: string }[] = [
  { type: "start", icon: MessageSquareText, labelKey: "nodeStart", descKey: "nodeStartDesc" },
  { type: "text", icon: MessageSquare, labelKey: "nodeText", descKey: "nodeTextDesc" },
  { type: "image", icon: Image, labelKey: "nodeImage", descKey: "nodeImageDesc" },
  { type: "buttons", icon: SquareMousePointer, labelKey: "nodeButtons", descKey: "nodeButtonsDesc" },
  { type: "delay", icon: Clock, labelKey: "nodeDelay", descKey: "nodeDelayDesc" },
  { type: "collect_input", icon: TextCursorInput, labelKey: "nodeCollectInput", descKey: "nodeCollectInputDesc" },
  { type: "language", icon: Languages, labelKey: "nodeLanguage", descKey: "nodeLanguageDesc" },
  { type: "api_call", icon: Globe, labelKey: "nodeApiCall", descKey: "nodeApiCallDesc" },
];

interface NodePaletteProps {
  isLocked: boolean;
  onLockedDrag: () => void;
  strictMode: boolean;
}

export default function NodePalette({ isLocked, onLockedDrag, strictMode }: NodePaletteProps) {
  const { t } = useTranslation("flow");

  const onDragStart = (e: DragEvent, type: FlowNodeType) => {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-56 bg-white border-s border-[#EDE6DD]/60 p-3 overflow-y-auto">
      <h3 className="text-xs font-bold text-[#2D2A26] mb-3 px-1">
        {t("pageTitle")}
      </h3>
      <div className="flex flex-col gap-2">
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          const color = NODE_COLORS[item.type];
          const isStartBlocked = item.type === "start" && strictMode;
          const isItemDisabled = isLocked || isStartBlocked;
          return (
            <div
              key={item.type}
              draggable={!isItemDisabled}
              onDragStart={isItemDisabled ? undefined : (e) => onDragStart(e, item.type)}
              onClick={isLocked ? onLockedDrag : undefined}
              title={isStartBlocked ? t("cannotAddStartStrictMode") : undefined}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg border border-[#EDE6DD]/60 transition-all ${
                isItemDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-[#FF7E47]/30 hover:bg-[#FFF5F0]/50 cursor-grab active:cursor-grabbing"
              }`}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#2D2A26] truncate">
                  {t(item.labelKey)}
                </p>
                <p className="text-[10px] text-[#A39B90] truncate">
                  {t(item.descKey)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
