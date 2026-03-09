import React from "react";
import { Plus, Trash2, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FormField, FileUploadItem } from "@/types/form";
import { FileUploadZone } from "./FileUploadZone";

interface FormFieldRendererProps {
  field: FormField;
  fileCategoryOptions: { value: string; label: string }[];
  formValues: Record<string, string | string[] | boolean>;
  otherValues: Record<string, string>;
  setValue: (fieldId: string, value: string | string[] | boolean) => void;
  setOtherValue: (fieldId: string, value: string) => void;
  toggleCheckboxValue: (fieldId: string, option: string) => void;
  getUrlEntries: (fieldId: string) => Array<{ url: string; label: string }>;
  updateUrlEntry: (
    fieldId: string,
    index: number,
    key: "url" | "label",
    value: string,
  ) => void;
  addUrlEntry: (fieldId: string) => void;
  removeUrlEntry: (fieldId: string, index: number) => void;
  fileUploads: Record<string, FileUploadItem[]>;
  fileInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  handleFileSelect: (fieldId: string, files: FileList | null) => void;
  removeFileUpload: (fieldId: string, itemId: string) => void;
  updateFileMetadata: (
    fieldId: string,
    itemId: string,
    key: "category" | "itemName" | "description",
    value: string,
  ) => void;
}

/* ── Shared input styling ── */
const inputBase =
  "w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-4 py-3 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200";

const richTextClass =
  "[&_p]:m-0 [&_ol]:list-decimal [&_ol]:pr-5 [&_ol]:space-y-0.5 [&_ul]:list-disc [&_ul]:pr-5 [&_ul]:space-y-0.5 [&_li]:pr-1";

/* ── Warm-themed checkbox (matches OrangeCheck pattern) ── */
function WarmCheckbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "group flex items-center gap-3 w-full rounded-xl px-4 py-3.5 text-start transition-all duration-300",
        checked
          ? "bg-[#FF7E47]/8 border-2 border-[#FF7E47]/40"
          : "bg-[#FAF7F3] border-2 border-transparent hover:border-[#EDE6DD]",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200",
          checked
            ? "bg-[#FF7E47] border-[#FF7E47]"
            : "border-[#D5CCBF] group-hover:border-[#FF7E47]/40",
        )}
      >
        {checked && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="w-3 h-3 text-white"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M2 6L5 9L10 3"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        )}
      </div>
      <span
        className={cn(
          "text-sm font-medium transition-colors",
          checked ? "text-[#2D2A26]" : "text-[#7A7267]",
        )}
      >
        {label}
      </span>
    </button>
  );
}

/* ── Warm-themed radio pill (matches StylePill pattern) ── */
function WarmRadio({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300",
        selected
          ? "bg-[#FF7E47] text-white shadow-[0_2px_12px_rgba(255,126,71,0.3)]"
          : "bg-[#FAF7F3] text-[#7A7267] hover:bg-[#F3ECE3] border border-[#EDE6DD]",
      )}
    >
      {label}
    </motion.button>
  );
}

/* ── Toggle switch ── */
function WarmToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200",
        checked
          ? "bg-[#FF7E47] border-[#FF7E47]"
          : "bg-[#EDE6DD] border-[#E5DDD3]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5.5 w-5.5 rounded-full bg-white shadow-sm transition-transform duration-200",
          "h-[22px] w-[22px] mt-[1px]",
          checked ? "ltr:translate-x-5 rtl:-translate-x-5" : "ltr:translate-x-0.5 rtl:-translate-x-0.5",
        )}
      />
    </button>
  );
}

