import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Users,
  MessageSquare,
  ImageIcon,
  MoreHorizontal,
  ShieldCheck,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useFormFields } from "@/hooks/useFormFields";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useFormFieldsQuery } from "@/hooks/useFormData";
import { useAutoPublish } from "@/hooks/useAutoPublish";
import { FormFieldRenderer } from "@/components/form/FormFieldRenderer";
import FeedbackBanner from "@/components/FeedbackBanner";
import { SubmissionProgress } from "@/components/SubmissionProgress";
import type { SubmissionPhase, ScrapeProgress } from "@/components/SubmissionProgress";
import { CategoryDock } from "@/components/ui/CategoryDock";
import { callFormUpdate } from "@/services/edge-functions";
import { pollScrapeStatus } from "@/lib/scrape-poller";
import { buildFileCategoryOptions } from "@/lib/form-constants";
import { stagger, fadeUp, EASE } from "@/lib/animations";
import type { FormField } from "@/types/form";
import type { LucideIcon } from "lucide-react";

/* ── Category config ── */

interface CategoryDef {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  range: [number, number];
}

const CATEGORIES: CategoryDef[] = [
  { id: "about", labelKey: "categoryAbout", icon: Building2, range: [0, 4] },
  { id: "audience", labelKey: "categoryAudience", icon: Users, range: [5, 6] },
  { id: "rules", labelKey: "categoryRules", icon: ShieldCheck, range: [-1, -1] }, // populated by field_type routing
  { id: "communication", labelKey: "categoryCommunication", icon: MessageSquare, range: [7, 10] },
  { id: "media", labelKey: "categoryMedia", icon: ImageIcon, range: [11, 99] }, // also captures url + file_upload fields
];

const OTHER_CATEGORY: CategoryDef = {
  id: "other",
  labelKey: "categoryOther",
  icon: MoreHorizontal,
  range: [-1, -1],
};

interface CategoryGroup {
  category: CategoryDef;
  fields: FormField[];
}

function groupFieldsByCategory(fields: FormField[]): CategoryGroup[] {
  const groups = new Map<string, FormField[]>();
  for (const cat of CATEGORIES) groups.set(cat.id, []);
  groups.set(OTHER_CATEGORY.id, []);

  const MEDIA_FIELD_TYPES = new Set(["url", "file_upload"]);
  const RULES_FIELD_TYPES = new Set(["rules_list"]);
  const HIDDEN_FIELD_TYPES = new Set(["qa_pairs"]); // handled by FAQ tab
  // Override: move specific sort_orders to a different category (prepend = insert at front)
  const SORT_ORDER_OVERRIDES: Record<number, string> = {
    9: "audience", // "What is important to you for the bot to do first?"
  };
  // Fields in the media range that aren't url/file_upload → prepend to communication
  const COMM_PREPEND: FormField[] = [];

  for (const field of fields) {
    if (HIDDEN_FIELD_TYPES.has(field.field_type)) continue;
    if (MEDIA_FIELD_TYPES.has(field.field_type)) {
      groups.get("media")!.push(field);
      continue;
    }
    if (RULES_FIELD_TYPES.has(field.field_type)) {
      groups.get("rules")!.push(field);
      continue;
    }
    // Check sort_order overrides
    const overrideCat = SORT_ORDER_OVERRIDES[field.sort_order];
    if (overrideCat && groups.has(overrideCat)) {
      groups.get(overrideCat)!.push(field);
      continue;
    }
    let assigned = false;
    for (const cat of CATEGORIES) {
      if (field.sort_order >= cat.range[0] && field.sort_order <= cat.range[1]) {
        // Non-media-type fields caught by the media range → prepend to communication
        if (cat.id === "media") {
          COMM_PREPEND.push(field);
        } else {
          groups.get(cat.id)!.push(field);
        }
        assigned = true;
        break;
      }
    }
    if (!assigned) groups.get(OTHER_CATEGORY.id)!.push(field);
  }

  // Prepend overflow fields to communication (so they appear at the top)
  if (COMM_PREPEND.length > 0) {
    groups.set("communication", [...COMM_PREPEND, ...groups.get("communication")!]);
  }

  const result: CategoryGroup[] = [];
  for (const cat of [...CATEGORIES, OTHER_CATEGORY]) {
    const catFields = groups.get(cat.id)!;
    if (catFields.length > 0) result.push({ category: cat, fields: catFields });
  }
  return result;
}

