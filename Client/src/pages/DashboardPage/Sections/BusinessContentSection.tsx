import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Bot,
} from "lucide-react";
import DOMPurify from "dompurify";
import { cn } from "@/lib/utils";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useFormFields } from "@/hooks/useFormFields";
import { useFileUpload } from "@/hooks/useFileUpload";
import { FormFieldRenderer } from "@/components/form/FormFieldRenderer";
import { callFormSubmission, callScrapeStatus } from "@/services/webhooks";
import type { FormField, FormSettings } from "@/types/form";

/* ── Animation helpers ── */
const EASE = [0.22, 1, 0.36, 1] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/* ── Card wrapper ── */
function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "bg-white rounded-2xl p-6 sm:p-8",
        "shadow-[0_2px_24px_rgba(45,42,38,0.05)]",
        "border border-[#EDE6DD]/50",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

const richTextClass =
  "[&_p]:m-0 [&_ol]:list-decimal [&_ol]:pr-5 [&_ol]:space-y-0.5 [&_ul]:list-disc [&_ul]:pr-5 [&_ul]:space-y-0.5 [&_li]:pr-1";

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

  // Parse additional_info — this is where all form answers are stored (keyed by field label)
  let answers: Record<string, unknown> = {};
  const raw = response.additional_info;
  if (typeof raw === "string") {
    try { answers = JSON.parse(raw); } catch { /* ignore */ }
  } else if (raw && typeof raw === "object") {
    answers = raw as Record<string, unknown>;
  }

  for (const field of fields) {
    // Match by exact label (additional_info keys are the field labels)
    const val = answers[field.label];
    if (val == null || val === "") continue;

    if (field.field_type === "url") {
      // URL fields are stored as array of { url, label } objects
      if (Array.isArray(val)) {
        urlEntries[field.id] = val.map((entry: any) => ({
          url: String(entry?.url ?? entry ?? ""),
          label: String(entry?.label ?? ""),
        }));
      } else {
        urlEntries[field.id] = [{ url: String(val), label: "" }];
      }
    } else if (field.field_type === "checkbox" || field.field_type === "multi_select") {
      if (Array.isArray(val)) {
        formValues[field.id] = val.map(String);
      } else {
        formValues[field.id] = [String(val)];
      }
    } else {
      formValues[field.id] = String(val);
    }
  }

  return { formValues, urlEntries };
}

