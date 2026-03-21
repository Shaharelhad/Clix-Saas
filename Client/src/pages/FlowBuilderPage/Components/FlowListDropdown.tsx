import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import type { Workflow } from "@/types/flow";

const MAX_WORKFLOWS = 5;

interface FlowListDropdownProps {
  workflows: Workflow[];
  activeWorkflowId: string | null;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  onNewFlow: () => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function FlowListDropdown({
  workflows,
  activeWorkflowId,
  onSwitch,
  onDelete,
  onNewFlow,
  onClose,
  triggerRef,
}: FlowListDropdownProps) {
  const { t } = useTranslation("flow");
  const ref = useRef<HTMLDivElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Close on click outside (ignore clicks on the trigger button)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef?.current?.contains(e.target as Node)) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, triggerRef]);

  const atLimit = workflows.length >= MAX_WORKFLOWS;

  return (
    <div
      ref={ref}
      dir="rtl"
      className="absolute top-full mt-1 start-0 w-72 bg-white border border-[#EDE6DD] rounded-xl shadow-lg z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#EDE6DD]/60">
        <span className="text-xs font-bold text-[#7A7267]">{t("flowList")}</span>
      </div>

      {/* Workflow list */}
      <div className="max-h-64 overflow-y-auto">
        {workflows.map((w) => {
          const isActive = w.id === activeWorkflowId;
          const isPublished = w.status === "active";
          const isConfirming = confirmDeleteId === w.id;

          return (
            <div
              key={w.id}
              className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                isActive
                  ? "bg-[#FFF5F0] border-e-2 border-[#FF7E47]"
                  : "hover:bg-[#FAF7F3]"
              }`}
              onClick={() => {
                onSwitch(w.id);
                onClose();
              }}
            >
              {/* Name + status */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#2D2A26] truncate">{w.name}</p>
              </div>

              {/* Status badge */}
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                  w.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : w.status === "paused"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {w.status === "active" ? t("live") : t(w.status)}
              </span>

              {/* Delete button */}
              {isConfirming ? (
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(w.id);
                      setConfirmDeleteId(null);
                      onClose();
                    }}
                    className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100 cursor-pointer"
                  >
                    {t("confirmDelete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-[10px] text-[#7A7267] px-1 py-0.5 rounded hover:bg-[#EDE6DD]/40 cursor-pointer"
                  >
                    {t("cancel")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPublished) return;
                    setConfirmDeleteId(w.id);
                  }}
                  title={isPublished ? t("cannotDeleteActive") : t("deleteFlow")}
                  className={`p-1 rounded shrink-0 ${
                    isPublished
                      ? "text-[#D5CFC7] cursor-not-allowed"
                      : "text-[#A39B90] hover:text-red-500 hover:bg-red-50 cursor-pointer"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* New Flow button */}
      <div className="border-t border-[#EDE6DD]/60 p-2">
        <button
          type="button"
          onClick={() => {
            if (atLimit) return;
            onNewFlow();
            onClose();
          }}
          disabled={atLimit}
          title={atLimit ? t("maxFlowsReached") : t("newFlow")}
          className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-bold transition-colors ${
            atLimit
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-[#FF7E47] text-white hover:bg-[#E86D3A] cursor-pointer"
          }`}
        >
          <Plus className="w-4 h-4" />
          {atLimit ? t("maxFlowsReached") : t("newFlow")}
        </button>
      </div>
    </div>
  );
}
