import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const ORANGE = "#FF6B2C";
const ORANGE_DARK = "#E8590C";

const HeroSection = () => {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();

  return (
    <section
      id="hero"
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-[#FAFAFA]"
    >
      <div className="hero-glow" />

      {/* ── Floating geometric accents ── */}

      {/* Large diamond — top right (orange) */}
      <motion.div
        className="absolute top-[15%] right-[12%] w-6 h-6 border-2 border-[#FF6B2C]/55 rotate-45"
        animate={{ y: [0, -18, 0], rotate: [45, 50, 45] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Solid circle — top left (gray) */}
      <motion.div
        className="absolute top-[20%] left-[8%] w-4 h-4 rounded-full bg-[#94A3B8]/60"
        animate={{ y: [0, 14, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Ring — mid right (orange) */}
      <motion.div
        className="absolute top-[45%] right-[8%] w-8 h-8 rounded-full border-2 border-[#FF6B2C]/40"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Small solid dot — upper mid left (gray) */}
      <motion.div
        className="absolute top-[30%] left-[18%] w-3 h-3 rounded-full bg-[#94A3B8]/50"
        animate={{ y: [0, -10, 0], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />

      {/* Horizontal line — left mid (gray) */}
      <motion.div
        className="absolute top-[55%] left-[6%] w-10 h-[2px] bg-[#94A3B8]/50"
        animate={{ scaleX: [1, 1.8, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      {/* Cross / plus — bottom right (orange) */}
      <motion.div
        className="absolute bottom-[25%] right-[15%] w-5 h-5 opacity-55"
        animate={{ rotate: [0, 90, 0], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#FF6B2C] -translate-y-1/2" />
        <div className="absolute left-1/2 top-0 w-[2px] h-full bg-[#FF6B2C] -translate-x-1/2" />
      </motion.div>

      {/* Hollow square — bottom left (gray) */}
      <motion.div
        className="absolute bottom-[20%] left-[14%] w-5 h-5 border-2 border-[#94A3B8]/60"
        animate={{ y: [0, 12, 0], rotate: [0, 15, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
      />

      {/* Large faint ring — center left background (gray) */}
      <motion.div
        className="absolute top-[35%] left-[25%] w-12 h-12 rounded-full border border-[#94A3B8]/40"
        animate={{ scale: [1, 1.1, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Small diamond — bottom center-right (orange) */}
      <motion.div
        className="absolute bottom-[30%] right-[30%] w-4 h-4 border border-[#FF6B2C]/55 rotate-45"
        animate={{ y: [0, -8, 0], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* Vertical line — upper right (gray) */}
      <motion.div
        className="absolute top-[18%] right-[25%] w-[2px] h-8 bg-[#94A3B8]/45"
        animate={{ scaleY: [1, 1.5, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 3.5 }}
      />

      {/* Tiny dot cluster — mid left (gray) */}
      <motion.div
        className="absolute top-[60%] left-[22%] flex gap-2"
        animate={{ opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]/60" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]/45" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]/30" />
      </motion.div>

      {/* ── Main content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl sm:text-6xl md:text-8xl font-bold leading-tight mb-8"
        >
          <span className="text-[#1A1A1A]">{t("heroTitle1")}</span>{" "}
          <span
            style={{
              background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {t("heroTitle2")}
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="text-gray-500 text-lg sm:text-xl max-w-2xl mx-auto mb-12 whitespace-pre-line leading-relaxed"
        >
          {t("heroSubtitle")}
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <button
            onClick={() => navigate("/auth")}
            className="clix-btn text-lg px-8 py-4 rounded-xl"
          >
            {t("heroBtn")}
          </button>
        </motion.div>

        {/* Trust signal */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.7 }}
          className="text-gray-400 text-sm mt-6"
        >
          {t("heroNote")}
        </motion.p>
      </div>
    </section>
  );
};

export default HeroSection;
