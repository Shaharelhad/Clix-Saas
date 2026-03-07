import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link2, Copy, Check } from "lucide-react";

/* ─────────────────────── Webhook Pill ──────────────────────── */

function WebhookPill({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-[#EDE6DD]/50 bg-[#FAF7F3]/60 shadow-sm shrink-0"
    >
      <Link2 className="w-4 h-4 text-[#A39B90] shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs font-bold text-[#7A7267] uppercase tracking-wider">
          Webhook
        </span>
        <span className="text-[11px] text-[#7A7267] font-mono select-all break-all">
          {url}
        </span>
      </div>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg hover:bg-[#EDE6DD]/60 transition-colors cursor-pointer shrink-0"
        title="Copy webhook URL"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-[#A39B90]" />
        )}
      </button>
    </motion.div>
  );
}
import { useAuth } from "@/hooks/useAuth";
import ConversationsSection from "./Sections/ConversationsSection";
import DemoChatSection from "./Sections/DemoChatSection";
import EditBotSection from "./Sections/EditBotSection";

/* ─────────────────────── Animation config ──────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

export default function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const [resetKey, setResetKey] = useState(0);

  const webhookUrl = user?.id
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/flow-webhook`
    : null;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-5 sm:p-8 max-w-7xl mx-auto"
    >
      {/* ── Top Row: Welcome + Status ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        {/* Welcome */}
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#2D2A26] tracking-tight">
            {t("welcome", { name: user?.full_name ?? "" })}
          </h1>
          <p className="text-sm text-[#7A7267] mt-0.5">{t("subtitle")}</p>
        </motion.div>

        {/* Webhook URL */}
        {webhookUrl && (
          <WebhookPill url={webhookUrl} />
        )}
      </div>

      {/* ── Row 1: Conversations (full width) ── */}
      <motion.div variants={fadeUp} className="mb-5">
        <ConversationsSection />
      </motion.div>

      {/* ── Row 2: Demo Chat + Edit Bot ── */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
        {/* Demo Chat — wider */}
        <div className="lg:col-span-4">
          <DemoChatSection resetKey={resetKey} />
        </div>

        {/* Edit Bot — narrower */}
        <div className="lg:col-span-3">
          <EditBotSection onEditApplied={() => setResetKey((k) => k + 1)} />
        </div>
      </div>
    </motion.div>
  );
}
