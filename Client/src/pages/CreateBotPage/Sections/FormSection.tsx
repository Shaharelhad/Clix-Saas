import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Shield, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import { supabase } from "@/services/supabase";
import {
  callFormSubmission,
  callScrapeStatus,
} from "@/services/edge-functions";
import { useAuth } from "@/hooks/useAuth";
import { useFormFields } from "@/hooks/useFormFields";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FormFieldRenderer, parseListItems } from "@/components/form/FormFieldRenderer";
import { SubmissionProgress } from "@/components/SubmissionProgress";
import type { SubmissionPhase, ScrapeProgress } from "@/components/SubmissionProgress";
import { RICH_TEXT_CLASS, buildFileCategoryOptions } from "@/lib/form-constants";
import WizardNavigator from "./WizardNavigator";
import type { FormField, FormSettings } from "@/types/form";

/* ── Sub-field key for storing split long_text items ── */
const subFieldKey = (fieldId: string, idx: number) =>
  `${fieldId}__sub__${idx}`;

interface FormSectionProps {
  onNext: () => void;
}

/* ── Animation helpers ── */
const EASE = [0.22, 1, 0.36, 1] as const;

const stepVariants = {
  enter: (dir: number) => ({ y: dir > 0 ? 50 : -50, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? -50 : 50, opacity: 0 }),
};

/* ── Step types ── */
type WizardStep =
  | { type: "opening"; settings: FormSettings }
  | { type: "field"; field: FormField }
  | { type: "sub_field"; field: FormField; label: string; index: number; totalSubs: number; parentLabel: string }
  | { type: "closing"; settings: FormSettings };