/* ── Map additional_info JSON back to form field values ── */
function mapResponseToFields(
  fields: FormField[],
  response: Record<string, unknown>,
): {
  formValues: Record<string, string | string[] | boolean>;
  urlEntries: Record<string, Array<{ url: string; label: string }>>;
} {
  const formValues: Record<string, string | string[] | boolean> = {};
  const urlEntries: Record<string, Array<{ url: string; label: string }>> = {};

  let answers: Record<string, unknown> = {};
  const raw = response.additional_info;
  if (typeof raw === "string") {
    try { answers = JSON.parse(raw); } catch { /* ignore */ }
  } else if (raw && typeof raw === "object") {
    answers = raw as Record<string, unknown>;
  }

  for (const field of fields) {
    const val = answers[field.label];
    if (val == null || val === "") continue;

    if (field.field_type === "url") {
      if (Array.isArray(val)) {
        urlEntries[field.id] = val.map((entry: unknown) => {
          const e = entry as Record<string, unknown> | string | null;
          const isObj = e !== null && typeof e === "object";
          return {
            url: String(isObj ? (e as Record<string, unknown>).url ?? "" : e ?? ""),
            label: String(isObj ? (e as Record<string, unknown>).label ?? "" : ""),
          };
        });
      } else {
        urlEntries[field.id] = [{ url: String(val), label: "" }];
      }
    } else if (field.field_type === "checkbox" || field.field_type === "multi_select") {
      formValues[field.id] = Array.isArray(val) ? val.map(String) : [String(val)];
    } else {
      formValues[field.id] = String(val);
    }
  }

  return { formValues, urlEntries };
}

/* ── Dirty tracking helpers ── */

type Snapshot = Record<string, string>;

function takeFieldSnapshot(
  fieldIds: string[],
  formValues: Record<string, string | string[] | boolean>,
  urlEntries: Record<string, Array<{ url: string; label: string }>>,
): Snapshot {
  const snap: Snapshot = {};
  for (const id of fieldIds) {
    snap[`v_${id}`] = JSON.stringify(formValues[id] ?? "");
    snap[`u_${id}`] = JSON.stringify(urlEntries[id] ?? []);
  }
  return snap;
}

function isSnapshotDirty(
  fieldIds: string[],
  formValues: Record<string, string | string[] | boolean>,
  urlEntries: Record<string, Array<{ url: string; label: string }>>,
  snapshot: Snapshot,
): boolean {
  for (const id of fieldIds) {
    if (JSON.stringify(formValues[id] ?? "") !== (snapshot[`v_${id}`] ?? '""')) return true;
    if (JSON.stringify(urlEntries[id] ?? []) !== (snapshot[`u_${id}`] ?? "[]")) return true;
  }
  return false;
}

/* ── Category Card sub-component ── */

type FormFieldHandlers = Omit<React.ComponentProps<typeof FormFieldRenderer>, "field">;

interface CategoryCardProps {
  category: CategoryDef;
  catFields: FormField[];
  dirty: boolean;
  saving: boolean;
  feedback: "success" | "error" | undefined;
  onSave: () => void;
  onReset: () => void;
  t: (key: string) => string;
  formFieldProps: FormFieldHandlers;
}

