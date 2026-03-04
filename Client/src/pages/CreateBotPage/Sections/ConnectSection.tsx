import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Play, ExternalLink, Link2, Eye, EyeOff, Wifi } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE },
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const ConnectSection = () => {
  const { t } = useTranslation("createBot");
  const [instanceId, setInstanceId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6 pt-4"
    >
      {/* ── Tutorial Card ── */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50"
      >
        {/* Title */}
        <div className="px-6 sm:px-8 pt-8 pb-4">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#2D2A26] text-center">
              {t("connectTitle")}
            </h2>
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
              className="w-8 h-8 rounded-full bg-[#FF7E47] flex items-center justify-center flex-shrink-0"
            >
              <Play className="w-4 h-4 text-white ms-0.5" fill="white" />
            </motion.div>
          </div>
        </div>

        {/* Video Placeholder */}
        <div className="px-6 sm:px-8 pb-6">
          <motion.div
            variants={fadeUp}
            className="relative group cursor-pointer rounded-2xl overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, #FAF7F3 0%, #F3ECE3 100%)",
            }}
          >
            <div className="flex flex-col items-center justify-center py-20 sm:py-28">
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="relative mb-5"
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-[#FF7E47]/20"
                />
                <div className="relative w-20 h-20 rounded-full bg-[#FF7E47] shadow-[0_4px_24px_rgba(255,126,71,0.35)] flex items-center justify-center transition-shadow group-hover:shadow-[0_6px_32px_rgba(255,126,71,0.45)]">
                  <Play className="w-8 h-8 text-white ms-1" fill="white" />
                </div>
              </motion.div>
              <span className="text-sm text-[#7A7267] font-medium">
                {t("watchVideo")}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Steps */}
        <div className="px-6 sm:px-8 pb-8">
          <h3 className="text-base font-bold text-[#2D2A26] mb-5 text-center">
            {t("mainSteps")}
          </h3>
          <div className="space-y-3 max-w-md mx-auto">
            {[
              t("connectStep1"),
              t("connectStep2"),
              t("connectStep3"),
              t("connectStep4"),
            ].map((step, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-start gap-4 bg-[#FAF7F3] rounded-xl px-5 py-4 border border-[#EDE6DD]/40"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#FF7E47]/10 text-[#FF7E47] font-bold text-xs flex items-center justify-center mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-[#4A4640] leading-relaxed pt-0.5">
                  {step}
                  {i === 0 && (
                    <ExternalLink className="inline w-3 h-3 ms-1 text-[#FF7E47] -mt-0.5" />
                  )}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── GreenAPI Credentials Card ── */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50"
      >
        {/* Title */}
        <div className="px-6 sm:px-8 pt-8 pb-2">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-[#2D2A26] text-center">
              {t("greenApiTitle")}
            </h2>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF7E47] to-[#E86B38] flex items-center justify-center flex-shrink-0 shadow-[0_2px_10px_rgba(255,126,71,0.3)]">
              <Link2 className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 sm:px-8 py-8">
          <div className="max-w-md mx-auto space-y-6">
            {/* Instance ID */}
            <motion.div variants={fadeUp}>
              <label className="block text-xs font-bold text-[#7A7267] uppercase tracking-wider mb-2 text-end">
                {t("instanceIdLabel")}
              </label>
              <input
                type="text"
                dir="ltr"
                value={instanceId}
                onChange={(e) => setInstanceId(e.target.value)}
                placeholder={t("instanceIdPlaceholder")}
                className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-5 py-4 text-sm text-[#2D2A26] placeholder-[#C4BAB0] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200 font-mono tracking-wide"
              />
            </motion.div>

            {/* API Token */}
            <motion.div variants={fadeUp}>
              <label className="block text-xs font-bold text-[#7A7267] uppercase tracking-wider mb-2 text-end">
                {t("apiTokenLabel")}
              </label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  dir="ltr"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={t("apiTokenPlaceholder")}
                  className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl ps-12 pe-5 py-4 text-sm text-[#2D2A26] placeholder-[#C4BAB0] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200 font-mono tracking-wide"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute start-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#A39B90] hover:text-[#FF7E47] transition-colors"
                >
                  {showToken ? (
                    <EyeOff className="w-4.5 h-4.5" />
                  ) : (
                    <Eye className="w-4.5 h-4.5" />
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Connect Bot Button */}
        <div className="px-6 sm:px-8 pb-8">
          <motion.button
            variants={fadeUp}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="group w-full inline-flex items-center justify-center gap-3 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-base rounded-2xl py-4 transition-all duration-300 shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)]"
          >
            {t("connectBot")}
            <Wifi className="w-5 h-5 transition-transform group-hover:scale-110" />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ConnectSection;
