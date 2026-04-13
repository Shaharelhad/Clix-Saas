import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Globe,
  Mail,
  Phone,
  Palette,
  Upload,
  Check,
  X,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/services/supabase";

const EASE = [0.22, 1, 0.36, 1] as const;
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

export default function ApplyPage() {
  const { t } = useTranslation("apply");
  const navigate = useNavigate();

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#FF6B2C");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const slugTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Slug validation (debounced)
  const checkSlug = useCallback(
    (value: string) => {
      clearTimeout(slugTimer.current);
      if (!value) { setSlugStatus("idle"); return; }
      if (!SLUG_REGEX.test(value)) { setSlugStatus("invalid"); return; }
      setSlugStatus("checking");
      slugTimer.current = setTimeout(async () => {
        const { data, error: err } = await supabase.rpc("check_slug_available", { p_slug: value });
        if (err) { setSlugStatus("idle"); return; }
        setSlugStatus(data ? "available" : "taken");
      }, 400);
    },
    [],
  );

  const handleSlugChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(cleaned);
    checkSlug(cleaned);
  };

  // Logo upload
  const handleLogoSelect = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_LOGO_SIZE) {
      setError("Logo must be under 2MB");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!companyName.trim() || !slug || !contactEmail.trim()) {
      setError(t("requiredField"));
      return;
    }
    if (slugStatus !== "available") {
      setError(t("subdomainTaken"));
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload logo if provided
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() || "png";
        const path = `pending/${slug}/logo.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("tenant-assets")
          .upload(path, logoFile, { upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from("tenant-assets")
            .getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      // Submit application
      const { error: rpcErr } = await supabase.rpc("submit_tenant_application", {
        p_slug: slug,
        p_name: companyName.trim(),
        p_contact_email: contactEmail.trim(),
        p_contact_phone: contactPhone.trim() || undefined,
        p_website_url: website.trim() || undefined,
        p_logo_url: logoUrl || undefined,
        p_icon_url: logoUrl || undefined,
        p_primary_color: primaryColor,
      });

      if (rpcErr) throw rpcErr;
      setSubmitted(true);
    } catch (err) {
      console.error("Apply form submission error:", err);
      setError(t("errorGeneric"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div
        dir="rtl"
        className="min-h-dvh flex items-center justify-center font-secular-one"
        style={{ background: "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md px-6"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D2A26] mb-3">{t("successTitle")}</h1>
          <p className="text-[#7A7267] mb-8 leading-relaxed">{t("successMessage")}</p>
          <button
            onClick={() => navigate("/")}
            className="clix-btn text-sm inline-flex items-center gap-2"
          >
            {t("backToHome")}
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-dvh font-secular-one"
      style={{ background: "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)" }}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-6 cursor-pointer" onClick={() => navigate("/")} dir="ltr">
            <BrandLogo className="h-8" />
          </div>
          <div className="inline-flex items-center gap-2 bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-xs font-bold px-3 py-1.5 rounded-full mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            White Label
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2D2A26] mb-2">{t("pageTitle")}</h1>
          <p className="text-[#7A7267] text-sm">{t("pageSubtitle")}</p>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="glass-card p-6 sm:p-8 space-y-6"
        >
          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2"
              >
                <X className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Company Name */}
          <Field label={t("companyName")} icon={Building2} required>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("companyNamePlaceholder")}
              className="field-input"
              required
            />
          </Field>

          {/* Subdomain */}
          <Field label={t("subdomain")} icon={Globe} required>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder={t("subdomainPlaceholder")}
                  className="field-input font-mono text-sm"
                  dir="ltr"
                  required
                />
                {slugStatus !== "idle" && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    {slugStatus === "checking" && <Loader2 className="w-4 h-4 animate-spin text-[#A39B90]" />}
                    {slugStatus === "available" && <Check className="w-4 h-4 text-emerald-500" />}
                    {slugStatus === "taken" && <X className="w-4 h-4 text-red-500" />}
                    {slugStatus === "invalid" && <X className="w-4 h-4 text-amber-500" />}
                  </div>
                )}
              </div>
              <span className="text-[#A39B90] text-sm font-mono shrink-0" dir="ltr">
                {t("subdomainSuffix")}
              </span>
            </div>
            {slugStatus === "available" && (
              <p className="text-emerald-600 text-xs mt-1">{t("subdomainAvailable")}</p>
            )}
            {slugStatus === "taken" && (
              <p className="text-red-500 text-xs mt-1">{t("subdomainTaken")}</p>
            )}
            {slugStatus === "invalid" && (
              <p className="text-amber-600 text-xs mt-1">{t("subdomainInvalid")}</p>
            )}
          </Field>

          {/* Logo Upload */}
          <Field label={t("logo")} icon={Upload}>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#EDE6DD] rounded-xl p-4 text-center cursor-pointer hover:border-[var(--brand-primary)]/40 transition-colors"
            >
              {logoPreview ? (
                <div className="flex items-center justify-center gap-4">
                  <img src={logoPreview} alt="Logo preview" className="h-12 max-w-[200px] object-contain" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                    className="text-[#A39B90] hover:text-red-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-6 h-6 mx-auto text-[#A39B90] mb-2" />
                  <p className="text-[#7A7267] text-sm">{t("logoHint")}</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files?.[0] || null)}
              />
            </div>
          </Field>

          {/* Brand Color */}
          <Field label={t("primaryColor")} icon={Palette}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-[#EDE6DD] cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="field-input font-mono text-sm flex-1"
                dir="ltr"
                maxLength={7}
              />
              <div
                className="w-10 h-10 rounded-lg border border-[#EDE6DD]"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
            <p className="text-[#A39B90] text-xs mt-1">{t("primaryColorHint")}</p>
          </Field>

          {/* Contact Email */}
          <Field label={t("contactEmail")} icon={Mail} required>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={t("contactEmailPlaceholder")}
              className="field-input"
              dir="ltr"
              required
            />
          </Field>

          {/* Contact Phone */}
          <Field label={t("contactPhone")} icon={Phone}>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={t("contactPhonePlaceholder")}
              className="field-input"
              dir="ltr"
            />
          </Field>

          {/* Website */}
          <Field label={t("website")} icon={Globe}>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t("websitePlaceholder")}
              className="field-input"
              dir="ltr"
            />
          </Field>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || slugStatus !== "available"}
            className="clix-btn w-full text-base flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("submitting")}
              </>
            ) : (
              <>
                {t("submit")}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </motion.form>
      </div>

      {/* Field input styles */}
      <style>{`
        .field-input {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid #EDE6DD;
          border-radius: 0.75rem;
          background: white;
          font-size: 0.875rem;
          color: #2D2A26;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus {
          outline: none;
          border-color: var(--brand-primary);
          box-shadow: 0 0 0 3px rgba(var(--brand-primary-rgb), 0.1);
        }
        .field-input::placeholder {
          color: #B8AFA4;
        }
      `}</style>
    </div>
  );
}

/* ── Reusable field wrapper ── */
function Field({
  label,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  icon: React.ElementType;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm font-bold text-[#2D2A26] mb-2">
        <Icon className="w-4 h-4 text-[var(--brand-primary)]" />
        {label}
        {required && <span className="text-red-400 text-xs">*</span>}
      </label>
      {children}
    </div>
  );
}
