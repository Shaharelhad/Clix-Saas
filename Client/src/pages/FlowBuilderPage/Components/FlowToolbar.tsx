import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Check, Upload, CircleStop, Settings, Plug, ChevronDown, Undo2, Redo2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Workflow } from "@/types/flow";
import FlowListDropdown from "./FlowListDropdown";

interface FlowToolbarProps {
  workflowName: string;
  workflowStatus: string;
  onNameChange: (name: string) => void;
  onToggleStatus: () => void;
  onOpenSettings: () => void;
  onOpenIntegrations: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  isLocked: boolean;
  // Undo/redo
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Multi-workflow
  workflows: Workflow[];
  activeWorkflowId: string | null;
  onSwitchWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
  onNewFlow: () => void;
}

export default function FlowToolbar({
  workflowName,
  workflowStatus,
  onNameChange,
  onToggleStatus,
  onOpenSettings,
  onOpenIntegrations,
  saveStatus,
  isLocked,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  workflows,
  activeWorkflowId,
  onSwitchWorkflow,
  onDeleteWorkflow,
  onNewFlow,
}: FlowToolbarProps) {
  const { t } = useTranslation("flow");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);

  const isPublishing = workflowStatus !== "active";

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-[#EDE6DD]/60 shrink-0">
        {/* Left: name + status */}
        <div className="flex items-center gap-3">
          {/* Editable name + dropdown trigger */}
          <div className="relative flex items-center gap-1">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => onNameChange(e.target.value)}
              readOnly={isLocked}
              className={`text-sm font-bold text-[#2D2A26] bg-transparent border-b border-transparent ${
                isLocked
                  ? "cursor-default opacity-60"
                  : "hover:border-[#EDE6DD] focus:border-[#FF7E47]"
              } outline-none px-1 py-0.5 transition-colors`}
              dir="rtl"
            />
            <button
              type="button"
              ref={dropdownTriggerRef}
              onClick={() => setShowDropdown((v) => !v)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#EDE6DD]/40 cursor-pointer"
            >
              <span className="text-[11px] text-[#A39B90]">{t("switchFlow")}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#A39B90] transition-transform ${showDropdown ? "rotate-180" : ""}`} />
            </button>
            {showDropdown && (
              <FlowListDropdown
                workflows={workflows}
                activeWorkflowId={activeWorkflowId}
                onSwitch={onSwitchWorkflow}
                onDelete={onDeleteWorkflow}
                onNewFlow={onNewFlow}
                onClose={() => setShowDropdown(false)}
                triggerRef={dropdownTriggerRef}
              />
            )}
          </div>

          {/* Status badge */}
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              workflowStatus === "active"
                ? "bg-emerald-100 text-emerald-700"
                : workflowStatus === "paused"
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {workflowStatus === "active" ? t("live") : t(workflowStatus)}
          </span>

          {/* Settings */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded hover:bg-[#EDE6DD]/40 cursor-pointer"
            title={t("settingsTitle")}
            aria-label={t("settingsTitle")}
          >
            <Settings className="w-4 h-4 text-[#7A7267]" />
          </button>

          {/* Integrations */}
          <button
            type="button"
            onClick={onOpenIntegrations}
            className="p-1.5 rounded hover:bg-[#EDE6DD]/40 cursor-pointer"
            title={t("integrationsTitle", { ns: "dashboard" })}
            aria-label={t("integrationsTitle", { ns: "dashboard" })}
          >
            <Plug className="w-4 h-4 text-[#7A7267]" />
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 border-e border-[#EDE6DD]/60 pe-2 me-1">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1.5 rounded hover:bg-[#EDE6DD]/40 disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors"
              title={`${t("undo")} (Ctrl+Z)`}
              aria-label={t("undo")}
            >
              <Undo2 className="w-4 h-4 text-[#7A7267]" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1.5 rounded hover:bg-[#EDE6DD]/40 disabled:opacity-30 disabled:cursor-default cursor-pointer transition-colors"
              title={`${t("redo")} (Ctrl+Shift+Z)`}
              aria-label={t("redo")}
            >
              <Redo2 className="w-4 h-4 text-[#7A7267]" />
            </button>
          </div>

          {/* Auto-save indicator */}
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-[10px] text-[#A39B90]">
              <Loader2 className="w-3 h-3 animate-spin" /> {t("saving")}
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600">
              <Check className="w-3 h-3" /> {t("autoSaved")}
            </span>
          )}

          {/* Publish / Unpublish */}
          {workflowStatus === "active" ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <CircleStop className="w-4 h-4" /> {t("unpublish")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" /> {t("publish")}
            </button>
          )}
        </div>
      </div>

      {/* Publish/Unpublish confirmation dialog */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 space-y-4"
              dir="rtl"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    isPublishing ? "bg-emerald-50" : "bg-amber-50"
                  }`}
                >
                  {isPublishing ? (
                    <Upload className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <CircleStop className="w-5 h-5 text-amber-600" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-[#2D2A26]">
                  {isPublishing ? t("publish") : t("unpublish")}
                </h3>
              </div>
              <p className="text-sm text-[#7A7267]">
                {isPublishing ? t("publishConfirm") : t("unpublishConfirm")}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#EDE6DD] text-sm font-medium text-[#7A7267] hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirm(false);
                    onToggleStatus();
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-colors cursor-pointer ${
                    isPublishing
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-amber-500 hover:bg-amber-600"
                  }`}
                >
                  {isPublishing ? t("confirmPublish") : t("confirmUnpublish")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
