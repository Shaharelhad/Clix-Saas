import { useTranslation } from "react-i18next";
import { Save, Loader2, Check, Upload, CircleStop, Settings } from "lucide-react";

interface FlowToolbarProps {
  workflowName: string;
  workflowStatus: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onToggleStatus: () => void;
  onOpenSettings: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
}

export default function FlowToolbar({
  workflowName,
  workflowStatus,
  onNameChange,
  onSave,
  onToggleStatus,
  onOpenSettings,
  saveStatus,
}: FlowToolbarProps) {
  const { t } = useTranslation("flow");

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-[#EDE6DD]/60 shrink-0">
      {/* Left: name + status */}
      <div className="flex items-center gap-3">
        {/* Editable name */}
        <input
          type="text"
          value={workflowName}
          onChange={(e) => onNameChange(e.target.value)}
          className="text-sm font-bold text-[#2D2A26] bg-transparent border-b border-transparent hover:border-[#EDE6DD] focus:border-[#FF7E47] outline-none px-1 py-0.5 transition-colors"
          dir="rtl"
        />

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
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-[#EDE6DD]/40 cursor-pointer"
          title={t("settingsTitle")}
        >
          <Settings className="w-4 h-4 text-[#7A7267]" />
        </button>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Publish / Unpublish */}
        {workflowStatus === "active" ? (
          <button
            onClick={onToggleStatus}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
          >
            <CircleStop className="w-3.5 h-3.5" /> {t("unpublish")}
          </button>
        ) : (
          <button
            onClick={() => {
              if (confirm(t("publishConfirm"))) onToggleStatus();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> {t("publish")}
          </button>
        )}

        {/* Save */}
        <button
          onClick={onSave}
          disabled={saveStatus === "saving"}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#FF7E47] text-white hover:bg-[#E86B38] transition-colors cursor-pointer disabled:opacity-70"
        >
          {saveStatus === "saving" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : saveStatus === "saved" ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {saveStatus === "saving" ? t("saving") : saveStatus === "saved" ? t("saved") : t("save")}
        </button>
      </div>
    </div>
  );
}