const FormSection = ({ onNext }: FormSectionProps) => {
  const { t } = useTranslation("createBot");
  const { user, refreshProfile } = useAuth();
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const handleSubmitRef = useRef<() => void>(() => {});

  /* ── Submission state ── */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<SubmissionPhase>("prompt");
  const [scrapeProgress, setScrapeProgress] = useState<ScrapeProgress>({ pages: 0, products: 0 });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  const fileCategoryOptions = buildFileCategoryOptions(t);

  /* ── Form field state management ── */
  const {
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
    resolveFieldValue,
  } = useFormFields();

  const {
    fileUploads,
    fileInputRefs,
    handleFileSelect,
    removeFileUpload,
    updateFileMetadata,
  } = useFileUpload(user?.id);

  /* ── Fetch form fields from Supabase ── */
  const { data: fields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ["form_fields"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_form_fields");
      if (error) throw error;
      return ((data as any[]) ?? []).map((f: any) => ({
        ...f,
        options: Array.isArray(f.options) ? f.options : [],
      })) as FormField[];
    },
  });

  /* ── Fetch form settings (opening/closing text) ── */
  const { data: settings } = useQuery({
    queryKey: ["form_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_form_settings");
      if (error) throw error;
      const row = (data as any)?.[0];
      if (row) {
        return {
          opening_title: row.opening_title ?? "",
          opening_text: row.opening_text ?? "",
          closing_title: row.closing_title ?? "",
          closing_text: row.closing_text ?? "",
        } as FormSettings;
      }
      return null;
    },
  });

  /* ── Build wizard steps (split long_text with numbered lists into sub-steps) ── */
  const steps = useMemo(() => {
    const result: WizardStep[] = [];
    if (settings && (settings.opening_title || settings.opening_text)) {
      result.push({ type: "opening", settings });
    }
    for (const field of fields) {
      if (field.field_type === "long_text" && field.description) {
        const items = parseListItems(field.description);
        if (items.length >= 2) {
          // Split into individual sub-field steps
          const plainLabel = (() => {
            const div = document.createElement("div");
            div.innerHTML = field.label;
            return div.textContent ?? field.label;
          })();
          for (let i = 0; i < items.length; i++) {
            result.push({
              type: "sub_field",
              field,
              label: items[i],
              index: i,
              totalSubs: items.length,
              parentLabel: plainLabel,
            });
          }
          continue;
        }
      }
      result.push({ type: "field", field });
    }
    if (settings && settings.closing_text) {
      result.push({ type: "closing", settings });
    }
    return result;
  }, [fields, settings]);

  /* ── Wizard navigation state ── */
  const [wizardStep, setWizardStep] = useState(() => {
    const saved = sessionStorage.getItem("createBot_wizardStep");
    return saved ? Number(saved) : 0;
  });
  const [direction, setDirection] = useState(1);

  // Clamp wizard step when steps array changes
  useEffect(() => {
    if (steps.length > 0 && wizardStep >= steps.length) {
      setWizardStep(steps.length - 1);
    }
  }, [steps.length, wizardStep]);

  // Persist wizard step
  useEffect(() => {
    sessionStorage.setItem("createBot_wizardStep", String(wizardStep));
  }, [wizardStep]);

  // Auto-focus first input after step transition
  const handleAnimationComplete = useCallback(() => {
    if (!stepContainerRef.current) return;
    const input = stepContainerRef.current.querySelector<HTMLElement>(
      "input:not([type=hidden]):not([type=file]), textarea, select",
    );
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  }, []);

  /* ── Per-step validation ── */
  const isFieldValid = useCallback(
    (step: WizardStep): boolean => {
      if (step.type === "sub_field") {
        const val = (formValues[subFieldKey(step.field.id, step.index)] as string) ?? "";
        return val.trim().length > 0;
      }
      if (step.type !== "field") return true;
      const field = step.field;
      if (!field.is_required) return true;

      if (field.field_type === "url") {
        return getUrlEntries(field.id).some((e) => e.url.trim());
      }
      if (field.field_type === "qa_pairs") {
        return getQaEntries(field.id).some((e) => e.question.trim());
      }
      if (field.field_type === "rules_list") {
        const categories = parseListItems(field.description);
        const entries = getRulesEntries(field.id, categories.length);
        return entries.some((cat) => cat.some((item) => item.trim()));
      }
      if (field.field_type === "file_upload") {
        const uploads = fileUploads[field.id] ?? [];
        return uploads.some((u) => u.uploaded && u.storedUrl);
      }
      const val = formValues[field.id];
      if (val === undefined || val === "" || val === null) return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    },
    [formValues, fileUploads, getUrlEntries, getQaEntries, getRulesEntries],
  );

  const isFileUploading = useCallback(
    (step: WizardStep): boolean => {
      if (step.type !== "field" || step.field.field_type !== "file_upload")
        return false;
      return (fileUploads[step.field.id] ?? []).some((f) => f.uploading);
    },
    [fileUploads],
  );

  /* ── Navigation handlers ── */
  const goNext = useCallback(() => {
    if (steps.length === 0) return;
    const current = steps[wizardStep];

    // Validate current step
    if (current && !isFieldValid(current)) {
      setStepError(t("missingFields"));
      return;
    }
    if (current && isFileUploading(current)) {
      setStepError(t("common:filesStillUploading"));
      return;
    }

    setStepError(null);

    // If on last step, submit (use ref to avoid stale closure)
    if (wizardStep >= steps.length - 1) {
      handleSubmitRef.current();
      return;
    }

    setDirection(1);
    setWizardStep((s) => s + 1);
  }, [steps, wizardStep, isFieldValid, isFileUploading, t]);

  const goBack = useCallback(() => {
    if (wizardStep <= 0) return;
    setStepError(null);
    setDirection(-1);
    setWizardStep((s) => s - 1);
  }, [wizardStep]);

  /* ── Keyboard: Enter advances ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "TEXTAREA") return;
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext]);

  /* ── Form submission ── */
  const handleSubmit = async () => {
    setSubmitError(null);

    // Full validation of all required fields
    const missingRequired = fields.filter((f) => {
      if (!f.is_required) return false;
      // For split long_text fields, check if at least one sub-field has a value
      if (f.field_type === "long_text" && f.description) {
        const items = parseListItems(f.description);
        if (items.length >= 2) {
          return !items.some((_, i) =>
            ((formValues[subFieldKey(f.id, i)] as string) ?? "").trim(),
          );
        }
      }
      if (f.field_type === "url") {
        const entries = getUrlEntries(f.id);
        return !entries.some((entry) => entry.url.trim());
      }
      if (f.field_type === "qa_pairs") {
        return !getQaEntries(f.id).some((e) => e.question.trim());
      }
      if (f.field_type === "rules_list") {
        const categories = parseListItems(f.description);
        const entries = getRulesEntries(f.id, categories.length);
        return !entries.some((cat) => cat.some((item) => item.trim()));
      }
      if (f.field_type === "file_upload") {
        const uploads = fileUploads[f.id] ?? [];
        return !uploads.some((u) => u.uploaded && u.storedUrl);
      }
      const val = formValues[f.id];
      if (val === undefined || val === "" || val === null) return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });

    if (missingRequired.length > 0) {
      setSubmitError(t("missingFields"));
      return;
    }

    const stillUploading = Object.values(fileUploads).some((items) =>
      items.some((f) => f.uploading),
    );
    if (stillUploading) {
      setSubmitError(t("common:filesStillUploading"));
      return;
    }

    // Combine sub-field values back into their parent long_text fields before submission
    for (const field of fields) {
      if (field.field_type === "long_text" && field.description) {
        const items = parseListItems(field.description);
        if (items.length >= 2) {
          const combined = items
            .map((label, i) => {
              const val = ((formValues[subFieldKey(field.id, i)] as string) ?? "").trim();
              return val ? `${label}: ${val}` : "";
            })
            .filter(Boolean)
            .join("\n");
          setValue(field.id, combined);
        }
      }
    }

    const fieldsPayload: Record<string, unknown> = {};
    for (const field of fields) {
      // For split long_text fields, build the combined value directly
      if (field.field_type === "long_text" && field.description) {
        const items = parseListItems(field.description);
        if (items.length >= 2) {
          const combined = items
            .map((label, i) => {
              const val = ((formValues[subFieldKey(field.id, i)] as string) ?? "").trim();
              return val ? `${label}: ${val}` : "";
            })
            .filter(Boolean)
            .join("\n");
          fieldsPayload[field.label] = combined;
          continue;
        }
      }
      fieldsPayload[field.label] = resolveFieldValue(field, fileUploads);
    }

    setIsSubmitting(true);
    setLoadingPhase("prompt");

    try {
      const result = await callFormSubmission({
        user_id: user?.id ?? "",
        full_name: user?.full_name ?? "",
        fields: fieldsPayload,
      });

      if (result.error) throw new Error(result.error);

      const data = result.data as {
        success?: boolean;
        scrape_job_id?: string;
        message?: string;
      } | null;

      // Update bot_status to "created" (edge function doesn't do this)
      const userId = user?.id ?? "";
      if (userId) {
        await supabase
          .from("profiles")
          .update({ bot_status: "created" })
          .eq("id", userId);
        // Refresh auth store so hasCompletedOnboarding is true
        refreshProfile();
      }

      if (data?.scrape_job_id) {
        setLoadingPhase("scraping");

        let done = false;
        while (!done) {
          await new Promise((r) => setTimeout(r, 4000));
          try {
            const statusResult = await callScrapeStatus({ user_id: userId });
            if (statusResult.error) {
              done = true;
              continue;
            }
            const status = statusResult.data as {
              status?: string;
              scraped_pages?: number;
              products_found?: number;
            } | null;
            setScrapeProgress({
              pages: status?.scraped_pages || 0,
              products: status?.products_found || 0,
            });
            if (
              status?.status === "completed" ||
              status?.status === "failed" ||
              status?.status === "none"
            ) {
              done = true;
            }
          } catch {
            done = true;
          }
        }
      }

      setLoadingPhase("done");
      await new Promise((r) => setTimeout(r, 800));
      // Call onNext FIRST — parent switches phase and unmounts FormSection,
      // avoiding re-render of dangerouslySetInnerHTML nodes that can cause
      // DOM errors when browser extensions have modified them.
      sessionStorage.removeItem("createBot_wizardStep");
      onNext();
    } catch (err) {
      console.error("[FormSection] Submission error:", err);
      setIsSubmitting(false);
      setLoadingPhase("prompt");
      setSubmitError(
        err instanceof Error ? err.message : t("createBotError"),
      );
    }
  };
  handleSubmitRef.current = handleSubmit;

  /* ── Render: submission overlay ── */
  if (isSubmitting) {
    return (
      <SubmissionProgress
        phase={loadingPhase}
        scrapeProgress={scrapeProgress}
        ns="createBot"
        icon={Bot}
        phaseKeys={{
          promptTitle: "creatingBot",
          promptDesc: "creatingBotDesc",
          scrapingTitle: "scrapingWebsite",
          scrapingDesc: "scrapingDesc",
          doneTitle: "botCreated",
          doneDesc: "botReadyForPreview",
        }}
        className="min-h-[60vh]"
      />
    );
  }

  /* ── Render: loading ── */
  if (fieldsLoading || steps.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin w-8 h-8 text-[#FF7E47]" />
      </div>
    );
  }

  const currentStepData = steps[wizardStep];
  const isLastStep = wizardStep === steps.length - 1;
  const inputSteps = steps.filter((s) => s.type === "field" || s.type === "sub_field");

  // For step counter: find index among field/sub_field steps only
  const inputIndex =
    currentStepData?.type === "field" || currentStepData?.type === "sub_field"
      ? inputSteps.indexOf(currentStepData)
      : -1;

  return (
    <div className={cn(
      "flex flex-col min-h-[70vh] mx-auto px-4 transition-all duration-300",
      currentStepData?.type === "field" && currentStepData.field.field_type === "rules_list"
        ? "max-w-4xl"
        : "max-w-2xl",
    )}>
      {/* ── Step content ── */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={wizardStep}
            ref={stepContainerRef}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: EASE }}
            onAnimationComplete={handleAnimationComplete}
            className="w-full"
          >
            {/* Opening step */}
            {currentStepData?.type === "opening" && (
              <div className="text-center py-8">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                  className="inline-block mb-6"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF7E47] to-[#E86B38] flex items-center justify-center shadow-[0_4px_24px_rgba(255,126,71,0.3)]">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                </motion.div>

                {currentStepData.settings.opening_title && (
                  <div
                    className={`text-2xl sm:text-3xl font-bold text-[#2D2A26] mb-4 ${RICH_TEXT_CLASS}`}
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        currentStepData.settings.opening_title,
                      ),
                    }}
                  />
                )}
                {currentStepData.settings.opening_text && (
                  <div
                    className={`text-base text-[#7A7267] leading-relaxed max-w-md mx-auto ${RICH_TEXT_CLASS}`}
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        currentStepData.settings.opening_text,
                      ),
                    }}
                  />
                )}
              </div>
            )}

            {/* Field step */}
            {currentStepData?.type === "field" && (
              <div className="py-4">
                {/* Step counter */}
                <p className="text-xs text-[#A39B90] font-semibold mb-6 text-center tracking-wide">
                  {t("stepOf", {
                    current: inputIndex + 1,
                    total: inputSteps.length,
                  })}
                </p>

                {/* Field card */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50">
                  <FormFieldRenderer
                    field={currentStepData.field}
                    fileCategoryOptions={fileCategoryOptions}
                    formValues={formValues}
                    otherValues={otherValues}
                    setValue={setValue}
                    setOtherValue={setOtherValue}
                    toggleCheckboxValue={toggleCheckboxValue}
                    getUrlEntries={getUrlEntries}
                    updateUrlEntry={updateUrlEntry}
                    addUrlEntry={addUrlEntry}
                    removeUrlEntry={removeUrlEntry}
                    getQaEntries={getQaEntries}
                    updateQaEntry={updateQaEntry}
                    addQaEntry={addQaEntry}
                    removeQaEntry={removeQaEntry}
                    getRulesEntries={getRulesEntries}
                    updateRulesItem={updateRulesItem}
                    addRulesItem={addRulesItem}
                    removeRulesItem={removeRulesItem}
                    fileUploads={fileUploads}
                    fileInputRefs={fileInputRefs}
                    handleFileSelect={handleFileSelect}
                    removeFileUpload={removeFileUpload}
                    updateFileMetadata={updateFileMetadata}
                  />
                </div>

                {/* Step-level error */}
                {stepError && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm mt-4"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {stepError}
                  </motion.div>
                )}
              </div>
            )}

            {/* Sub-field step (split from long_text with numbered list) */}
            {currentStepData?.type === "sub_field" && (
              <div className="py-4">
                {/* Step counter */}
                <p className="text-xs text-[#A39B90] font-semibold mb-6 text-center tracking-wide">
                  {t("stepOf", {
                    current: inputIndex + 1,
                    total: inputSteps.length,
                  })}
                </p>

                {/* Sub-field card */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50">
                  <div className="space-y-2">
                    <p className="text-xs text-[#A39B90] font-medium">
                      {currentStepData.parentLabel}
                    </p>
                    <h2 className="text-lg font-bold text-[#2D2A26]">
                      {currentStepData.label}
                    </h2>
                    <input
                      placeholder={currentStepData.label}
                      value={
                        (formValues[
                          subFieldKey(
                            currentStepData.field.id,
                            currentStepData.index,
                          )
                        ] as string) ?? ""
                      }
                      onChange={(e) =>
                        setValue(
                          subFieldKey(
                            currentStepData.field.id,
                            currentStepData.index,
                          ),
                          e.target.value,
                        )
                      }
                      className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-4 py-3 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Step-level error */}
                {stepError && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm mt-4"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {stepError}
                  </motion.div>
                )}
              </div>
            )}

            {/* Closing step */}
            {currentStepData?.type === "closing" && (
              <div className="text-center py-8">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-[#A39B90]" />
                  <span className="text-xs text-[#A39B90] font-semibold uppercase tracking-wider">
                    Privacy
                  </span>
                </div>
                {currentStepData.settings.closing_text && (
                  <div
                    className={`text-sm text-[#7A7267] leading-relaxed max-w-sm mx-auto mb-6 ${RICH_TEXT_CLASS}`}
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        currentStepData.settings.closing_text,
                      ),
                    }}
                  />
                )}
                <p className="text-xs text-[#A39B90] leading-relaxed max-w-sm mx-auto">
                  {t("privacyNotice")}
                </p>

                {/* Submit error on closing step */}
                {submitError && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm mt-6 max-w-sm mx-auto"
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {submitError}
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom navigation ── */}
      <div className="pb-8">
        <WizardNavigator
          currentStep={wizardStep}
          totalSteps={steps.length}
          onBack={goBack}
          onNext={goNext}
          showBack={wizardStep > 0}
          isSubmit={isLastStep}
          nextDisabled={
            currentStepData ? isFileUploading(currentStepData) : false
          }
        />
      </div>
    </div>
  );
};

export default FormSection;
