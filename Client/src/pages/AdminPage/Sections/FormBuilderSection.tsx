import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Loader2,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  X,
  Check,
  Save,
  ListChecks,
} from "lucide-react";
import { supabase } from "@/services/supabase";
import { cn } from "@/lib/utils";
import RichTextEditor from "@/components/ui/rich-text-editor";
import type { Json } from "@/types/database";

// ─── Types ───────────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "url",
  "file",
  "number",
  "toggle",
] as const;

type FieldType = (typeof FIELD_TYPES)[number];

const HAS_OPTIONS: FieldType[] = ["select", "radio", "checkbox"];

type FormField = {
  id: string;
  field_type: string;
  label: string;
  placeholder: string;
  description: string;
  is_required: boolean;
  options: Json;
  allow_other: boolean;
  sort_order: number;
  created_at: string;
};

type FieldFormData = {
  field_type: FieldType;
  label: string;
  placeholder: string;
  description: string;
  is_required: boolean;
  options: string[];
  allow_other: boolean;
};

const EMPTY_FIELD: FieldFormData = {
  field_type: "text",
  label: "",
  placeholder: "",
  description: "",
  is_required: false,
  options: [""],
  allow_other: false,
};

// ─── Sortable Field Card ─────────────────────────────────────────────────────

function SortableFieldCard({
  field,
  onEdit,
  onDelete,
  isDeleting,
  isEditing,
  editPanel,
  t,
  fieldTypeLabel,
}: {
  field: FormField;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isEditing: boolean;
  editPanel: React.ReactNode;
  t: (key: string) => string;
  fieldTypeLabel: (type: string) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled: isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isEditing) {
    return <div ref={setNodeRef}>{editPanel}</div>;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 flex items-center gap-3",
        isDragging && "opacity-50 z-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-white/20 hover:text-white/40 cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-white truncate">{field.label}</p>
          {field.is_required && (
            <span className="text-[10px] text-[#FF6B2C]">*</span>
          )}
        </div>
        <p className="text-xs text-white/30 truncate">
          {fieldTypeLabel(field.field_type)}
          {field.description ? ` — ${field.description}` : ""}
        </p>
      </div>

      <span className="px-2 py-1 rounded-lg text-[11px] font-medium border bg-white/[0.04] text-white/40 border-white/[0.08] shrink-0">
        {fieldTypeLabel(field.field_type)}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer disabled:opacity-40"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Field Edit Panel ────────────────────────────────────────────────────────

function FieldEditPanel({
  data,
  onChange,
  onSave,
  onCancel,
  isSaving,
  isNew,
  t,
  fieldTypeLabel,
}: {
  data: FieldFormData;
  onChange: (data: FieldFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew: boolean;
  t: (key: string) => string;
  fieldTypeLabel: (type: string) => string;
}) {
  const showOptions = HAS_OPTIONS.includes(data.field_type);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mb-4 rounded-2xl border border-[#FF6B2C]/20 bg-[#FF6B2C]/[0.03] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">
            {isNew ? t("addNewField") : t("editField")}
          </h3>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Field type — only for new fields */}
        {isNew && (
          <div>
            <label className="block text-xs text-white/40 mb-1.5">
              {t("fieldTypeText").replace("טקסט קצר", "סוג שדה")}
            </label>
            <select
              value={data.field_type}
              onChange={(e) =>
                onChange({ ...data, field_type: e.target.value as FieldType })
              }
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FF6B2C]/40 transition-colors cursor-pointer"
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft} className="bg-[#1a1a1a]">
                  {fieldTypeLabel(ft)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Label */}
        <div>
          <label className="block text-xs text-white/40 mb-1.5">
            {t("fieldLabel")}
          </label>
          <input
            type="text"
            value={data.label}
            onChange={(e) => onChange({ ...data, label: e.target.value })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
          />
        </div>

        {/* Placeholder */}
        <div>
          <label className="block text-xs text-white/40 mb-1.5">
            {t("fieldPlaceholder")}
          </label>
          <input
            type="text"
            value={data.placeholder}
            onChange={(e) => onChange({ ...data, placeholder: e.target.value })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-white/40 mb-1.5">
            {t("fieldDescription")}
          </label>
          <input
            type="text"
            value={data.description}
            onChange={(e) => onChange({ ...data, description: e.target.value })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
          />
        </div>

        {/* Required toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => onChange({ ...data, is_required: !data.is_required })}
            className={cn(
              "w-10 h-6 rounded-full transition-all duration-200 relative cursor-pointer",
              data.is_required
                ? "bg-[#FF6B2C]"
                : "bg-white/[0.1]"
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200",
                data.is_required ? "left-5" : "left-1"
              )}
            />
          </button>
          <span className="text-sm text-white/60">{t("fieldRequired")}</span>
        </label>

        {/* Options — for select/radio/checkbox */}
        {showOptions && (
          <div>
            <label className="block text-xs text-white/40 mb-1.5">
              {t("fieldOptions")}
            </label>
            <div className="space-y-2">
              {data.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...data.options];
                      newOpts[i] = e.target.value;
                      onChange({ ...data, options: newOpts });
                    }}
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
                  />
                  {data.options.length > 1 && (
                    <button
                      onClick={() => {
                        const newOpts = data.options.filter((_, j) => j !== i);
                        onChange({ ...data, options: newOpts });
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() =>
                  onChange({ ...data, options: [...data.options, ""] })
                }
                className="text-xs text-[#FF6B2C]/70 hover:text-[#FF6B2C] transition-colors cursor-pointer"
              >
                + {t("addOption")}
              </button>
            </div>

            {/* Allow other */}
            <label className="flex items-center gap-3 mt-3 cursor-pointer">
              <button
                type="button"
                onClick={() =>
                  onChange({ ...data, allow_other: !data.allow_other })
                }
                className={cn(
                  "w-10 h-6 rounded-full transition-all duration-200 relative cursor-pointer",
                  data.allow_other
                    ? "bg-[#FF6B2C]"
                    : "bg-white/[0.1]"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200",
                    data.allow_other ? "left-5" : "left-1"
                  )}
                />
              </button>
              <span className="text-sm text-white/60">{t("allowOther")}</span>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onSave}
            disabled={isSaving || !data.label.trim()}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
              "bg-[#FF6B2C] text-white hover:bg-[#FF7E47]",
              (isSaving || !data.label.trim()) && "opacity-40 pointer-events-none"
            )}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {t("saveField")}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function FormBuilderSection() {
  const { t } = useTranslation("admin");
  const queryClient = useQueryClient();

  // ─── Field type label helper ─────────────────────────────────────────────
  const fieldTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      text: t("fieldTypeText"),
      textarea: t("fieldTypeTextarea"),
      select: t("fieldTypeSelect"),
      radio: t("fieldTypeRadio"),
      checkbox: t("fieldTypeCheckbox"),
      url: t("fieldTypeUrl"),
      file: t("fieldTypeFile"),
      number: t("fieldTypeNumber"),
      toggle: t("fieldTypeToggle"),
    };
    return map[type] ?? type;
  };

  // ─── Form Settings ───────────────────────────────────────────────────────
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin", "form-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_form_settings");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const [settings, setSettings] = useState({
    opening_title: "",
    opening_text: "",
    closing_title: "",
    closing_text: "",
  });
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    if (settingsData) {
      setSettings({
        opening_title: settingsData.opening_title ?? "",
        opening_text: settingsData.opening_text ?? "",
        closing_title: settingsData.closing_title ?? "",
        closing_text: settingsData.closing_text ?? "",
      });
      setSettingsDirty(false);
    }
  }, [settingsData]);

  const updateSetting = (key: keyof typeof settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("admin_update_form_settings", {
        p_opening_title: settings.opening_title,
        p_opening_text: settings.opening_text,
        p_closing_title: settings.closing_title,
        p_closing_text: settings.closing_text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSettingsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "form-settings"] });
    },
  });

  // ─── Form Fields ─────────────────────────────────────────────────────────
  const {
    data: fields,
    isLoading: fieldsLoading,
    isError: fieldsError,
  } = useQuery({
    queryKey: ["admin", "form-fields"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_form_fields");
      if (error) throw error;
      return (data as FormField[]).sort((a, b) => a.sort_order - b.sort_order);
    },
  });

  const [editingField, setEditingField] = useState<string | null>(null); // field id or "new"
  const [fieldForm, setFieldForm] = useState<FieldFormData>(EMPTY_FIELD);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toast
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const triggerToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }, []);

  const openNewField = () => {
    setEditingField("new");
    setFieldForm(EMPTY_FIELD);
  };

  const openEditField = (field: FormField) => {
    setEditingField(field.id);
    setFieldForm({
      field_type: field.field_type as FieldType,
      label: field.label,
      placeholder: field.placeholder ?? "",
      description: field.description ?? "",
      is_required: field.is_required,
      options: Array.isArray(field.options)
        ? (field.options as string[])
        : [""],
      allow_other: field.allow_other ?? false,
    });
  };

  const closeEdit = () => {
    setEditingField(null);
    setFieldForm(EMPTY_FIELD);
  };

  const addFieldMutation = useMutation({
    mutationFn: async (data: FieldFormData) => {
      const { error } = await supabase.rpc("admin_add_form_field", {
        p_field_type: data.field_type,
        p_label: data.label,
        p_placeholder: data.placeholder || "",
        p_description: data.description || undefined,
        p_is_required: data.is_required,
        p_options: HAS_OPTIONS.includes(data.field_type)
          ? (data.options.filter((o) => o.trim()) as unknown as Json)
          : undefined,
        p_allow_other: HAS_OPTIONS.includes(data.field_type)
          ? data.allow_other
          : undefined,
        p_sort_order: (fields?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      closeEdit();
      triggerToast();
      queryClient.invalidateQueries({ queryKey: ["admin", "form-fields"] });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: FieldFormData;
    }) => {
      const { error } = await supabase.rpc("admin_update_form_field", {
        p_id: id,
        p_label: data.label,
        p_placeholder: data.placeholder || "",
        p_description: data.description || undefined,
        p_is_required: data.is_required,
        p_options: HAS_OPTIONS.includes(data.field_type)
          ? (data.options.filter((o) => o.trim()) as unknown as Json)
          : undefined,
        p_allow_other: HAS_OPTIONS.includes(data.field_type)
          ? data.allow_other
          : undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      closeEdit();
      triggerToast();
      queryClient.invalidateQueries({ queryKey: ["admin", "form-fields"] });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("admin_delete_form_field", {
        p_id: id,
      });
      if (error) throw error;
    },
    onMutate: (id) => setDeletingId(id),
    onSettled: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "form-fields"] });
    },
  });

  // ─── Drag and Drop ───────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !fields) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder locally
    const reordered = [...fields];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update sort_order for all affected fields
    const updates = reordered.map((f, i) => ({
      id: f.id,
      sort_order: i + 1,
    }));

    // Optimistic update
    queryClient.setQueryData(
      ["admin", "form-fields"],
      reordered.map((f, i) => ({ ...f, sort_order: i + 1 }))
    );

    // Persist
    for (const u of updates) {
      await supabase.rpc("admin_update_field_order", {
        p_id: u.id,
        p_sort_order: u.sort_order,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["admin", "form-fields"] });
  };

  const handleSaveField = () => {
    if (editingField === "new") {
      addFieldMutation.mutate(fieldForm);
    } else if (editingField) {
      updateFieldMutation.mutate({ id: editingField, data: fieldForm });
    }
  };

  const isLoading = settingsLoading || fieldsLoading;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-white">
          {t("formBuilderTitle")}
        </h1>
        <p className="text-white/40 text-sm mt-1">
          {t("formBuilderSubtitle")}
        </p>
      </motion.div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B2C]" />
        </div>
      )}

      {!isLoading && (
        <div className="space-y-10">
          {/* ─── Section A: Form Settings ─────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <h2 className="text-lg font-bold text-white mb-4">
              {t("formSettingsTitle")}
            </h2>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-5">
              {/* Opening title */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">
                  {t("openingTitle")}
                </label>
                <input
                  type="text"
                  value={settings.opening_title}
                  onChange={(e) =>
                    updateSetting("opening_title", e.target.value)
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
                />
              </div>

              {/* Opening text (rich) */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">
                  {t("openingText")}
                </label>
                <RichTextEditor
                  value={settings.opening_text}
                  onChange={(html) => updateSetting("opening_text", html)}
                />
              </div>

              {/* Closing title */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">
                  {t("closingTitle")}
                </label>
                <input
                  type="text"
                  value={settings.closing_title}
                  onChange={(e) =>
                    updateSetting("closing_title", e.target.value)
                  }
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
                />
              </div>

              {/* Closing text (rich) */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">
                  {t("closingText")}
                </label>
                <RichTextEditor
                  value={settings.closing_text}
                  onChange={(html) => updateSetting("closing_text", html)}
                />
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={
                    !settingsDirty || saveSettingsMutation.isPending
                  }
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                    "bg-[#FF6B2C] text-white hover:bg-[#FF7E47]",
                    (!settingsDirty || saveSettingsMutation.isPending) &&
                      "opacity-40 pointer-events-none"
                  )}
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {t("saveSettings")}
                </button>
                {saveSettingsMutation.isSuccess && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs text-emerald-400"
                  >
                    {t("settingsSaved")}
                  </motion.span>
                )}
                {saveSettingsMutation.isError && (
                  <span className="text-xs text-red-400">
                    {t("settingsError")}
                  </span>
                )}
              </div>
            </div>
          </motion.section>

          {/* ─── Section B: Form Fields ───────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {t("formFieldsTitle")}
              </h2>
              <button
                onClick={openNewField}
                disabled={editingField === "new"}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer",
                  "bg-[#FF6B2C]/15 text-[#FF6B2C] border border-[#FF6B2C]/20 hover:bg-[#FF6B2C]/25",
                  editingField === "new" && "opacity-40 pointer-events-none"
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                {t("addNewField")}
              </button>
            </div>

            {/* Add new field panel */}
            <AnimatePresence>
              {editingField === "new" && (
                <FieldEditPanel
                  data={fieldForm}
                  onChange={setFieldForm}
                  onSave={handleSaveField}
                  onCancel={closeEdit}
                  isSaving={addFieldMutation.isPending}
                  isNew
                  t={t}
                  fieldTypeLabel={fieldTypeLabel}
                />
              )}
            </AnimatePresence>

            {fieldsError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-red-400 text-sm mb-4">
                {t("errorLoadFailed")}
              </div>
            )}

            {/* Empty state */}
            {fields?.length === 0 && editingField !== "new" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-16 text-white/20"
              >
                <ListChecks className="w-12 h-12 mb-4" />
                <p className="text-base">{t("noFields")}</p>
              </motion.div>
            )}

            {/* Sortable field list */}
            {fields && fields.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {fields.map((field) => (
                    <SortableFieldCard
                      key={field.id}
                      field={field}
                      onEdit={() => openEditField(field)}
                      onDelete={() =>
                        deleteFieldMutation.mutate(field.id)
                      }
                      isDeleting={deletingId === field.id}
                      isEditing={editingField === field.id}
                      editPanel={
                        editingField === field.id ? (
                          <FieldEditPanel
                            data={fieldForm}
                            onChange={setFieldForm}
                            onSave={handleSaveField}
                            onCancel={closeEdit}
                            isSaving={updateFieldMutation.isPending}
                            isNew={false}
                            t={t}
                            fieldTypeLabel={fieldTypeLabel}
                          />
                        ) : null
                      }
                      t={t}
                      fieldTypeLabel={fieldTypeLabel}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </motion.section>
        </div>
      )}

      {/* ─── Success Toast ───────────────────────────────────────────── */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div
            key="field-save-toast"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-6 left-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border border-emerald-500/20 bg-[#0D0D0D] shadow-[0_0_0_1px_rgba(16,185,129,0.08),0_8px_32px_rgba(0,0,0,0.6)]"
          >
            <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white leading-none mb-0.5">
                {t("fieldSaved")}
              </p>
              <p className="text-[11px] text-white/35 leading-none">
                {t("fieldSavedSub")}
              </p>
            </div>
            <motion.div
              className="absolute bottom-0 left-0 h-[2px] bg-emerald-500/40 rounded-b-2xl"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 2.5, ease: "linear" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
