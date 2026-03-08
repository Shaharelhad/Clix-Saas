import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import EditBotSection from "./EditBotSection";
import DemoChatSection from "./DemoChatSection";
import BusinessContentSection from "./BusinessContentSection";
import FaqSection from "./FaqSection";

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

export default function EditBotPage() {
  const { t } = useTranslation("dashboard");
  const [resetKey, setResetKey] = useState(0);

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="p-5 sm:p-8 max-w-7xl mx-auto space-y-8"
    >
      {/* ── Page Title ── */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#2D2A26] tracking-tight">
          {t("editBotPageTitle")}
        </h1>
        <p className="text-sm text-[#7A7267] mt-0.5">
          {t("editBotPageSubtitle")}
        </p>
      </motion.div>

      {/* ── Edit Bot + Demo Chat (side by side on desktop) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-5">
        <div className="lg:col-span-3">
          <EditBotSection onEditApplied={() => setResetKey((k) => k + 1)} />
        </div>
        <div className="lg:col-span-4">
          <DemoChatSection resetKey={resetKey} />
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-[#EDE6DD]/60" />

      {/* ── Business Content ── */}
      <motion.div variants={fadeUp}>
        <BusinessContentSection />
      </motion.div>

      {/* ── Divider ── */}
      <div className="border-t border-[#EDE6DD]/60" />

      {/* ── FAQ ── */}
      <motion.div variants={fadeUp}>
        <FaqSection />
      </motion.div>
    </motion.div>
  );
}
