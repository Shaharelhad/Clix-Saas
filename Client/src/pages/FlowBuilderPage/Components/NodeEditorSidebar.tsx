import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import type { FlowNode, FlowNodeData, ButtonItem } from "@/types/flow";
import { supabase } from "@/services/supabase";
import { useAuthStore } from "@/store/auth.store";

interface NodeEditorSidebarProps {
  node: FlowNode | null;
  onUpdate: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onClose: () => void;
  isLocked: boolean;
}

export default function NodeEditorSidebar({ node, onUpdate, onClose, isLocked }: NodeEditorSidebarProps) {
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
      <fieldset disabled={isLocked} className={isLocked ? "opacity-60" : ""}>
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

        {/* Image upload */}
        {data.type === "image" && (
          <ImageUploadField
            imageUrl={data.imageUrl ?? ""}
            onUpdate={(imageUrl) => update({ imageUrl })}
          />
        )}

        {/* Expected reply / continue on any */}
        {(data.type === "text" || data.type === "image") && (
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
                  onChange={(e) => update({ continueAuto: e.target.checked, ...(e.target.checked ? { expectedReply: "" } : {}) })}
                  className="sr-only peer"
                />
                <div className="w-8 h-[18px] bg-[#EDE6DD] rounded-full peer peer-checked:bg-[#FF7E47] after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:shadow-sm" />
              </label>
            </div>
          </div>
        )}

        {/* Buttons list */}
        {data.type === "buttons" && (
          <ButtonsEditor
            buttons={data.buttons ?? []}
            onChange={(buttons) => update({ buttons })}
          />
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

function capitalize(s: string): string {
  // Convert snake_case to PascalCase for i18n key lookup
  return s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}
