import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SubmissionPhase = "prompt" | "scraping" | "done";

export interface ScrapeProgress {
  pages: number;
  products: number;
}

interface SubmissionProgressProps {
  phase: SubmissionPhase;
  scrapeProgress: ScrapeProgress;
  /** i18n namespace to use for translations (default: "dashboard") */
  ns?: string;
  /** Override icon shown in the spinner (default: RefreshCw) */
  icon?: LucideIcon;
  /** Translation keys for the three phases */
  phaseKeys?: {
    promptTitle: string;
    promptDesc: string;
    scrapingTitle: string;
    scrapingDesc: string;
    doneTitle: string;
    doneDesc: string;
  };
  className?: string;
}

const DEFAULT_PHASE_KEYS = {
  promptTitle: "updatingBot",
  promptDesc: "updatingBotDesc",
  scrapingTitle: "scrapingWebsite",
  scrapingDesc: "scrapingDesc",
  doneTitle: "botUpdated",
  doneDesc: "botUpdatedDesc",
};

export function SubmissionProgress({
  phase,
  scrapeProgress,
  ns = "dashboard",
  icon: Icon = RefreshCw,
  phaseKeys = DEFAULT_PHASE_KEYS,
  className = "py-20",
}: SubmissionProgressProps) {
  const { t } = useTranslation(ns);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col items-center justify-center text-center ${className}`}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF7E47] to-[#E86B38] flex items-center justify-center shadow-[0_4px_24px_rgba(255,126,71,0.3)] mb-6"
      >
        <Icon className="w-8 h-8 text-white" />
      </motion.div>

      <h3 className="text-xl font-bold text-[#2D2A26] mb-2">
        {phase === "prompt" && t(phaseKeys.promptTitle)}
        {phase === "scraping" && t(phaseKeys.scrapingTitle)}
        {phase === "done" && t(phaseKeys.doneTitle)}
      </h3>

      <p className="text-sm text-[#7A7267] max-w-xs">
        {phase === "prompt" && t(phaseKeys.promptDesc)}
        {phase === "scraping" && t(phaseKeys.scrapingDesc)}
        {phase === "done" && t(phaseKeys.doneDesc)}
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
