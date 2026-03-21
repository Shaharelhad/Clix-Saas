import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Clock, Headphones } from "lucide-react";

const ORANGE = "#FF6B2C";
const ORANGE_DARK = "#E8590C";

const CtaSection = () => {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      className="relative min-h-dvh flex flex-col justify-center py-32 px-6 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FDF8F2 0%, #F8F0E6 60%, #FBF5EE 100%)" }}
    >
      {/* Floating geometric accents */}
      <motion.div
        className="absolute top-[8%] left-[6%] w-5 h-5 border-2 border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, -16, 0], rotate: [45, 52, 45] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[15%] right-[5%] w-7 h-7 rounded-full border-2 border-[#FF6B2C]/15"
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />
      <motion.div
        className="absolute bottom-[10%] left-[4%] w-3 h-3 rounded-full bg-[#FF6B2C]/20"
        animate={{ y: [0, 12, 0], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[15%] right-[3%] w-4 h-4 border border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, -10, 0], rotate: [45, 48, 45] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.div
        className="absolute top-[45%] left-[2%] w-6 h-[2px] bg-[#FF6B2C]/20"
        animate={{ scaleX: [1, 1.8, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      <motion.div
        className="absolute top-[55%] right-[2%] flex gap-2"
        animate={{ opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/35" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/20" />
      </motion.div>

      {/* Central glass container */}
      <div ref={ref} className="relative z-10 max-w-3xl mx-auto">
        <motion.div
          className="text-center py-12 sm:py-20 px-6 sm:px-10 md:px-16 relative rounded-[1.25rem] border border-white/60"
          style={{ background: "rgba(255,255,255,0.7)", boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.5)" }}
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4"
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-[#1A1A1A]">{t("ctaTitle").split("?")[0]}</span>
            <span
              style={{
                background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ?
            </span>
          </motion.h2>

          <motion.p
            className="text-gray-500 text-lg sm:text-xl mb-12"
            initial={{ opacity: 0, y: 15 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {t("ctaSubtitle")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={() => navigate("/auth?mode=signup")}
              className="clix-btn cta-glow-pulse text-base sm:text-xl px-8 sm:px-12 py-4 sm:py-5 rounded-xl"
            >
              {t("ctaBtn")}
            </button>
          </motion.div>
        </motion.div>

        {/* Floating stat badge — top-right */}
        <motion.div
          className="absolute -top-5 -right-3 sm:-right-16 px-4 py-3 z-20 hidden sm:block rounded-[1.25rem] border border-white/60"
          style={{ background: "rgba(255,255,255,0.7)", boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: [0, -5, 0] }}
          transition={{
            opacity: { delay: 0.9, duration: 0.5 },
            y: { delay: 0.9, duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${ORANGE}20, ${ORANGE}40)` }}
            >
              <Clock className="w-4 h-4" style={{ color: ORANGE }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">{t("ctaStatSetup")}</p>
            </div>
          </div>
        </motion.div>

        {/* Floating stat badge — bottom-left */}
        <motion.div
          className="absolute -bottom-5 -left-3 sm:-left-14 px-3 py-2.5 z-20 hidden sm:block rounded-[1.25rem] border border-white/60"
          style={{ background: "rgba(255,255,255,0.7)", boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: [0, 4, 0] }}
          transition={{
            opacity: { delay: 1.3, duration: 0.5 },
            y: { delay: 1.3, duration: 7, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})` }}
            >
              <Headphones className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-sm font-semibold text-gray-700">
              {t("ctaStat247")}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CtaSection;
