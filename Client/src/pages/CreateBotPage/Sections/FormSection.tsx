import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Bot,
  Globe,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  ShoppingCart,
  HeadphonesIcon,
  CalendarCheck,
  Star,
  CalendarDays,
  Puzzle,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  onNext: () => void;
}

/* ── stagger children helper ── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const EASE = [0.22, 1, 0.36, 1] as const;

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
        className
      )}
    >
      {children}
    </motion.div>
  );
}

/* ── Custom Checkbox ── */
function OrangeCheck({
  checked,
  onChange,
  label,
  icon,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "group flex items-center gap-3 w-full rounded-xl px-4 py-3.5 text-start transition-all duration-300",
        checked
          ? "bg-[#FF7E47]/8 border-2 border-[#FF7E47]/40"
          : "bg-[#FAF7F3] border-2 border-transparent hover:border-[#EDE6DD]"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200",
          checked
            ? "bg-[#FF7E47] border-[#FF7E47]"
            : "border-[#D5CCBF] group-hover:border-[#FF7E47]/40"
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
      {icon && (
        <span className="text-[#FF7E47] flex-shrink-0">{icon}</span>
      )}
      <span
        className={cn(
          "text-sm font-medium transition-colors",
          checked ? "text-[#2D2A26]" : "text-[#7A7267]"
        )}
      >
        {label}
      </span>
    </button>
  );
}

/* ── Radio Pill ── */
function StylePill({
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
          : "bg-[#FAF7F3] text-[#7A7267] hover:bg-[#F3ECE3] border border-[#EDE6DD]"
      )}
    >
      {label}
    </motion.button>
  );
}

