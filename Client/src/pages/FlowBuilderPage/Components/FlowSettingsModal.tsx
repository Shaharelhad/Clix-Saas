import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { FlowSettings } from "@/types/flow";

interface FlowSettingsModalProps {
  settings: FlowSettings;
  onUpdate: (patch: Partial<FlowSettings>) => void;
  onClose: () => void;
}

export default function FlowSettingsModal({ settings, onUpdate, onClose }: FlowSettingsModalProps) {
  const { t } = useTranslation("flow");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-[380px] max-h-[80vh] overflow-y-auto border border-[#EDE6DD]/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDE6DD]/40">
          <span className="text-sm font-bold text-[#2D2A26]">{t("settingsTitle")}</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#EDE6DD]/40 cursor-pointer">
            <X className="w-4 h-4 text-[#7A7267]" />
          </button>
        </div>

        {/* Settings */}
        <div className="p-5 space-y-5">
          {/* Ignore Group Chats */}
          <SettingRow
            label={t("settingsIgnoreGroups")}
            hint={t("settingsIgnoreGroupsHint")}
            checked={settings.ignoreGroupChats}
            onChange={(v) => onUpdate({ ignoreGroupChats: v })}
          />

          {/* Duplicate Message Filter */}
          <SettingRow
            label={t("settingsDedup")}
            hint={t("settingsDedupHint")}
            checked={settings.deduplicateMessages}
            onChange={(v) => onUpdate({ deduplicateMessages: v })}
          />

          {/* Human Takeover Cooldown */}
          <div className="border-t border-[#EDE6DD]/40 pt-5">
            <SettingRow
              label={t("settingsCooldown")}
              hint={t("settingsCooldownHint")}
              checked={settings.cooldownEnabled}
              onChange={(v) => onUpdate({ cooldownEnabled: v })}
            />

            {settings.cooldownEnabled && (
              <div className="mt-3 ms-6">
                <label className="text-[10px] font-semibold text-[#2D2A26] block mb-1.5">
                  {t("settingsCooldownMinutes")}
                </label>
                <div className="flex items-center gap-2 mb-2">
                  {[30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => onUpdate({ cooldownMinutes: mins })}
                      className={`px-2.5 py-1 rounded text-[10px] font-medium border cursor-pointer transition-colors ${
                        settings.cooldownMinutes === mins
                          ? "bg-[#FF7E47] text-white border-[#FF7E47]"
                          : "bg-white text-[#7A7267] border-[#EDE6DD] hover:border-[#FF7E47]/50"
                      }`}
                    >
                      {mins === 30
                        ? t("settingsCooldownPreset30")
                        : mins === 60
                          ? t("settingsCooldownPreset60")
                          : t("settingsCooldownPreset120")}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={settings.cooldownMinutes}
                  onChange={(e) => onUpdate({ cooldownMinutes: Math.max(5, Math.min(1440, Number(e.target.value))) })}
                  className="field-input w-full"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EDE6DD]/40">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-[#FF7E47] text-white text-sm font-semibold hover:bg-[#e56e3a] transition-colors cursor-pointer"
          >
            {t("settingsDone")}
          </button>
        </div>
      </div>

      <style>{`
        .field-input {
          width: 100%;
          padding: 6px 10px;
          border: 1px solid #EDE6DD;
          border-radius: 6px;
          font-size: 12px;
          color: #2D2A26;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus {
          border-color: #FF7E47;
        }
      `}</style>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function SettingRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[#FF7E47] mt-0.5 shrink-0"
      />
      <div>
        <span className="text-xs font-semibold text-[#2D2A26] block">{label}</span>
        <span className="text-[10px] text-[#A39B90] block mt-0.5">{hint}</span>
      </div>
    </label>
  );
}