/* ── Submission progress overlay ── */
function SubmissionProgress({
  phase,
  scrapeProgress,
}: {
  phase: "prompt" | "scraping" | "done";
  scrapeProgress: { pages: number; products: number };
}) {
  const { t } = useTranslation("createBot");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF7E47] to-[#E86B38] flex items-center justify-center shadow-[0_4px_24px_rgba(255,126,71,0.3)] mb-6"
      >
        <Bot className="w-8 h-8 text-white" />
      </motion.div>

      <h3 className="text-xl font-bold text-[#2D2A26] mb-2">
        {phase === "prompt" && t("creatingBot")}
        {phase === "scraping" && t("scrapingWebsite")}
        {phase === "done" && t("botCreated")}
      </h3>

      <p className="text-sm text-[#7A7267] max-w-xs">
        {phase === "prompt" && t("creatingBotDesc")}
        {phase === "scraping" && t("scrapingDesc")}
        {phase === "done" && t("botReadyForPreview")}
      </p>

      {phase === "scraping" &&
        (scrapeProgress.pages > 0 || scrapeProgress.products > 0) && (
          <div className="mt-4 flex items-center gap-4 text-sm text-[#7A7267]">
            {scrapeProgress.pages > 0 && (
              <span>
                {t("pagesScraped")}:{" "}
                <strong className="text-[#FF7E47]">{scrapeProgress.pages}</strong>
              </span>
            )}
            {scrapeProgress.products > 0 && (
              <span>
                {t("productsFound")}:{" "}
                <strong className="text-[#FF7E47]">{scrapeProgress.products}</strong>
              </span>
            )}
          </div>
        )}

      <motion.div className="mt-6 h-1 w-48 rounded-full bg-[#EDE6DD] overflow-hidden">
        <motion.div
          className="h-full bg-[#FF7E47] rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: phase === "done" ? "100%" : "70%" }}
          transition={{ duration: phase === "done" ? 0.3 : 8, ease: "easeOut" }}
        />
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

export default function BusinessContentSection() {
  const { t } = useTranslation("dashboard");
  const { t: tCreateBot } = useTranslation("createBot");
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialized = useRef(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"prompt" | "scraping" | "done">("prompt");
  const [scrapeProgress, setScrapeProgress] = useState({ pages: 0, products: 0 });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fileCategoryOptions = [
    { value: "product", label: tCreateBot("common:categoryProduct") },
    { value: "service", label: tCreateBot("common:categoryService") },
    { value: "portfolio", label: tCreateBot("common:categoryPortfolio") },
    { value: "team", label: tCreateBot("common:categoryTeam") },
    { value: "logo", label: tCreateBot("common:categoryLogo") },
    { value: "general", label: tCreateBot("common:categoryGeneral") },
  ];

  const {
    formValues,
    setFormValues,
    otherValues,
    setUrlEntries,
    setValue,
    setOtherValue,
    toggleCheckboxValue,
    getUrlEntries,
    updateUrlEntry,
    addUrlEntry,
    removeUrlEntry,
    resolveFieldValue,
  } = useFormFields();

  const {
    fileUploads,
    fileInputRefs,
    handleFileSelect,
    removeFileUpload,
    updateFileMetadata,
  } = useFileUpload(user?.id);

  /* ── Fetch form fields ── */
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

  /* ── Fetch form settings ── */
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

  /* ── Fetch stored form response and pre-populate ── */
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

  /* ── Pre-populate form when both fields and response are ready ── */
  useEffect(() => {
    if (initialized.current || !formResponse || fields.length === 0) return;
    initialized.current = true;

    const { formValues: mapped, urlEntries: mappedUrls } = mapResponseToFields(
      fields,
      formResponse as unknown as Record<string, unknown>,
    );

    setFormValues(mapped);
    setUrlEntries(mappedUrls);
  }, [formResponse, fields, setFormValues, setUrlEntries]);

  const loading = fieldsLoading || responseLoading;

  /* ── Form submission (same as CreateBot) ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Validate required fields
    const missingRequired = fields.filter((f) => {
      if (!f.is_required) return false;
      if (f.field_type === "url") {
        const entries = getUrlEntries(f.id);
        return !entries.some((entry) => entry.url.trim());
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
      setSubmitError(tCreateBot("missingFields"));
      return;
    }

    // Check if any files are still uploading
    const stillUploading = Object.values(fileUploads).some((items) =>
      items.some((f) => f.uploading),
    );
    if (stillUploading) {
      setSubmitError(tCreateBot("common:filesStillUploading"));
      return;
    }

    // Build payload
    const fieldsPayload: Record<string, unknown> = {};
    for (const field of fields) {
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
      } | null;

      // If scraping was triggered, poll until done
      if (data?.scrape_job_id) {
        setLoadingPhase("scraping");
        const userId = user?.id ?? "";

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
      setIsSubmitting(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setIsSubmitting(false);
      setLoadingPhase("prompt");
      setSubmitError(
        err instanceof Error ? err.message : t("saveError"),
      );
    }
  };

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
        className="flex flex-col gap-6 p-5 sm:p-8 max-w-3xl mx-auto pt-4"
      >
        <Card>
          <SubmissionProgress phase={loadingPhase} scrapeProgress={scrapeProgress} />
        </Card>
      </motion.div>
    );
  }

  const showOpening = settings && (settings.opening_title || settings.opening_text);
  const showClosing = settings && settings.closing_text;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-5 sm:p-8 max-w-3xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2D2A26] tracking-tight">
          {t("businessContentTitle")}
        </h1>
        <p className="text-sm text-[#7A7267] mt-1">{t("businessContentSubtitle")}</p>
      </motion.div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Opening text */}
        {showOpening && (
          <Card>
            {settings.opening_title && (
              <div
                className={`font-bold text-base text-[#2D2A26] mb-2 ${richTextClass}`}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(settings.opening_title),
                }}
              />
            )}
            {settings.opening_text && (
              <div
                className={`text-sm text-[#7A7267] leading-relaxed ${richTextClass}`}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(settings.opening_text),
                }}
              />
            )}
          </Card>
        )}

        {/* Dynamic form fields */}
        {fields.map((field) => (
          <Card key={field.id}>
            <FormFieldRenderer
              field={field}
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
              fileUploads={fileUploads}
              fileInputRefs={fileInputRefs}
              handleFileSelect={handleFileSelect}
              removeFileUpload={removeFileUpload}
              updateFileMetadata={updateFileMetadata}
            />
          </Card>
        ))}

        {/* Closing text */}
        {showClosing && (
          <Card>
            <div
              className={`text-sm text-[#7A7267] leading-relaxed ${richTextClass}`}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(settings.closing_text),
              }}
            />
          </Card>
        )}

        {/* Error */}
        {submitError && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3.5 text-sm"
          >
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
            {submitError}
          </motion.div>
        )}

        {/* Success feedback */}
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3.5 text-sm"
          >
            <Check className="w-4.5 h-4.5 flex-shrink-0" />
            {t("savedSuccessfully")}
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.div variants={fadeUp} className="flex justify-center pt-2 pb-4">
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-base rounded-2xl px-10 py-4 transition-all duration-300 shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)]"
          >
            {t("saveChanges")}
            <Sparkles className="w-4.5 h-4.5 transition-transform group-hover:rotate-12" />
            <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 transition-transform group-hover:ltr:-translate-x-0.5 group-hover:rtl:translate-x-0.5" />
          </motion.button>
        </motion.div>
      </form>
    </motion.div>
  );
}