const FormSection = ({ onNext }: FormSectionProps) => {
  const { t } = useTranslation("createBot");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [purposes, setPurposes] = useState<string[]>([]);
  const [extras, setExtras] = useState<string[]>([]);
  const [responseStyle, setResponseStyle] = useState("friendly");
  const [notes, setNotes] = useState("");

  const togglePurpose = (id: string) =>
    setPurposes((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id]
    );

  const toggleExtra = (id: string) =>
    setExtras((e) =>
      e.includes(id) ? e.filter((x) => x !== id) : [...e, id]
    );

  const purposeOptions = [
    { id: "answer", icon: <MessageSquare className="w-4 h-4" />, labelKey: "botPurpose1" },
    { id: "orders", icon: <ShoppingCart className="w-4 h-4" />, labelKey: "botPurpose2" },
    { id: "support", icon: <HeadphonesIcon className="w-4 h-4" />, labelKey: "botPurpose3" },
    { id: "schedule", icon: <CalendarCheck className="w-4 h-4" />, labelKey: "botPurpose4" },
  ];

  const extraOptions = [
    { id: "reviews", icon: <Star className="w-4 h-4" />, labelKey: "extra1" },
    { id: "appointments", icon: <CalendarDays className="w-4 h-4" />, labelKey: "extra2" },
    { id: "integrations", icon: <Puzzle className="w-4 h-4" />, labelKey: "extra3" },
  ];

  const styleOptions = [
    { id: "friendly", labelKey: "responseStyleFriendly" },
    { id: "professional", labelKey: "responseStyleProfessional" },
    { id: "casual", labelKey: "responseStyleCasual" },
    { id: "custom", labelKey: "responseStyleCustom" },
  ];

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6 pt-4"
    >
      {/* ── Header ── */}
      <motion.div variants={fadeUp} className="text-center mb-2">
        <div className="inline-flex items-center gap-3 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2D2A26]">
            {t("formTitle")}
          </h1>
          <motion.span
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="text-3xl"
          >
            <Bot className="w-8 h-8 text-[#FF7E47]" />
          </motion.span>
        </div>
        <p className="text-[#7A7267] text-base max-w-md mx-auto leading-relaxed">
          {t("formSubtitle")}
        </p>
      </motion.div>

      {/* ── Knowledge Base ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-[#FF7E47]" />
          <h2 className="text-lg font-bold text-[#2D2A26]">
            {t("knowledgeBaseTitle")}
          </h2>
        </div>

        <p className="text-[#7A7267] text-sm leading-relaxed mb-5">
          {t("knowledgeBaseDesc")}
        </p>

        <div className="space-y-2.5 mb-6">
          {[
            t("knowledgeBaseItem1"),
            t("knowledgeBaseItem2"),
            t("knowledgeBaseItem3"),
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#FF7E47] flex-shrink-0" />
              <span className="text-sm text-[#4A4640]">{item}</span>
            </div>
          ))}
        </div>

        <label className="block text-sm font-bold text-[#2D2A26] mb-2">
          {t("websiteUrlLabel")}
        </label>
        <input
          type="url"
          dir="ltr"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder={t("websiteUrlPlaceholder")}
          className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-4 py-3 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200"
        />
        <p className="text-xs text-[#A39B90] mt-1.5">{t("websiteUrlHelp")}</p>

        <label className="flex items-center gap-3 mt-5 cursor-pointer group">
          <div
            className={cn(
              "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
              consent
                ? "bg-[#FF7E47] border-[#FF7E47]"
                : "border-[#D5CCBF] group-hover:border-[#FF7E47]/40"
            )}
            onClick={() => setConsent(!consent)}
          >
            {consent && (
              <svg
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
              </svg>
            )}
          </div>
          <span
            className="text-sm text-[#7A7267] group-hover:text-[#4A4640] transition-colors cursor-pointer"
            onClick={() => setConsent(!consent)}
          >
            {t("consentCheckbox")}
          </span>
        </label>
      </Card>

      {/* ── Create AI Steps ── */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-5 h-5 text-[#FF7E47]" />
          <h2 className="text-lg font-bold text-[#2D2A26]">
            {t("createAiTitle")}
          </h2>
        </div>

        <div className="space-y-4">
          {[
            t("createAiStep1"),
            t("createAiStep2"),
            t("createAiStep3"),
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FF7E47]/10 text-[#FF7E47] font-bold text-sm flex items-center justify-center">
                {i + 1}
              </div>
              <p className="text-sm text-[#4A4640] pt-1.5 leading-relaxed">
                {step}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Bot Purpose ── */}
      <Card>
        <h2 className="text-lg font-bold text-[#2D2A26] mb-4">
          {t("botPurposeTitle")}
        </h2>
        <div className="space-y-2">
          {purposeOptions.map((opt) => (
            <OrangeCheck
              key={opt.id}
              checked={purposes.includes(opt.id)}
              onChange={() => togglePurpose(opt.id)}
              label={t(opt.labelKey)}
              icon={opt.icon}
            />
          ))}
        </div>
      </Card>

      {/* ── Extras ── */}
      <Card>
        <h2 className="text-lg font-bold text-[#2D2A26] mb-1">
          {t("extrasTitle")}
        </h2>
        <div className="space-y-2 mt-4">
          {extraOptions.map((opt) => (
            <OrangeCheck
              key={opt.id}
              checked={extras.includes(opt.id)}
              onChange={() => toggleExtra(opt.id)}
              label={t(opt.labelKey)}
              icon={opt.icon}
            />
          ))}
        </div>
      </Card>

      {/* ── Response Style ── */}
      <Card>
        <h2 className="text-lg font-bold text-[#2D2A26] mb-4">
          {t("responseStyleTitle")}
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {styleOptions.map((opt) => (
            <StylePill
              key={opt.id}
              selected={responseStyle === opt.id}
              onClick={() => setResponseStyle(opt.id)}
              label={t(opt.labelKey)}
            />
          ))}
        </div>
      </Card>

      {/* ── Additional Notes ── */}
      <Card>
        <h2 className="text-lg font-bold text-[#2D2A26] mb-3">
          {t("additionalNotesLabel")}
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("additionalNotesPlaceholder")}
          rows={4}
          className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-4 py-3 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200 resize-none"
        />
      </Card>

      {/* ── Privacy Notice ── */}
      <motion.div variants={fadeUp} className="text-center px-4">
        <div className="flex items-center justify-center gap-2 mb-1.5">
          <Shield className="w-3.5 h-3.5 text-[#A39B90]" />
          <span className="text-xs text-[#A39B90] font-semibold uppercase tracking-wider">
            Privacy
          </span>
        </div>
        <p className="text-xs text-[#A39B90] leading-relaxed max-w-sm mx-auto">
          {t("privacyNotice")}
        </p>
      </motion.div>

      {/* ── Submit Button ── */}
      <motion.div variants={fadeUp} className="flex justify-center pt-2 pb-4">
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-base rounded-2xl px-10 py-4 transition-all duration-300 shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)]"
        >
          {t("createBotBtn")}
          <Sparkles className="w-4.5 h-4.5 transition-transform group-hover:rotate-12" />
          <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 transition-transform group-hover:ltr:-translate-x-0.5 group-hover:rtl:translate-x-0.5" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default FormSection;