/* ── Label with rich text + required indicator ── */
function FieldLabel({
  field,
}: {
  field: FormField;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-bold text-[#2D2A26] flex items-start gap-1">
        {field.is_required && (
          <span className="text-red-400 leading-relaxed">*</span>
        )}
        <span
          className={richTextClass}
          dangerouslySetInnerHTML={{ __html: field.label }}
        />
      </div>
      {field.description && (
        <div
          className={`text-xs text-[#7A7267] ${richTextClass}`}
          dangerouslySetInnerHTML={{ __html: field.description }}
        />
      )}
    </div>
  );
}

export function FormFieldRenderer({
  field,
  fileCategoryOptions,
  formValues,
  otherValues,
  setValue,
  setOtherValue,
  toggleCheckboxValue,
  getUrlEntries,
  updateUrlEntry,
  addUrlEntry,
  removeUrlEntry,
  fileUploads,
  fileInputRefs,
  handleFileSelect,
  removeFileUpload,
  updateFileMetadata,
}: FormFieldRendererProps) {
  const { t } = useTranslation("common");
  const value = formValues[field.id];

  switch (field.field_type) {
    case "short_text":
      return (
        <div className="space-y-2">
          <FieldLabel field={field} />
          <input
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => setValue(field.id, e.target.value)}
            className={inputBase}
            required={field.is_required}
          />
        </div>
      );

    case "long_text":
      return (
        <div className="space-y-2">
          <FieldLabel field={field} />
          <textarea
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => setValue(field.id, e.target.value)}
            rows={4}
            className={cn(inputBase, "resize-none")}
            required={field.is_required}
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-2">
          <FieldLabel field={field} />
          <input
            type="number"
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => setValue(field.id, e.target.value)}
            className={inputBase}
            required={field.is_required}
          />
        </div>
      );

    case "url": {
      const entries = getUrlEntries(field.id);
      return (
        <div className="space-y-2">
          <FieldLabel field={field} />
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  placeholder={t("urlLabelPlaceholder")}
                  value={entry.label}
                  onChange={(e) =>
                    updateUrlEntry(field.id, idx, "label", e.target.value)
                  }
                  className={cn(inputBase, "w-36")}
                />
                <div className="relative flex-1">
                  <Globe className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8AFA4]" />
                  <input
                    type="url"
                    dir="ltr"
                    placeholder={field.placeholder || "https://www.example.com"}
                    value={entry.url}
                    onChange={(e) =>
                      updateUrlEntry(field.id, idx, "url", e.target.value)
                    }
                    className={cn(inputBase, "ps-9 flex-1")}
                    required={field.is_required && idx === 0}
                  />
                </div>
                {entries.length > 1 && (
                  <button
                    type="button"
                    className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-[#B8AFA4] hover:text-red-400 hover:bg-red-50 transition-colors"
                    onClick={() => removeUrlEntry(field.id, idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addUrlEntry(field.id)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-[#FF7E47] bg-[#FF7E47]/8 hover:bg-[#FF7E47]/15 border border-[#FF7E47]/20 transition-all duration-200"
          >
            <Plus className="w-4 h-4" /> {t("addLink")}
          </button>
        </div>
      );
    }

    case "toggle":
      return (
        <div className="flex items-center justify-between p-4 bg-[#FAF7F3] rounded-xl border border-[#EDE6DD]/50">
          <FieldLabel field={field} />
          <WarmToggle
            checked={!!value}
            onChange={(v) => setValue(field.id, v)}
          />
        </div>
      );

    case "checkbox": {
      const selected = (value as string[]) || [];
      return (
        <div className="space-y-2">
          <FieldLabel field={field} />
          <div className="space-y-2">
            {field.options.map((option) => (
              <WarmCheckbox
                key={option}
                checked={selected.includes(option)}
                onChange={() => toggleCheckboxValue(field.id, option)}
                label={option}
              />
            ))}
            {field.allow_other && (
              <div className="flex items-center gap-2">
                <WarmCheckbox
                  checked={selected.includes("__other__")}
                  onChange={() => toggleCheckboxValue(field.id, "__other__")}
                  label={t("other") + ":"}
                />
                <input
                  placeholder={t("enterValue")}
                  value={otherValues[field.id] ?? ""}
                  onChange={(e) => setOtherValue(field.id, e.target.value)}
                  className={cn(inputBase, "h-10 text-sm flex-1")}
                  disabled={!selected.includes("__other__")}
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    case "radio": {
      const radioValue = (value as string) ?? "";
      return (
        <div className="space-y-2">
          <FieldLabel field={field} />
          <div className="flex flex-wrap gap-2.5">
            {field.options.map((option) => (
              <WarmRadio
                key={option}
                selected={radioValue === option}
                onClick={() => setValue(field.id, option)}
                label={option}
              />
            ))}
            {field.allow_other && (
              <WarmRadio
                selected={radioValue === "__other__"}
                onClick={() => setValue(field.id, "__other__")}
                label={t("other")}
              />
            )}
          </div>
          {field.allow_other && radioValue === "__other__" && (
            <input
              placeholder={t("enterValue")}
              value={otherValues[field.id] ?? ""}
              onChange={(e) => setOtherValue(field.id, e.target.value)}
              className={cn(inputBase, "mt-2")}
            />
          )}
        </div>
      );
    }

    case "dropdown": {
      const dropdownValue = (value as string) ?? "";
      return (
        <div className="space-y-2">
          <FieldLabel field={field} />
          <select
            value={dropdownValue}
            onChange={(e) => setValue(field.id, e.target.value)}
            className={cn(inputBase, "h-12")}
          >
            <option value="">
              {field.placeholder || t("select")}
            </option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {field.allow_other && (
              <option value="__other__">{t("other")}</option>
            )}
          </select>
          {field.allow_other && dropdownValue === "__other__" && (
            <input
              placeholder={t("enterValue")}
              value={otherValues[field.id] ?? ""}
              onChange={(e) => setOtherValue(field.id, e.target.value)}
              className={inputBase}
            />
          )}
        </div>
      );
    }

    case "file_upload":
      return (
        <div className="space-y-3">
          <FieldLabel field={field} />
          <FileUploadZone
            uploads={fileUploads[field.id] ?? []}
            fileCategoryOptions={fileCategoryOptions}
            onFileInputRef={(el) => {
              fileInputRefs.current[field.id] = el;
            }}
            onFileSelect={(files) => handleFileSelect(field.id, files)}
            onRemove={(itemId) => removeFileUpload(field.id, itemId)}
            onUpdateMetadata={(itemId, key, val) =>
              updateFileMetadata(field.id, itemId, key, val)
            }
          />
        </div>
      );

    default:
      return (
        <div className="space-y-2">
          <FieldLabel field={field} />
          <input
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => setValue(field.id, e.target.value)}
            className={inputBase}
            required={field.is_required}
          />
        </div>
      );
  }
}
