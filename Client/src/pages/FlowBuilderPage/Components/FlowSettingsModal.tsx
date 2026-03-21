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
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#EDE6DD]/40 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4 text-[#7A7267]" />
          </button>
        </div>

        {/* Settings */}
        <div className="p-5 space-y-5">
          {/* Strict Mode */}
          <div className="rounded-lg bg-[#FFF5F0]/60 border border-[#FF7E47]/20 p-3">
            <SettingRow
              label={t("settingsStrictMode")}
              hint={t("settingsStrictModeHint")}
              checked={settings.strictMode}
              onChange={(v) => onUpdate({ strictMode: v })}
            />
          </div>

          {/* Ignore Group Chats */}
          <SettingRow
            label={t("settingsIgnoreGroups")}
            hint={t("settingsIgnoreGroupsHint")}
            checked={settings.ignoreGroupChats}
            onChange={(v) => onUpdate({ ignoreGroupChats: v })}
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
                <MinutesPresetInput
                  label={t("settingsCooldownMinutes")}
                  value={settings.cooldownMinutes}
                  presets={[
                    { value: 30, label: t("settingsCooldownPreset30") },
                    { value: 60, label: t("settingsCooldownPreset60") },
                    { value: 120, label: t("settingsCooldownPreset120") },
                  ]}
                  min={5}
                  max={1440}
                  onChange={(v) => onUpdate({ cooldownMinutes: v })}
                />
              </div>
            )}
          </div>

          {/* Auto Follow-Up */}
          <div className="border-t border-[#EDE6DD]/40 pt-5">
            <SettingRow
              label={t("settingsAutoFollowUp")}
              hint={t("settingsAutoFollowUpHint")}
              checked={settings.autoFollowUpEnabled}
              onChange={(v) => onUpdate({ autoFollowUpEnabled: v })}
            />

            {settings.autoFollowUpEnabled && (
              <div className="mt-3 ms-6 space-y-3">
                <MinutesPresetInput
                  label={t("settingsAutoFollowUpDelay")}
                  value={settings.autoFollowUpDelayMinutes}
                  presets={[
                    { value: 30, label: t("settingsAutoFollowUpPreset30") },
                    { value: 60, label: t("settingsAutoFollowUpPreset60") },
                    { value: 120, label: t("settingsAutoFollowUpPreset120") },
                  ]}
                  min={1}
                  max={1440}
                  onChange={(v) => onUpdate({ autoFollowUpDelayMinutes: v })}
                />

                <div>
                  <label className="text-[10px] font-semibold text-[#2D2A26] block mb-1.5">
                    {t("settingsAutoFollowUpMaxCount")}
                  </label>
                  <span className="text-[10px] text-[#A39B90] block mb-1.5">
                    {t("settingsAutoFollowUpMaxCountHint")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={2}
                    value={settings.autoFollowUpMaxCount}
                    onChange={(e) => onUpdate({ autoFollowUpMaxCount: Math.max(1, Math.min(2, Number(e.target.value))) })}
                    className="field-input w-full"
                  />
                </div>

                {/* Follow-Up Mode Toggle */}
                <div>
                  <label className="text-[10px] font-semibold text-[#2D2A26] block mb-1.5">
                    {t("settingsAutoFollowUpMode")}
                  </label>
                  <div className="flex items-center gap-2">
                    {(["bot", "custom"] as const).map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        onClick={() => onUpdate({ autoFollowUpMode: mode })}
                        className={`flex-1 px-2.5 py-1.5 rounded text-[10px] font-medium border cursor-pointer transition-colors ${
                          settings.autoFollowUpMode === mode
                            ? "bg-[#FF7E47] text-white border-[#FF7E47]"
                            : "bg-white text-[#7A7267] border-[#EDE6DD] hover:border-[#FF7E47]/50"
                        }`}
                      >
                        {t(mode === "bot" ? "settingsAutoFollowUpModeBot" : "settingsAutoFollowUpModeCustom")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Message Textareas */}
                {settings.autoFollowUpMode === "custom" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-semibold text-[#2D2A26] block mb-1.5">
                        {t("settingsAutoFollowUpCustom1")}
                      </label>
                      <textarea
                        dir="rtl"
                        value={settings.autoFollowUpCustomMessages?.[0] ?? ""}
                        onChange={(e) => {
                          const msgs = [...(settings.autoFollowUpCustomMessages || [])];
                          msgs[0] = e.target.value;
                          onUpdate({ autoFollowUpCustomMessages: msgs });
                        }}
                        placeholder={t("settingsAutoFollowUpCustomPlaceholder")}
                        rows={3}
                        className="field-input w-full resize-none"
                      />
                    </div>
                    {settings.autoFollowUpMaxCount >= 2 && (
                      <div>
                        <label className="text-[10px] font-semibold text-[#2D2A26] block mb-1.5">
                          {t("settingsAutoFollowUpCustom2")}
                        </label>
                        <textarea
                          dir="rtl"
                          value={settings.autoFollowUpCustomMessages?.[1] ?? ""}
                          onChange={(e) => {
                            const msgs = [...(settings.autoFollowUpCustomMessages || [])];
                            msgs[1] = e.target.value;
                            onUpdate({ autoFollowUpCustomMessages: msgs });
                          }}
                          placeholder={t("settingsAutoFollowUpCustomPlaceholder")}
                          rows={3}
                          className="field-input w-full resize-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Session Auto-Reset */}
          <div className="border-t border-[#EDE6DD]/40 pt-5">
            <SettingRow
              label={t("settingsSessionReset")}
              hint={t("settingsSessionResetHint")}
              checked={settings.sessionResetEnabled}
              onChange={(v) => onUpdate({ sessionResetEnabled: v })}
            />

            {settings.sessionResetEnabled && (
              <div className="mt-3 ms-6">
                <MinutesPresetInput
                  label={t("settingsSessionResetMinutes")}
                  value={settings.sessionResetMinutes}
                  presets={[
                    { value: 60, label: t("settingsSessionResetPreset60") },
                    { value: 360, label: t("settingsSessionResetPreset360") },
                    { value: 1440, label: t("settingsSessionResetPreset1440") },
                  ]}
                  min={30}
                  max={10080}
                  onChange={(v) => onUpdate({ sessionResetMinutes: v })}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EDE6DD]/40">
          <button
            type="button"
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

interface PresetConfig {
  value: number;
  label: string;
}

function MinutesPresetInput({
  label,
  value,
  presets,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  presets: PresetConfig[];
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-[#2D2A26] block mb-1.5">{label}</label>
      <div className="flex items-center gap-2 mb-2">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.value}
            onClick={() => onChange(preset.value)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium border cursor-pointer transition-colors ${
              value === preset.value
                ? "bg-[#FF7E47] text-white border-[#FF7E47]"
                : "bg-white text-[#7A7267] border-[#EDE6DD] hover:border-[#FF7E47]/50"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="field-input w-full"
      />
    </div>
  );
}
