import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, Trash2, Upload, Loader2, Bot, HelpCircle } from "lucide-react";
import type { FlowNode, FlowNodeData, ButtonItem } from "@/types/flow";
import { findServiceById, findOperationById } from "@/types/integration-catalog";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/auth.store";

interface NodeEditorSidebarProps {
  node: FlowNode | null;
  onUpdate: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onClose: () => void;
  isLocked: boolean;
  strictMode: boolean;
}

export default function NodeEditorSidebar({ node, onUpdate, onClose, isLocked, strictMode }: NodeEditorSidebarProps) {
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
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#EDE6DD]/40 cursor-pointer" aria-label="Close">
          <X className="w-4 h-4 text-[#7A7267]" />
        </button>
      </div>

      {/* Fields */}
      <fieldset disabled={isLocked} className={`flex-1 min-h-0 overflow-hidden flex flex-col ${isLocked ? "opacity-60" : ""}`}>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Start node */}
        {data.type === "start" && (
          <>
            {/* Custom node name */}
            <Field label={t("nodeLabel")} hint={t("nodeLabelHint")}>
              <input
                type="text"
                value={data.label ?? ""}
                onChange={(e) => update({ label: e.target.value })}
                placeholder={t("nodeStart")}
                className="field-input"
                dir="rtl"
              />
            </Field>

            {/* Enable/Disable toggle */}
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[10px] text-[#A39B90]">{t("startNodeToggleHint")}</span>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ms-2">
                <input
                  type="checkbox"
                  checked={!data.disabled}
                  onChange={(e) => update({ disabled: !e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-[18px] bg-[#EDE6DD] rounded-full peer peer-checked:bg-[#22c55e] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:shadow-sm" />
              </label>
            </div>

            {/* Keywords — hidden in strict mode, required in non-strict */}
            {!strictMode && (
              <KeywordsEditor
                keywords={data.triggerKeywords ?? (data.triggerText?.trim() ? [data.triggerText] : [""])}
                disabled={data.disabled ?? false}
                onChange={(keywords) => update({ triggerKeywords: keywords, triggerText: keywords[0] ?? "" })}
              />
            )}

            {/* Strict mode info */}
            {strictMode && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                <p className="text-[10px] text-green-600">{t("strictModeCatchAll")}</p>
              </div>
            )}
          </>
        )}

        {/* Buttons — header field (optional) */}
        {data.type === "buttons" && (
          <Field label={t("buttonHeader")} hint={t("buttonHeaderHint")}>
            <input
              type="text"
              value={data.buttonHeader ?? ""}
              onChange={(e) => update({ buttonHeader: e.target.value })}
              className="field-input"
              dir="rtl"
            />
          </Field>
        )}

        {/* Text / Image / Buttons / Collect Input — message field */}
        {["text", "image", "buttons"].includes(data.type) && (
          <Field label={t("message")} hint={t("messageHint")}>
            <textarea
              value={data.message ?? ""}
              onChange={(e) => update({ message: e.target.value })}
              className="field-input min-h-[80px] resize-y"
              dir="rtl"
            />
          </Field>
        )}

        {/* Buttons — footer field (optional) */}
        {data.type === "buttons" && (
          <Field label={t("buttonFooter")} hint={t("buttonFooterHint")}>
            <input
              type="text"
              value={data.buttonFooter ?? ""}
              onChange={(e) => update({ buttonFooter: e.target.value })}
              className="field-input"
              dir="rtl"
            />
          </Field>
        )}

        {/* Image upload */}
        {data.type === "image" && (
          <ImageUploadField
            imageUrl={data.imageUrl ?? ""}
            onUpdate={(imageUrl) => update({ imageUrl })}
          />
        )}

        {/* Yes/No question toggle */}
        {(data.type === "text" || data.type === "image") && (
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] text-[#A39B90]">{t("yesNoModeHint")}</span>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ms-2">
              <input
                type="checkbox"
                checked={data.yesNoMode ?? false}
                onChange={(e) => update({ yesNoMode: e.target.checked, ...(e.target.checked ? { expectedReply: "", continueAuto: false } : {}) })}
                className="sr-only peer"
              />
              <div className="w-8 h-[18px] bg-[#EDE6DD] rounded-full peer peer-checked:bg-[#22c55e] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:shadow-sm" />
            </label>
          </div>
        )}

        {/* Expected reply / continue on any (hidden when yesNoMode is on) */}
        {(data.type === "text" || data.type === "image") && !data.yesNoMode && (
          <div className="space-y-3">
            <Field label={t("expectedReply")} hint={data.continueAuto ? undefined : t("expectedReplyHint")}>
              <input
                type="text"
                value={data.continueAuto ? "" : (data.expectedReply ?? "")}
                onChange={(e) => update({ expectedReply: e.target.value, continueAuto: false })}
                disabled={data.continueAuto ?? false}
                className={`field-input ${data.continueAuto ? "opacity-40 cursor-not-allowed" : ""}`}
                dir="rtl"
              />
            </Field>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-[#A39B90]">{t("continueAutoHint")}</span>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ms-2">
                <input
                  type="checkbox"
                  checked={data.continueAuto ?? false}
                  onChange={(e) => update({ continueAuto: e.target.checked, ...(e.target.checked ? { expectedReply: "", allowSkip: false } : {}) })}
                  className="sr-only peer"
                />
                <div className="w-8 h-[18px] bg-[#EDE6DD] rounded-full peer peer-checked:bg-[#FF7E47] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:shadow-sm" />
              </label>
            </div>
            {/* Allow Skip */}
            {!data.continueAuto && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-[#A39B90]">{t("allowSkipHint")}</span>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ms-2">
                  <input
                    type="checkbox"
                    checked={data.allowSkip ?? false}
                    onChange={(e) => update({ allowSkip: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-[18px] bg-[#EDE6DD] rounded-full peer peer-checked:bg-[#06b6d4] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:shadow-sm" />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Language toggle for text/image nodes with validation */}
        {(data.type === "text" || data.type === "image") && (data.yesNoMode || data.expectedReply) && (
          <Field label={t("outputLanguage")} hint={t("outputLanguageHint")}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update({ outputLanguage: "en" })}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  data.outputLanguage === "en"
                    ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >EN</button>
              <button
                type="button"
                onClick={() => update({ outputLanguage: "he" })}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                  (data.outputLanguage ?? "he") === "he"
                    ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >עב</button>
            </div>
          </Field>
        )}

        {/* Buttons list */}
        {data.type === "buttons" && (
          <>
            <ButtonsEditor
              buttons={data.buttons ?? []}
              onChange={(buttons) => update({ buttons })}
            />
            {/* Global menu toggle */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-[#A39B90]">{t("globalMenuHint")}</span>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ms-2">
                <input
                  type="checkbox"
                  checked={data.isGlobalMenu ?? false}
                  onChange={(e) => update({ isGlobalMenu: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-[18px] bg-[#EDE6DD] rounded-full peer peer-checked:bg-[#06b6d4] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:shadow-sm" />
              </label>
            </div>
          </>
        )}

        {/* Open Bot info (read-only) */}
        {data.type === "open_bot" && (
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold text-violet-700">{t("nodeOpenBot")}</span>
            </div>
            <p className="text-[11px] text-violet-600 leading-relaxed">{t("openBotInfo")}</p>
          </div>
        )}

        {/* Collect Input */}
        {data.type === "collect_input" && (
          <>
            <Field label={t("message")} hint={t("collectInputMessageHint")}>
              <textarea
                value={data.message ?? ""}
                onChange={(e) => update({ message: e.target.value })}
                className="field-input min-h-[80px] resize-y"
                dir="rtl"
              />
            </Field>
            <Field label={t("variableName")} hint={t("variableNameHint")}>
              <input
                type="text"
                value={data.variableName ?? ""}
                onChange={(e) => update({ variableName: e.target.value })}
                className="field-input"
                dir="ltr"
                placeholder="name"
              />
            </Field>
            <Field label={t("expectedAnswer")} hint={t("expectedAnswerHint")}>
              <input
                type="text"
                value={data.expectedAnswer ?? ""}
                onChange={(e) => update({ expectedAnswer: e.target.value })}
                className="field-input"
                dir="rtl"
              />
            </Field>
            {data.expectedAnswer && (
              <Field label={t("outputFormat")} hint={t("outputFormatHint")}>
                <input
                  type="text"
                  value={data.outputFormat ?? ""}
                  onChange={(e) => update({ outputFormat: e.target.value })}
                  className="field-input"
                  dir="ltr"
                  placeholder={t("outputFormatPlaceholder")}
                />
              </Field>
            )}
            {/* Allow Skip */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-[#A39B90]">{t("allowSkipHint")}</span>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ms-2">
                <input
                  type="checkbox"
                  checked={data.allowSkip ?? false}
                  onChange={(e) => update({ allowSkip: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-[18px] bg-[#EDE6DD] rounded-full peer peer-checked:bg-[#06b6d4] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:shadow-sm" />
              </label>
            </div>
            {/* Language toggle for nudge messages */}
            {data.expectedAnswer && (
              <Field label={t("outputLanguage")} hint={t("outputLanguageHint")}>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => update({ outputLanguage: "en" })}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      data.outputLanguage === "en"
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >EN</button>
                  <button
                    type="button"
                    onClick={() => update({ outputLanguage: "he" })}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      (data.outputLanguage ?? "he") === "he"
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                    }`}
                  >עב</button>
                </div>
              </Field>
            )}
          </>
        )}

        {/* Delay minutes */}
        {data.type === "delay" && (
          <Field label={t("delayMinutes")} hint={t("delayMinutesHint")}>
            <input
              type="number"
              min={1}
              max={1440}
              value={data.delayMinutes ?? 5}
              onChange={(e) => update({ delayMinutes: Number(e.target.value) })}
              className="field-input"
            />
          </Field>
        )}

        {/* API Call */}
        {data.type === "api_call" && (
          <ApiCallEditor data={data} update={update} />
        )}

        {/* Language */}
        {data.type === "language" && (
          <>
            <Field label={t("languagePromptLabel")} hint={t("languagePromptHint")}>
              <textarea
                value={data.message ?? ""}
                onChange={(e) => update({ message: e.target.value })}
                className="field-input min-h-[60px] resize-y"
                dir="rtl"
                placeholder={t("languagePromptDefault")}
              />
            </Field>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-[11px] text-blue-600 leading-relaxed">{t("languageNodeInfo")}</p>
            </div>
          </>
        )}

      </div>
      </fieldset>

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
    if (buttons.length >= 10) return;
    onChange([...buttons, { id: `btn-${Date.now()}`, label: "" }]);
  };

  const removeButton = (id: string) => {
    onChange(buttons.filter((b) => b.id !== id));
  };

  const updateLabel = (id: string, label: string) => {
    onChange(buttons.map((b) => (b.id === id ? { ...b, label } : b)));
  };

  const toggleOpenBot = (id: string) => {
    onChange(buttons.map((b) => (b.id === id ? { ...b, openBot: !b.openBot } : b)));
  };

  return (
    <div>
      <label className="text-xs font-semibold text-[#2D2A26] block mb-2">{t("buttons")}</label>
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
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
              type="button"
              onClick={() => toggleOpenBot(btn.id)}
              className={`p-1.5 rounded cursor-pointer transition-colors ${
                btn.openBot
                  ? "bg-violet-100 text-violet-600"
                  : "text-[#A39B90] hover:bg-violet-50 hover:text-violet-500"
              }`}
              title={t("openBotToggle")}
            >
              <Bot className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => removeButton(btn.id)}
              className="p-1.5 rounded hover:bg-red-50 text-[#A39B90] hover:text-red-500 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      {buttons.length < 10 ? (
        <button
          type="button"
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

const MAX_IMAGE_SIZE_MB = 5;

async function uploadImageToStorage(
  file: File,
  userId: string,
): Promise<string> {
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File exceeds ${MAX_IMAGE_SIZE_MB}MB limit`);
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("bot-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("bot-media").getPublicUrl(path);
  return data.publicUrl;
}

function ImageUploadField({ imageUrl, onUpdate }: { imageUrl: string; onUpdate: (url: string) => void }) {
  const { t } = useTranslation("flow");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const userId = useAuthStore((s) => s.user?.id);

  const handleFile = async (file: File) => {
    if (!userId || !file.type.startsWith("image/")) return;
    setUploading(true);
    setError("");
    try {
      const publicUrl = await uploadImageToStorage(file, userId);
      onUpdate(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("imageUploadError"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (imageUrl) {
    return (
      <Field label={t("nodeImage")}>
        <div className="relative rounded-lg overflow-hidden border border-[#EDE6DD]">
          <img src={imageUrl} alt="" className="w-full h-28 object-cover" />
          <button
            type="button"
            onClick={() => onUpdate("")}
            className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
            title={t("imageRemove")}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </Field>
    );
  }

  return (
    <Field label={t("nodeImage")}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full flex flex-col items-center justify-center gap-1.5 py-4 rounded-lg border-2 border-dashed border-[#EDE6DD] hover:border-[#FF7E47]/40 hover:bg-[#FFF5F0]/30 transition-colors cursor-pointer disabled:cursor-wait"
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 text-[#A39B90] animate-spin" />
            <span className="text-[10px] text-[#A39B90]">{t("imageUploading")}</span>
          </>
        ) : (
          <>
            <Upload className="w-5 h-5 text-[#A39B90]" />
            <span className="text-[10px] text-[#A39B90]">{t("imageUpload")}</span>
          </>
        )}
      </button>
      {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
    </Field>
  );
}

function ApiCallEditor({ data, update }: { data: FlowNodeData; update: (patch: Partial<FlowNodeData>) => void }) {
  const { t } = useTranslation("flow");
  const userId = useAuthStore((s) => s.user?.id);

  const { data: integrations } = useQuery({
    queryKey: ["integrations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("id, integration_type, config, status")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Determine if selected integration is a catalog service
  const selectedIntegration = integrations?.find((i) => i.id === data.integrationId);
  const serviceDef = selectedIntegration
    ? findServiceById(selectedIntegration.integration_type)
    : undefined;
  const isOperationMode = !!serviceDef;

  const operationDef = serviceDef && data.operationId
    ? findOperationById(serviceDef.id, data.operationId)
    : undefined;

  const handleIntegrationChange = (integrationId: string) => {
    const intg = integrations?.find((i) => i.id === integrationId);
    const svcType = intg?.integration_type ?? "";
    const svc = findServiceById(svcType);
    update({
      integrationId: integrationId || undefined,
      serviceType: svcType || undefined,
      // Reset operation fields when switching integration
      operationId: svc ? "" : undefined,
      inputValues: svc ? {} : undefined,
    });
  };

  const handleOperationChange = (operationId: string) => {
    const op = serviceDef ? findOperationById(serviceDef.id, operationId) : undefined;
    const prefilled: Record<string, string> = {};
    if (op) {
      for (const field of op.inputFields) {
        if (field.placeholder) prefilled[field.id] = field.placeholder;
      }
    }
    update({ operationId, inputValues: prefilled });
  };

  const handleInputChange = (fieldId: string, value: string) => {
    update({ inputValues: { ...(data.inputValues ?? {}), [fieldId]: value } });
  };

  const method = data.method ?? "GET";

  return (
    <>
      {/* Integration selector */}
      <Field label={t("apiCallIntegration")} hint={t("apiCallIntegrationHint")}>
        {integrations && integrations.length > 0 ? (
          <select
            value={data.integrationId ?? ""}
            onChange={(e) => handleIntegrationChange(e.target.value)}
            className="field-input"
          >
            <option value="">{t("apiCallIntegration")}...</option>
            {integrations.map((intg) => {
              const svc = findServiceById(intg.integration_type);
              const label = svc ? t(svc.labelKey) : intg.integration_type;
              return (
                <option key={intg.id} value={intg.id}>
                  {label}
                </option>
              );
            })}
          </select>
        ) : (
          <p className="text-[10px] text-amber-600">{t("apiCallNoIntegrations")}</p>
        )}
      </Field>

      {/* ── Operation mode (catalog service like Cloudbeds) ── */}
      {isOperationMode && (
        <>
          {/* Operation selector */}
          <Field label={t("apiCallOperation")} hint={t("apiCallOperationHint")}>
            <select
              value={data.operationId ?? ""}
              onChange={(e) => handleOperationChange(e.target.value)}
              className="field-input"
            >
              <option value="">{t("apiCallSelectOperation")}</option>
              {serviceDef.operations.map((op) => (
                <option key={op.id} value={op.id}>
                  {t(op.labelKey)}
                </option>
              ))}
            </select>
          </Field>

          {/* Dynamic input fields */}
          {operationDef && (
            <>
              {operationDef.inputFields.map((field) => (
                <Field
                  key={field.id}
                  label={t(field.labelKey)}
                  hint={field.hintKey ? t(field.hintKey) : t("apiCallInputHint")}
                >
                  <input
                    type="text"
                    value={data.inputValues?.[field.id] ?? ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    className="field-input"
                    dir="ltr"
                    placeholder={field.placeholder ?? ""}
                  />
                </Field>
              ))}

              {/* Output variables info */}
              {operationDef.responseMapping.length > 0 && (
                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-pink-700 mb-1">{t("apiCallOutputVars")}</p>
                  {operationDef.responseMapping.map((m) => (
                    <p key={m.variableName} className="text-[10px] text-pink-600 font-mono" dir="ltr">
                      {"{{"}
                      {m.variableName}
                      {"}}"}
                    </p>
                  ))}
                  <p className="text-[10px] text-red-500 font-mono" dir="ltr">
                    {"{{"}error{"}}"}
                  </p>
                  <p className="text-[9px] text-gray-400 mt-1">{t("apiCallErrorVarHint")}</p>
                </div>
              )}

              {/* Currency toggle for Cloudbeds room availability */}
              {operationDef.id === "getAvailableRoomTypes" && (
                <Field label={t("outputCurrency")} hint={t("outputCurrencyHint")}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => update({ outputCurrency: "USD" })}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        (data.outputCurrency ?? "USD") === "USD"
                          ? "bg-amber-100 border-amber-300 text-amber-700"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >$ USD</button>
                    <button
                      type="button"
                      onClick={() => update({ outputCurrency: "ILS" })}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        data.outputCurrency === "ILS"
                          ? "bg-blue-100 border-blue-300 text-blue-700"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >₪ ILS</button>
                  </div>
                </Field>
              )}

              {/* Language toggle for Cloudbeds room availability */}
              {operationDef.id === "getAvailableRoomTypes" && (
                <Field label={t("outputLanguage")} hint={t("outputLanguageHint")}>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => update({ outputLanguage: "en" })}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        (data.outputLanguage ?? "en") === "en"
                          ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >EN</button>
                    <button
                      type="button"
                      onClick={() => update({ outputLanguage: "he" })}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        data.outputLanguage === "he"
                          ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >עב</button>
                  </div>
                </Field>
              )}
            </>
          )}
        </>
      )}

      {/* ── Raw mode (custom_api or no catalog match) ── */}
      {!isOperationMode && data.integrationId && (
        <>
          {/* Method */}
          <Field label={t("apiCallMethod")}>
            <select
              value={method}
              onChange={(e) => update({ method: e.target.value })}
              className="field-input"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
            </select>
          </Field>

          {/* Endpoint */}
          <Field label={t("apiCallEndpoint")} hint={t("apiCallEndpointHint")}>
            <input
              type="text"
              value={data.endpoint ?? ""}
              onChange={(e) => update({ endpoint: e.target.value })}
              className="field-input"
              dir="ltr"
              placeholder="/api/v1/rooms"
            />
          </Field>

          {/* Body template (POST/PUT only) */}
          {(method === "POST" || method === "PUT") && (
            <Field label={t("apiCallBody")} hint={t("apiCallBodyHint")}>
              <textarea
                value={data.bodyTemplate ?? ""}
                onChange={(e) => update({ bodyTemplate: e.target.value })}
                className="field-input min-h-[80px] resize-y font-mono text-[11px]"
                dir="ltr"
                placeholder='{"check_in": "{{checkin_date}}"}'
              />
            </Field>
          )}

          {/* Response mapping */}
          <ResponseMappingEditor
            mappings={data.responseMapping ?? []}
            onChange={(responseMapping) => update({ responseMapping })}
          />

          {/* Error message */}
          <Field label={t("apiCallErrorMessage")} hint={t("apiCallErrorMessageHint")}>
            <textarea
              value={data.errorMessage ?? ""}
              onChange={(e) => update({ errorMessage: e.target.value })}
              className="field-input min-h-[60px] resize-y"
              dir="rtl"
            />
          </Field>
        </>
      )}
    </>
  );
}

function ResponseMappingEditor({
  mappings,
  onChange,
}: {
  mappings: Array<{ jsonPath: string; variableName: string }>;
  onChange: (m: Array<{ jsonPath: string; variableName: string }>) => void;
}) {
  const { t } = useTranslation("flow");

  const addMapping = () => {
    if (mappings.length >= 10) return;
    onChange([...mappings, { jsonPath: "", variableName: "" }]);
  };

  const removeMapping = (index: number) => {
    onChange(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, patch: Partial<{ jsonPath: string; variableName: string }>) => {
    onChange(mappings.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  return (
    <div>
      <label className="text-xs font-semibold text-[#2D2A26] block mb-2">{t("apiCallResponseMapping")}</label>
      <div className="space-y-2 max-h-[240px] overflow-y-auto">
        {mappings.map((m, i) => (
          <div key={i} className="space-y-1 p-2 rounded-lg bg-[#FAF7F3] border border-[#EDE6DD]/60">
            <input
              type="text"
              value={m.jsonPath}
              onChange={(e) => updateMapping(i, { jsonPath: e.target.value })}
              placeholder={t("apiCallJsonPath")}
              className="field-input text-[11px]"
              dir="ltr"
            />
            <input
              type="text"
              value={m.variableName}
              onChange={(e) => updateMapping(i, { variableName: e.target.value })}
              placeholder={t("apiCallVariableName")}
              className="field-input text-[11px]"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => removeMapping(i)}
              className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> {t("deleteNode")}
            </button>
          </div>
        ))}
      </div>
      {mappings.length < 10 ? (
        <button
          type="button"
          onClick={addMapping}
          className="flex items-center gap-1 mt-2 text-xs text-[#FF7E47] hover:text-[#E86B38] cursor-pointer"
        >
          <Plus className="w-3 h-3" /> {t("apiCallAddMapping")}
        </button>
      ) : (
        <p className="text-[10px] text-[#A39B90] mt-1">{t("apiCallMaxMappings")}</p>
      )}
    </div>
  );
}

function KeywordsEditor({ keywords, disabled, onChange }: { keywords: string[]; disabled: boolean; onChange: (k: string[]) => void }) {
  const { t } = useTranslation("flow");

  const updateKeyword = (index: number, value: string) => {
    const next = [...keywords];
    next[index] = value;
    onChange(next);
  };

  const addKeyword = () => {
    onChange([...keywords, ""]);
  };

  const removeKeyword = (index: number) => {
    if (keywords.length <= 1) return;
    onChange(keywords.filter((_, i) => i !== index));
  };

  const hasEmpty = keywords.some((k) => !k.trim());

  return (
    <div>
      <label className="text-xs font-semibold text-[#2D2A26] block mb-1">{t("triggerText")}</label>
      <p className="text-[10px] text-[#A39B90] mb-1.5">{t("triggerTextHint")}</p>
      <div className="space-y-1.5">
        {keywords.map((kw, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="text"
              value={kw}
              onChange={(e) => updateKeyword(i, e.target.value)}
              placeholder={t("keywordPlaceholder")}
              className={`field-input flex-1 ${!kw.trim() && !disabled ? "!border-amber-400" : ""}`}
              dir="rtl"
            />
            {keywords.length > 1 && (
              <button
                type="button"
                onClick={() => removeKeyword(i)}
                className="p-1.5 rounded hover:bg-red-50 text-[#A39B90] hover:text-red-500 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addKeyword}
        className="flex items-center gap-1 mt-2 text-xs text-[#FF7E47] hover:text-[#E86B38] cursor-pointer"
      >
        <Plus className="w-3 h-3" /> {t("addKeyword")}
      </button>
      {hasEmpty && !disabled && (
        <div className="flex items-center gap-1 mt-1.5">
          <p className="text-[10px] text-amber-500">{t("triggerTextRequired")}</p>
          <FixedTooltip text={t("strictModeTooltip")}>
            <HelpCircle className="w-3 h-3 text-amber-400 cursor-help" />
          </FixedTooltip>
        </div>
      )}
    </div>
  );
}

function FixedTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: rect.left, y: rect.top });
    setVisible(true);
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  const TOOLTIP_W = 220;
  const GAP = 8;
  const anchorRight = pos.x - GAP;
  const fitsLeft = anchorRight - TOOLTIP_W > 0;

  return (
    <>
      <span ref={ref} onMouseEnter={show} onMouseLeave={hide} className="shrink-0 leading-none">
        {children}
      </span>
      {createPortal(
        <div
          style={{
            position: "fixed",
            top: pos.y - 4,
            ...(fitsLeft
              ? { right: window.innerWidth - anchorRight }
              : { left: pos.x + 20 }),
            width: TOOLTIP_W,
            zIndex: 9999,
            pointerEvents: "none",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(0)" : "translateX(4px)",
            transition: "opacity 150ms ease, transform 150ms ease",
          }}
        >
          <div className="bg-[#2D2A26] text-[#FAF7F3] text-[11px] leading-relaxed rounded-lg px-3 py-2.5 shadow-xl whitespace-pre-line" dir="auto">
            {text}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function capitalize(s: string): string {
  // Convert snake_case to PascalCase for i18n key lookup
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
