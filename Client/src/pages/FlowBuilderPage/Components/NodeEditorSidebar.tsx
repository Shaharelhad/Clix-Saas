import { useTranslation } from "react-i18next";
import { X, Plus, Trash2 } from "lucide-react";
import type { FlowNode, FlowNodeData, ButtonItem } from "@/types/flow";

interface NodeEditorSidebarProps {
  node: FlowNode | null;
  onUpdate: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onClose: () => void;
}

export default function NodeEditorSidebar({ node, onUpdate, onClose }: NodeEditorSidebarProps) {
  const { t } = useTranslation("flow");

  if (!node) {
    return (
      <div className="w-64 bg-white border-e border-[#EDE6DD]/60 p-4 flex items-center justify-center">
        <p className="text-sm text-[#A39B90] text-center">{t("noNodeSelected")}</p>
      </div>
    );
  }

  const { data } = node;
  const update = (patch: Partial<FlowNodeData>) => onUpdate(node.id, patch);

  return (
    <div className="w-64 bg-white border-e border-[#EDE6DD]/60 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#EDE6DD]/40">
        <span className="text-sm font-bold text-[#2D2A26]">
          {t(`node${capitalize(data.type)}`)}
        </span>
        <button onClick={onClose} className="p-1 rounded hover:bg-[#EDE6DD]/40 cursor-pointer">
          <X className="w-4 h-4 text-[#7A7267]" />
        </button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Start node */}
        {data.type === "start" && (
          <Field label={t("triggerText")} hint={t("triggerTextHint")}>
            <input
              type="text"
              value={data.triggerText ?? ""}
              onChange={(e) => update({ triggerText: e.target.value })}
              className="field-input"
              dir="rtl"
            />
          </Field>
        )}

        {/* Text / Image / Buttons / Collect Input — message field */}
        {["text", "image", "buttons", "collect_input"].includes(data.type) && (
          <Field label={t("message")} hint={t("messageHint")}>
            <textarea
              value={data.message ?? ""}
              onChange={(e) => update({ message: e.target.value })}
              className="field-input min-h-[80px] resize-y"
              dir="rtl"
            />
          </Field>
        )}

        {/* Image URL */}
        {data.type === "image" && (
          <Field label={t("imageUrl")} hint={t("imageUrlHint")}>
            <input
              type="url"
              value={data.imageUrl ?? ""}
              onChange={(e) => update({ imageUrl: e.target.value })}
              className="field-input"
              dir="ltr"
            />
          </Field>
        )}

        {/* Expected reply */}
        {(data.type === "text" || data.type === "image") && (
          <>
            <Field label={t("expectedReply")} hint={t("expectedReplyHint")}>
              <input
                type="text"
                value={data.expectedReply ?? ""}
                onChange={(e) => update({ expectedReply: e.target.value })}
                className="field-input"
                dir="rtl"
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-[#7A7267] cursor-pointer">
              <input
                type="checkbox"
                checked={data.continueAuto ?? false}
                onChange={(e) => update({ continueAuto: e.target.checked })}
                className="accent-[#FF7E47]"
              />
              {t("continueAuto")}
            </label>
          </>
        )}

        {/* Buttons list */}
        {data.type === "buttons" && (
          <ButtonsEditor
            buttons={data.buttons ?? []}
            onChange={(buttons) => update({ buttons })}
          />
        )}

        {/* Variable name */}
        {data.type === "collect_input" && (
          <Field label={t("variableName")} hint={t("variableNameHint")}>
            <input
              type="text"
              value={data.variableName ?? ""}
              onChange={(e) => update({ variableName: e.target.value })}
              className="field-input"
              dir="ltr"
            />
          </Field>
        )}

        {/* Delay minutes */}
        {(data.type === "delay" || data.type === "follow_up") && (
          <Field label={t("delayMinutes")} hint={t("delayMinutesHint")}>
            <input
              type="number"
              min={1}
              max={data.type === "follow_up" ? 10080 : 1440}
              value={data.delayMinutes ?? (data.type === "follow_up" ? 30 : 5)}
              onChange={(e) => update({ delayMinutes: Number(e.target.value) })}
              className="field-input"
            />
          </Field>
        )}

        {/* Follow-up message */}
        {data.type === "follow_up" && (
          <Field label={t("followUpMessage")} hint={t("followUpMessageHint")}>
            <textarea
              value={data.followUpMessage ?? ""}
              onChange={(e) => update({ followUpMessage: e.target.value })}
              className="field-input min-h-[80px] resize-y"
              dir="rtl"
            />
          </Field>
        )}

        {/* AI Agent */}
        {data.type === "ai_agent" && (
          <>
            <Field label={t("aiSystemPrompt")} hint={t("aiSystemPromptHint")}>
              <textarea
                value={data.systemPromptOverride ?? ""}
                onChange={(e) => update({ systemPromptOverride: e.target.value })}
                className="field-input min-h-[80px] resize-y"
                dir="rtl"
              />
            </Field>
            <Field label={t("aiTemperature")} hint={t("aiTemperatureHint")}>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={data.temperature ?? 1.0}
                onChange={(e) => update({ temperature: Number(e.target.value) })}
                className="field-input"
              />
            </Field>
            <Field label={t("aiModel")}>
              <select
                value={data.model ?? "x-ai/grok-4-fast"}
                onChange={(e) => update({ model: e.target.value })}
                className="field-input"
              >
                <option value="x-ai/grok-4-fast">Grok 4 Fast</option>
                <option value="x-ai/grok-4.1-fast">Grok 4.1 Fast</option>
              </select>
            </Field>
            <Field label={t("aiMaxTokens")} hint={t("aiMaxTokensHint")}>
              <input
                type="number"
                min={128}
                max={4096}
                step={128}
                value={data.maxTokens ?? 2048}
                onChange={(e) => update({ maxTokens: Number(e.target.value) })}
                className="field-input"
              />
            </Field>
            <div>
              <label className="text-xs font-semibold text-[#2D2A26] block mb-2">{t("aiKnowledgeSources")}</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-[#7A7267] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.includeProducts !== false}
                    onChange={(e) => update({ includeProducts: e.target.checked })}
                    className="accent-[#FF7E47]"
                  />
                  {t("aiIncludeProducts")}
                </label>
                <label className="flex items-center gap-2 text-xs text-[#7A7267] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.includeFaqs !== false}
                    onChange={(e) => update({ includeFaqs: e.target.checked })}
                    className="accent-[#FF7E47]"
                  />
                  {t("aiIncludeFaqs")}
                </label>
                <label className="flex items-center gap-2 text-xs text-[#7A7267] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={data.includeScrapedContent !== false}
                    onChange={(e) => update({ includeScrapedContent: e.target.checked })}
                    className="accent-[#FF7E47]"
                  />
                  {t("aiIncludeScraped")}
                </label>
              </div>
            </div>
            <Field label={t("aiMaxHistory")} hint={t("aiMaxHistoryHint")}>
              <input
                type="number"
                min={1}
                max={50}
                value={data.maxHistoryMessages ?? 20}
                onChange={(e) => update({ maxHistoryMessages: Number(e.target.value) })}
                className="field-input"
              />
            </Field>
          </>
        )}

        {/* Condition */}
        {data.type === "condition" && (
          <>
            <Field label={t("conditionVariable")}>
              <input
                type="text"
                value={data.variable ?? ""}
                onChange={(e) => update({ variable: e.target.value })}
                className="field-input"
                dir="ltr"
              />
            </Field>
            <Field label={t("conditionOperator")}>
              <select
                value={data.operator ?? "equals"}
                onChange={(e) => update({ operator: e.target.value as FlowNodeData["operator"] })}
                className="field-input"
              >
                <option value="equals">{t("operatorEquals")}</option>
                <option value="contains">{t("operatorContains")}</option>
                <option value="not_empty">{t("operatorNotEmpty")}</option>
              </select>
            </Field>
            {data.operator !== "not_empty" && (
              <Field label={t("conditionValue")}>
                <input
                  type="text"
                  value={data.value ?? ""}
                  onChange={(e) => update({ value: e.target.value })}
                  className="field-input"
                  dir="rtl"
                />
              </Field>
            )}
          </>
        )}
      </div>

      {/* Inline styles for field inputs */}
      <style>{`
        .field-input {
          width: 100%;
          border: 1px solid #EDE6DD;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          color: #2D2A26;
          background: #FAF7F3;
          outline: none;
          transition: border-color 0.2s;
        }
        .field-input:focus {
          border-color: #FF7E47;
          box-shadow: 0 0 0 2px rgba(255,126,71,0.1);
        }
      `}</style>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#2D2A26] block mb-1">{label}</label>
      {hint && <p className="text-[10px] text-[#A39B90] mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function ButtonsEditor({ buttons, onChange }: { buttons: ButtonItem[]; onChange: (b: ButtonItem[]) => void }) {
  const { t } = useTranslation("flow");

  const addButton = () => {
    if (buttons.length >= 3) return;
    onChange([...buttons, { id: `btn-${Date.now()}`, label: "" }]);
  };

  const removeButton = (id: string) => {
    onChange(buttons.filter((b) => b.id !== id));
  };

  const updateLabel = (id: string, label: string) => {
    onChange(buttons.map((b) => (b.id === id ? { ...b, label } : b)));
  };

  return (
    <div>
      <label className="text-xs font-semibold text-[#2D2A26] block mb-2">{t("buttons")}</label>
      <div className="space-y-2">
        {buttons.map((btn) => (
          <div key={btn.id} className="flex items-center gap-1.5">
            <input
              type="text"
              value={btn.label}
              onChange={(e) => updateLabel(btn.id, e.target.value)}
              placeholder={t("buttonLabel")}
              className="field-input flex-1"
              dir="rtl"
            />
            <button
              onClick={() => removeButton(btn.id)}
              className="p-1.5 rounded hover:bg-red-50 text-[#A39B90] hover:text-red-500 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      {buttons.length < 3 ? (
        <button
          onClick={addButton}
          className="flex items-center gap-1 mt-2 text-xs text-[#FF7E47] hover:text-[#E86B38] cursor-pointer"
        >
          <Plus className="w-3 h-3" /> {t("addButton")}
        </button>
      ) : (
        <p className="text-[10px] text-[#A39B90] mt-1">{t("maxButtons")}</p>
      )}
    </div>
  );
}

function capitalize(s: string): string {
  // Convert snake_case to PascalCase for i18n key lookup
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