function CategoryCard({
  category,
  catFields,
  dirty,
  saving,
  feedback,
  onSave,
  onReset,
  t,
  formFieldProps,
}: CategoryCardProps) {
  const Icon = category.icon;

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50 overflow-hidden">
      {/* Category header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EDE6DD]/40">
        <div className="w-8 h-8 rounded-lg bg-[#FF7E47]/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-[#FF7E47]" />
        </div>
        <h3 className="font-bold text-[#2D2A26] text-sm">
          {t(category.labelKey)}
        </h3>
        <span className="text-xs text-[#A39B90] bg-[#FAF7F3] px-2 py-0.5 rounded-full">
          {catFields.length}
        </span>
      </div>

      {/* Fields */}
      <div className="px-6 py-4 space-y-6">
        {catFields.map((field) => (
          <FormFieldRenderer key={field.id} field={field} {...formFieldProps} />
        ))}
      </div>

      {/* Per-category feedback */}
      {feedback && (
        <div className="px-6 pb-3">
          <FeedbackBanner
            variant={feedback === "success" ? "success" : "error"}
            message={feedback === "success" ? t("categorySaved") : t("saveError")}
          />
        </div>
      )}

      {/* Per-category Save/Cancel */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-[#EDE6DD]/40 bg-[#FEFCFA]">
              <button
                type="button"
                onClick={onReset}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-[#7A7267] hover:text-[#2D2A26] hover:bg-[#EDE6DD]/40 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                {t("cancelChanges")}
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-[#FF7E47] hover:bg-[#E86B38] text-white transition-colors shadow-[0_2px_12px_rgba(255,126,71,0.25)] cursor-pointer disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 key="loader" className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles key="sparkles" className="w-4 h-4" />
                )}
                <span>{saving ? t("saving") : t("saveChanges")}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

export default function BusinessContentSection() {
  const { t } = useTranslation("dashboard");
  const { t: tCreateBot } = useTranslation("createBot");
  const { user } = useAuth();
  const navigate = useNavigate();
  const { autoPublish } = useAutoPublish();
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<SubmissionPhase>("prompt");
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress>({ pages: 0, products: 0 });
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [categoryFeedback, setCategoryFeedback] = useState<Record<string, "success" | "error">>({});
  const [activeCategoryId, setActiveCategoryId] = useState<string>("about");
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);

  // Snapshots for dirty tracking per category
  const snapshotsRef = useRef<Record<string, Snapshot>>({});

  const fileCategoryOptions = buildFileCategoryOptions(tCreateBot);

  const {
    formValues,
    setFormValues,
    otherValues,
    urlEntries,
    setUrlEntries,
    setValue,
    setOtherValue,
    toggleCheckboxValue,
    getUrlEntries,
    updateUrlEntry,
    addUrlEntry,
    removeUrlEntry,
    getQaEntries,
    updateQaEntry,
    addQaEntry,
    removeQaEntry,
    getRulesEntries,
    updateRulesItem,
    addRulesItem,
    removeRulesItem,
    resolveFieldValue,
  } = useFormFields();

  const {
    fileUploads,
    fileInputRefs,
    handleFileSelect,
    removeFileUpload,
    updateFileMetadata,
  } = useFileUpload(user?.id);

  /* ── Fetch form fields & settings ── */
  const { data: fields = [], isLoading: fieldsLoading } = useFormFieldsQuery();
  /* ── Fetch stored form response ── */
  const { data: formResponse, isLoading: responseLoading } = useQuery({
    queryKey: ["form_response", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("form_responses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (error || !data) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  /* ── Computed groups (memoized) ── */
  const groups = useMemo(() => groupFieldsByCategory(fields), [fields]);

  /* ── Pre-populate form + take initial snapshots ── */
  useEffect(() => {
    if (initialized.current || !formResponse || fields.length === 0) return;
    initialized.current = true;

    const { formValues: mapped, urlEntries: mappedUrls } = mapResponseToFields(
      fields,
      formResponse as unknown as Record<string, unknown>,
    );

    setFormValues(mapped);
    setUrlEntries(mappedUrls);

    // Take initial snapshots per category (using mapped values, not stale state)
    const groupsNow = groupFieldsByCategory(fields);
    const snaps: Record<string, Snapshot> = {};
    for (const { category, fields: catFields } of groupsNow) {
      const fieldIds = catFields.map((f) => f.id);
      snaps[category.id] = takeFieldSnapshot(fieldIds, mapped, mappedUrls);
    }
    snapshotsRef.current = snaps;
  }, [formResponse, fields, setFormValues, setUrlEntries]);

  /* ── Dirty check per category ── */
  const isCategoryDirty = useCallback(
    (categoryId: string, catFields: FormField[]): boolean => {
      const snap = snapshotsRef.current[categoryId];
      if (!snap) return false;
      return isSnapshotDirty(
        catFields.map((f) => f.id),
        formValues,
        urlEntries,
        snap,
      );
    },
    [formValues, urlEntries],
  );

  /* ── Reset category to snapshot ── */
  const resetCategory = useCallback(
    (categoryId: string, catFields: FormField[]) => {
      const snap = snapshotsRef.current[categoryId];
      if (!snap) return;

      setFormValues((prev) => {
        const next = { ...prev };
        for (const f of catFields) {
          const val = snap[`v_${f.id}`];
          if (val !== undefined) next[f.id] = JSON.parse(val);
        }
        return next;
      });

      setUrlEntries((prev) => {
        const next = { ...prev };
        for (const f of catFields) {
          const val = snap[`u_${f.id}`];
          if (val !== undefined) next[f.id] = JSON.parse(val);
        }
        return next;
      });
    },
    [setFormValues, setUrlEntries],
  );

  /* ── Commit snapshot after save ── */
  const commitCategory = useCallback(
    (categoryId: string, catFields: FormField[]) => {
      const fieldIds = catFields.map((f) => f.id);
      snapshotsRef.current[categoryId] = takeFieldSnapshot(fieldIds, formValues, urlEntries);
    },
    [formValues, urlEntries],
  );

  /* ── Set initial active category to first available group ── */
  useEffect(() => {
    if (groups.length > 0 && !groups.some((g) => g.category.id === activeCategoryId)) {
      setActiveCategoryId(groups[0].category.id);
    }
  }, [groups, activeCategoryId]);

  /* ── Poll scrape status (delegated to shared utility) ── */
  const startScrapePolling = async (userId: string) => {
    setLoadingPhase("scraping");
    await pollScrapeStatus(userId, {
      onProgress: (pages, products) => setScrapeProgress({ pages, products }),
    });
  };

  /* ── Validate category fields ── */
  const validateCategory = (catFields: FormField[]): string | null => {
    const missingRequired = catFields.filter((f) => {
      if (!f.is_required) return false;
      if (f.field_type === "url") {
        return !getUrlEntries(f.id).some((entry) => entry.url.trim());
      }
      if (f.field_type === "file_upload") {
        return !(fileUploads[f.id] ?? []).some((u) => u.uploaded && u.storedUrl);
      }
      const val = formValues[f.id];
      if (val === undefined || val === "" || val === null) return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });
    if (missingRequired.length > 0) return tCreateBot("missingFields");

    const stillUploading = catFields
      .filter((f) => f.field_type === "file_upload")
      .some((f) => (fileUploads[f.id] ?? []).some((u) => u.uploading));
    if (stillUploading) return tCreateBot("common:filesStillUploading");

    return null;
  };

  /* ── Temporarily show feedback, then auto-clear after 3s ── */
  const showFeedback = (categoryId: string, variant: "success" | "error") => {
    setCategoryFeedback((prev) => ({ ...prev, [categoryId]: variant }));
    if (variant === "success") {
      setTimeout(() => {
        setCategoryFeedback((prev) => {
          const next = { ...prev };
          delete next[categoryId];
          return next;
        });
      }, 3000);
    }
  };

  /* ── Save a category (sends ALL fields to backend) ── */
  const handleCategorySave = async (categoryId: string, catFields: FormField[]) => {
    const validationError = validateCategory(catFields);
    if (validationError) {
      showFeedback(categoryId, "error");
      return;
    }

    setSavingCategory(categoryId);
    setCategoryFeedback((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });

    try {
      // Build full payload from ALL fields
      const fieldsPayload: Record<string, unknown> = {};
      for (const field of fields) {
        fieldsPayload[field.label] = resolveFieldValue(field, fileUploads);
      }

      const result = await callFormUpdate({
        user_id: user?.id ?? "",
        full_name: user?.full_name ?? "",
        fields: fieldsPayload,
      });
      if (result.error) throw new Error(result.error);

      const data = result.data as {
        success?: boolean;
        scrape_job_id?: string;
      } | null;

      if (data?.scrape_job_id) {
        setIsSubmitting(true);
        await startScrapePolling(user?.id ?? "");
        setLoadingPhase("done");
        await new Promise((r) => setTimeout(r, 800));
        setIsSubmitting(false);
      }

      await autoPublish();
      // Force-refetch so cache has fresh data (prevents stale data on remount)
      await queryClient.refetchQueries({ queryKey: ["form_response", user?.id] });

      // Commit snapshot (ref update) + show feedback. Keep savingCategory set so the
      // button content (LoaderCircle) stays stable during the AnimatePresence exit
      // animation — swapping icons inside an exiting element causes insertBefore errors.
      commitCategory(categoryId, catFields);
      showFeedback(categoryId, "success");
      setTimeout(() => setSavingCategory(null), 300);
    } catch {
      showFeedback(categoryId, "error");
      setSavingCategory(null);
    }
  };

  /* ── Dock tab handler ── */
  const switchCategory = (categoryId: string) => {
    const currentIdx = groups.findIndex((g) => g.category.id === activeCategoryId);
    const nextIdx = groups.findIndex((g) => g.category.id === categoryId);
    setSlideDirection(nextIdx >= currentIdx ? 1 : -1);
    setActiveCategoryId(categoryId);
  };

  const loading = fieldsLoading || responseLoading;

  /* ── Render ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF7E47]" />
      </div>
    );
  }

  if (!formResponse) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-4">
        <FileText className="w-12 h-12 text-[#A39B90] mb-4" />
        <p className="text-[#7A7267] text-sm mb-4">{t("noFormData")}</p>
        <button
          type="button"
          onClick={() => navigate("/create-bot")}
          className="px-6 py-2.5 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold rounded-xl transition-colors"
        >
          {t("goToCreateBot")}
        </button>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6 pt-4"
      >
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50"
        >
          <SubmissionProgress phase={loadingPhase} scrapeProgress={scrapeProgress} />
        </motion.div>
      </motion.div>
    );
  }

  const activeGroup = groups.find((g) => g.category.id === activeCategoryId);

  // Bundle form field handler props to avoid repeating 20+ props
  const formFieldProps = {
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
    getQaEntries,
    updateQaEntry,
    addQaEntry,
    removeQaEntry,
    getRulesEntries,
    updateRulesItem,
    addRulesItem,
    removeRulesItem,
    fileUploads,
    fileInputRefs,
    handleFileSelect,
    removeFileUpload,
    updateFileMetadata,
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Active category card — single view, no scroll between categories */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait" custom={slideDirection}>
          {activeGroup && (
            <motion.div
              key={activeGroup.category.id}
              custom={slideDirection}
              initial={{ opacity: 0, x: slideDirection * 40 }}
              animate={{ opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } }}
              exit={{ opacity: 0, x: slideDirection * -40, transition: { duration: 0.2 } }}
              className="pb-4"
            >
              <CategoryCard
                category={activeGroup.category}
                catFields={activeGroup.fields}
                dirty={isCategoryDirty(activeGroup.category.id, activeGroup.fields)}
                saving={savingCategory === activeGroup.category.id}
                feedback={categoryFeedback[activeGroup.category.id]}
                onSave={() => handleCategorySave(activeGroup.category.id, activeGroup.fields)}
                onReset={() => resetCategory(activeGroup.category.id, activeGroup.fields)}
                t={t}
                formFieldProps={formFieldProps}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Category Dock — fixed at bottom */}
      <CategoryDock
        items={groups.map(({ category }) => ({
          icon: category.icon,
          label: t(category.labelKey),
          isActive: activeCategoryId === category.id,
          onClick: () => switchCategory(category.id),
        }))}
      />
    </div>
  );
}
