import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bot, Zap } from "lucide-react";

const ORANGE = "#FF6B2C";
const ORANGE_DARK = "#E8590C";

/* ── stagger helpers ── */
const stagger = (i: number, base = 0) => base + i * 0.12;

const HeroSection = () => {
  const { t } = useTranslation("landing");
  const navigate = useNavigate();

  return (
    <section
      id="hero"
      className="relative min-h-dvh flex items-center overflow-hidden"
      style={{ background: "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)" }}
    >
      {/* ── Diagonal lines + subtle glow ── */}
      <div className="hero-glow-light" />

      {/* ── Floating geometric accents — positioned at outer edges ── */}

      {/* Diamond — top-left corner */}
      <motion.div
        className="absolute top-[6%] left-[3%] w-6 h-6 border-2 border-[#FF6B2C]/50 rotate-45"
        animate={{ y: [0, -18, 0], rotate: [45, 50, 45] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Solid circle — top-right corner */}
      <motion.div
        className="absolute top-[5%] right-[4%] w-4 h-4 rounded-full bg-[#FF6B2C]/40"
        animate={{ y: [0, 14, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      {/* Ring — bottom-right corner */}
      <motion.div
        className="absolute bottom-[6%] right-[2%] w-8 h-8 rounded-full border-2 border-[#FF6B2C]/35"
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Horizontal line — far left edge */}
      <motion.div
        className="absolute top-[50%] left-[1%] w-10 h-[2px] bg-[#FF6B2C]/40"
        animate={{ scaleX: [1, 1.8, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      {/* Cross / plus — bottom-left corner */}
      <motion.div
        className="absolute bottom-[8%] left-[4%] w-5 h-5 opacity-50"
        animate={{ rotate: [0, 90, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      >
        <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#FF6B2C] -translate-y-1/2" />
        <div className="absolute left-1/2 top-0 w-[2px] h-full bg-[#FF6B2C] -translate-x-1/2" />
      </motion.div>

      {/* Hollow square — top-right edge */}
      <motion.div
        className="absolute top-[12%] right-[2%] w-5 h-5 border-2 border-[#FF6B2C]/45"
        animate={{ y: [0, 12, 0], rotate: [0, 15, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
      />

      {/* Small diamond — top center */}
      <motion.div
        className="absolute top-[3%] left-[45%] w-4 h-4 border border-[#FF6B2C]/50 rotate-45"
        animate={{ y: [0, -8, 0], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* Dot cluster — far right edge */}
      <motion.div
        className="absolute top-[55%] right-[1%] flex gap-2"
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/60" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/20" />
      </motion.div>

      {/* Faint ring — center gap upper */}
      <motion.div
        className="absolute top-[20%] left-[48%] w-7 h-7 rounded-full border border-[#FF6B2C]/25"
        animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* Small dot — center gap lower */}
      <motion.div
        className="absolute bottom-[18%] left-[50%] w-2.5 h-2.5 rounded-full bg-[#FF6B2C]/35"
        animate={{ y: [0, -10, 0], opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 3.5 }}
      />

      {/* Tiny diamond — center gap mid */}
      <motion.div
        className="absolute top-[70%] left-[46%] w-3 h-3 border border-[#FF6B2C]/30 rotate-45"
        animate={{ y: [0, 8, 0], rotate: [45, 50, 45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />

      {/* ── Main content — two-column grid ── */}
      <div
        dir="ltr"
        className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-20 lg:py-0 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center"
      >
        {/* ── Left column — Text content (RTL) ── */}
        <div dir="rtl" className="order-2 lg:order-1 text-left">
          {/* Headline */}
          <motion.h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
            <motion.span
              initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.7,
                delay: stagger(0),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="inline-block text-[#1A1A1A]"
            >
              {t("heroTitle1")}
            </motion.span>{" "}
            <motion.span
              initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{
                duration: 0.7,
                delay: stagger(1),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="inline-block"
              style={{
                background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {t("heroTitle2")}
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: stagger(2, 0.1),
              ease: [0.22, 1, 0.36, 1],
            }}
            className="text-gray-500 text-lg sm:text-xl max-w-lg mb-10 whitespace-pre-line leading-relaxed mr-auto"
          >
            {t("heroSubtitle")}
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: stagger(3, 0.15),
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/auth?mode=signup")}
              className="clix-btn cta-glow-pulse text-lg px-8 py-4 rounded-xl"
            >
              {t("heroBtn")}
            </button>
          </motion.div>

          {/* Trust signal */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: stagger(4, 0.2) }}
            className="text-gray-400 text-sm mt-5"
          >
            {t("heroNote")}
          </motion.p>
        </div>

        {/* ── Right column — Glassmorphism WhatsApp chat mockup ── */}
        <motion.div
          className="order-1 lg:order-2 flex justify-center lg:justify-end"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.3,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ perspective: "1200px" }}
        >
          <div
            className="relative"
            style={{
              transform: "rotateY(16deg) rotateX(5deg)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* ── Primary card: WhatsApp chat window ── */}
            <div className="glass-card w-full max-w-[320px] sm:max-w-[360px] lg:max-w-[400px] overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/30">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`,
                  }}
                >
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">CLIX Bot</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-gray-500">Online</span>
                  </div>
                </div>
                <div className="text-xs text-gray-400">12:34</div>
              </div>

              {/* Chat messages */}
              <div dir="rtl" className="p-4 space-y-3 min-h-[240px]">
                {/* User message */}
                <motion.div
                  className="flex justify-end"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                >
                  <div className="bg-[#DCF8C6] rounded-2xl rounded-se-sm px-3 py-2 max-w-[80%] shadow-sm">
                    <p className="text-sm text-gray-800">
                      שלום, מה שעות הפעילות?
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5 text-left">
                      12:34
                    </p>
                  </div>
                </motion.div>

                {/* Bot response */}
                <motion.div
                  className="flex justify-start gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.4 }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1"
                    style={{
                      background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`,
                    }}
                  >
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-ss-sm px-3 py-2 max-w-[80%] shadow-sm">
                    <p className="text-sm text-gray-800">
                      היי! שעות הפעילות שלנו: ימים א׳-ה׳ 9:00-18:00. איך אפשר
                      לעזור עוד? 😊
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5 text-left">
                      12:34
                    </p>
                  </div>
                </motion.div>

                {/* Second user message */}
                <motion.div
                  className="flex justify-end"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5, duration: 0.4 }}
                >
                  <div className="bg-[#DCF8C6] rounded-2xl rounded-se-sm px-3 py-2 max-w-[80%] shadow-sm">
                    <p className="text-sm text-gray-800">יש לכם מבצעים?</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 text-left">
                      12:35
                    </p>
                  </div>
                </motion.div>

                {/* Typing indicator */}
                <motion.div
                  className="flex justify-start gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.9, duration: 0.3 }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1"
                    style={{
                      background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`,
                    }}
                  >
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-ss-sm px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-1 py-1 px-1">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* ── Secondary card: Smart Bot badge (top-right) ── */}
            <motion.div
              className="absolute -top-4 -right-4 lg:-top-6 lg:-right-10 px-4 py-3 z-10 rounded-[1.25rem] border border-white/60"
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
                  style={{
                    background: `linear-gradient(135deg, ${ORANGE}20, ${ORANGE}40)`,
                  }}
                >
                  <Zap className="w-4 h-4" style={{ color: ORANGE }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">בוט חכם</p>
                  <p className="text-lg font-bold text-gray-800">AI</p>
                </div>
              </div>
            </motion.div>

            {/* ── Tertiary card: Personal AI Bot (bottom-right) ── */}
            <motion.div
              className="absolute -bottom-3 -left-3 lg:-bottom-5 lg:-left-8 px-3 py-2.5 z-10 hidden sm:block rounded-[1.25rem] border border-white/60"
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
                  style={{
                    background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})`,
                  }}
                >
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  הבוט האישי שלך
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>

    </section>
  );
};

export default HeroSection;
