import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  AnimatePresence,
  type Variants,
} from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  MessageSquareText,
  QrCode,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MessageCircle,
  Workflow,
  ArrowLeft,
} from "lucide-react";

/* ── constants ── */
const AUTO_ADVANCE_MS = 6000;
const STEPS = [0, 1, 2, 3] as const;
type StepIdx = (typeof STEPS)[number];

const stepIcons = [ClipboardList, MessageSquareText, QrCode, Workflow] as const;

/* ── slide variants ── */
const slideVariants: Variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 120 : -120,
    opacity: 0,
    filter: "blur(6px)",
  }),
  center: { x: 0, opacity: 1, filter: "blur(0px)" },
  exit: (dir: number) => ({
    x: dir < 0 ? 120 : -120,
    opacity: 0,
    filter: "blur(6px)",
  }),
};

/* ── fade-up helper ── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

/* ═══════════════════════════════════════════════════════════════
   MOCK COMPONENTS — inline, per plan
   ═══════════════════════════════════════════════════════════════ */

/* ── Browser chrome bar ── */
const BrowserChrome = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
    <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B2C]/40" />
    <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B2C]/25" />
    <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B2C]/15" />
    <span className="text-[#FDF8F2]/25 text-xs tracking-wider mr-auto">
      {label}
    </span>
  </div>
);

/* ── Step 1: Form wizard mock ── */
const FormMock = ({ t }: { t: (k: string) => string }) => (
  <div className="bg-[#1A1510] rounded-2xl overflow-hidden border border-[#2A2318]/60 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
    <BrowserChrome label="CLIX" />
    <div
      className="p-6 sm:p-8 min-h-[320px] flex flex-col justify-between"
      style={{
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {Array.from({ length: 7 }).map((_, i) => (
          <motion.div
            key={i}
            className={`h-1.5 rounded-full ${
              i < 3
                ? "bg-[#FF6B2C]"
                : i === 3
                  ? "bg-[#FF6B2C]/40"
                  : "bg-white/10"
            }`}
            style={{ width: i === 3 ? 24 : i < 3 ? 16 : 8 }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
          />
        ))}
      </div>

      {/* Step counter */}
      <motion.p
        className="text-[#FDF8F2]/25 text-xs text-center mb-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {t("mockFormStep")}
      </motion.p>

      {/* Question */}
      <motion.h3
        className="text-[#FDF8F2]/80 text-lg sm:text-xl font-medium text-center mb-6"
        dir="rtl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        {t("mockFormQuestion")}
      </motion.h3>

      {/* Input field */}
      <motion.div
        className="mx-auto w-full max-w-xs"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.4 }}
      >
        <div
          dir="rtl"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-[#FDF8F2]/30"
        >
          {t("mockFormPlaceholder")}
        </div>
      </motion.div>

      {/* Next button */}
      <motion.div
        className="flex justify-center mt-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.4 }}
      >
        <div className="flex items-center gap-2 bg-[#FF6B2C] hover:bg-[#E8590C] text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
          {t("mockFormNext")}
          <ArrowLeft className="w-4 h-4" />
        </div>
      </motion.div>
    </div>
  </div>
);

/* ── Step 2: Preview & Edit dual chat mock ── */
const PreviewMock = ({ t }: { t: (k: string) => string }) => (
  <div className="bg-[#1A1510] rounded-2xl overflow-hidden border border-[#2A2318]/60 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
    <BrowserChrome label="CLIX" />
    <div className="flex min-h-[320px]">
      {/* Demo chat panel */}
      <div className="flex-[3] border-l border-white/[0.06] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
          <MessageCircle className="w-3.5 h-3.5 text-[#FF6B2C]/60" />
          <span className="text-xs text-[#FDF8F2]/40 font-medium">
            {t("mockDemoTitle")}
          </span>
        </div>
        <div dir="rtl" className="flex-1 p-4 space-y-3">
          {/* User message */}
          <motion.div
            className="flex justify-end"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <div className="bg-[#DCF8C6] rounded-2xl rounded-se-sm px-3 py-2 max-w-[85%] shadow-sm">
              <p className="text-xs text-gray-800">{t("mockDemoUser1")}</p>
            </div>
          </motion.div>
          {/* Bot response */}
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.4 }}
          >
            <div className="bg-white/[0.08] rounded-2xl rounded-ss-sm px-3 py-2 max-w-[85%]">
              <p className="text-xs text-[#FDF8F2]/70">{t("mockDemoBot1")}</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-white/[0.06]" />

      {/* Edit chat panel */}
      <div className="flex-[2] hidden sm:flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
          <Sparkles className="w-3.5 h-3.5 text-amber-400/60" />
          <span className="text-xs text-[#FDF8F2]/40 font-medium">
            {t("mockEditTitle")}
          </span>
        </div>
        <div dir="rtl" className="flex-1 p-4 space-y-3">
          {/* User edit request */}
          <motion.div
            className="flex justify-end"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.4 }}
          >
            <div className="bg-amber-400/15 border border-amber-400/20 rounded-2xl rounded-se-sm px-3 py-2 max-w-[90%]">
              <p className="text-xs text-amber-200/80">{t("mockEditUser1")}</p>
            </div>
          </motion.div>
          {/* Bot confirmation */}
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 0.4 }}
          >
            <div className="bg-white/[0.06] rounded-2xl rounded-ss-sm px-3 py-2 max-w-[90%]">
              <p className="text-xs text-[#FDF8F2]/60">{t("mockEditBot1")}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  </div>
);

/* ── Step 3: WhatsApp connect mock ── */
const ConnectMock = ({ t }: { t: (k: string) => string }) => {
  const [showConnected, setShowConnected] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowConnected(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-[#111B21] rounded-2xl overflow-hidden border border-[#2A2F33]/60 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      <BrowserChrome label="CLIX" />
      <div className="min-h-[320px] flex flex-col items-center justify-center p-8 relative">
        {/* QR code fake pattern */}
        <motion.div
          className="relative mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl bg-white p-3 shadow-lg shadow-[#25D366]/10">
            {/* CSS grid QR pattern */}
            <div className="w-full h-full grid grid-cols-9 grid-rows-9 gap-[2px]">
              {Array.from({ length: 81 }).map((_, i) => {
                const row = Math.floor(i / 9);
                const col = i % 9;
                // Corner squares
                const isCorner =
                  (row < 3 && col < 3) ||
                  (row < 3 && col > 5) ||
                  (row > 5 && col < 3);
                // Random-ish data pixels
                const isData =
                  !isCorner && (i * 7 + 3) % 3 === 0;
                return (
                  <div
                    key={i}
                    className={`rounded-[1px] ${
                      isCorner
                        ? "bg-[#1A1A1A]"
                        : isData
                          ? "bg-[#1A1A1A]/80"
                          : "bg-transparent"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* WhatsApp icon overlay on QR */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Scan instruction */}
        <motion.p
          className="text-[#FDF8F2]/40 text-sm mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {t("mockQrInstruction")}
        </motion.p>

        {/* Platform pills */}
        <motion.div
          className="flex items-center gap-2 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <div className="px-3 py-1 rounded-full text-[10px] font-medium bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/20">
            Android
          </div>
          <div className="px-3 py-1 rounded-full text-[10px] font-medium bg-white/[0.06] text-[#FDF8F2]/30 border border-white/[0.08]">
            iPhone
          </div>
        </motion.div>

        {/* Connected success badge */}
        <AnimatePresence>
          {showConnected && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-[#111B21]/90 backdrop-blur-sm rounded-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                className="flex flex-col items-center gap-3"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  delay: 0.15,
                }}
              >
                <div className="w-16 h-16 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg shadow-[#25D366]/30">
                  <Check className="w-8 h-8 text-white" strokeWidth={3} />
                </div>
                <p className="text-[#25D366] text-lg font-bold">
                  {t("mockConnected")}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ── Step 4: Flow Builder mock ── */
const FlowBuilderMock = ({ t }: { t: (k: string, opts?: Record<string, boolean>) => string }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const btnLabels = (t as any)("mockFlowBtnLabels", { returnObjects: true }) as string[];

  return (
    <div className="bg-[#1A1510] rounded-2xl overflow-hidden border border-[#2A2318]/60 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <BrowserChrome label="CLIX — Flow Builder" />
      <div className="flex min-h-[320px]">
        {/* Node palette sidebar */}
        <div className="hidden sm:flex flex-col w-14 border-l border-white/[0.06] bg-white/[0.02] py-3 items-center gap-1">
          <span className="text-[8px] text-[#FDF8F2]/20 font-medium mb-2 tracking-wider">
            {t("mockFlowPalette")}
          </span>
          {[
            { icon: "T", color: "text-blue-400/50", bg: "bg-blue-400/8" },
            { icon: "☰", color: "text-green-400/50", bg: "bg-green-400/8" },
            { icon: "◇", color: "text-amber-400/50", bg: "bg-amber-400/8" },
            { icon: "⏱", color: "text-purple-400/50", bg: "bg-purple-400/8" },
          ].map((node, i) => (
            <motion.div
              key={i}
              className={`w-9 h-9 rounded-lg ${node.bg} flex items-center justify-center ${node.color} text-xs cursor-default border border-white/[0.04]`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
            >
              {node.icon}
            </motion.div>
          ))}
        </div>

        {/* Canvas area */}
        <div
          className="flex-1 p-4 sm:p-6 relative overflow-hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-0 justify-center h-full">
            {/* Start node */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <div className="w-24 sm:w-28 rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-2.5 text-center backdrop-blur-sm">
                <div className="text-[9px] text-emerald-400/50 mb-1 font-medium tracking-wide">
                  {t("mockFlowStart")}
                </div>
                <div className="text-[11px] text-[#FDF8F2]/50 bg-white/[0.04] rounded px-2 py-0.5">
                  {t("mockFlowTrigger")}
                </div>
              </div>
            </motion.div>

            {/* Connector 1 */}
            <motion.div
              className="hidden sm:flex items-center"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
              style={{ transformOrigin: "left" }}
            >
              <div className="w-8 h-px bg-white/10" />
              <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent border-l-white/15" />
            </motion.div>
            <div className="sm:hidden w-px h-4 bg-white/10" />

            {/* Text Message node */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <div className="w-28 sm:w-32 rounded-xl border border-blue-400/20 bg-blue-400/8 p-2.5 text-center backdrop-blur-sm">
                <div className="text-[9px] text-blue-400/50 mb-1 font-medium tracking-wide">
                  {t("mockFlowText")}
                </div>
                <div className="text-[11px] text-[#FDF8F2]/55">
                  {t("mockFlowGreeting")}
                </div>
              </div>
            </motion.div>

            {/* Connector 2 */}
            <motion.div
              className="hidden sm:flex items-center"
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.3 }}
              style={{ transformOrigin: "left" }}
            >
              <div className="w-8 h-px bg-white/10" />
              <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-t-transparent border-b-transparent border-l-white/15" />
            </motion.div>
            <div className="sm:hidden w-px h-4 bg-white/10" />

            {/* Buttons node — active with orange glow */}
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              <motion.div
                className="w-28 sm:w-32 rounded-xl border border-[#FF6B2C]/30 bg-[#FF6B2C]/10 p-2.5 text-center backdrop-blur-sm"
                animate={{
                  boxShadow: [
                    "0 0 15px rgba(255,107,44,0.06)",
                    "0 0 25px rgba(255,107,44,0.15)",
                    "0 0 15px rgba(255,107,44,0.06)",
                  ],
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="text-[9px] text-[#FF6B2C]/50 mb-1 font-medium tracking-wide">
                  {t("mockFlowButtons")}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  {btnLabels.map((label, i) => (
                    <div
                      key={i}
                      className="text-[9px] text-[#FDF8F2]/40 bg-white/[0.05] rounded px-1.5 py-0.5"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Floating "selected" indicator on buttons node */}
          <motion.div
            className="absolute bottom-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FF6B2C]/10 border border-[#FF6B2C]/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.4 }}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C] animate-pulse" />
            <span className="text-[8px] text-[#FF6B2C]/60 font-medium">Editing</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN SECTION
   ═══════════════════════════════════════════════════════════════ */

const ProductPreviewSection = () => {
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const [activeStep, setActiveStep] = useState<StepIdx>(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const progressRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const [progress, setProgress] = useState(0);

  /* ── auto-advance + progress bar ── */
  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(progressRef.current);
    setProgress(0);

    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100));
    }, 50);

    timerRef.current = setInterval(() => {
      setDirection(1);
      setActiveStep((prev) => ((prev + 1) % 4) as StepIdx);
    }, AUTO_ADVANCE_MS);
  }, []);

  useEffect(() => {
    if (inView) resetTimer();
    return () => {
      clearInterval(timerRef.current);
      clearInterval(progressRef.current);
    };
  }, [inView, resetTimer]);

  /* reset progress when step changes */
  useEffect(() => {
    setProgress(0);
    clearInterval(progressRef.current);
    const startTime = Date.now();
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / AUTO_ADVANCE_MS) * 100, 100));
    }, 50);
    return () => clearInterval(progressRef.current);
  }, [activeStep]);

  const goToStep = (idx: StepIdx) => {
    setDirection(idx > activeStep ? 1 : -1);
    setActiveStep(idx);
    resetTimer();
  };

  const stepKeys = ["step1", "step2", "step3", "step4"];
  const bulletKeys = [
    ["step1Bullet1", "step1Bullet2", "step1Bullet3"],
    ["step2Bullet1", "step2Bullet2", "step2Bullet3"],
    ["step3Bullet1", "step3Bullet2", "step3Bullet3"],
    ["step4Bullet1", "step4Bullet2", "step4Bullet3"],
  ];
  const titleKeys = ["step1Title", "step2Title", "step3Title", "step4Title"];
  const badgeKeys = ["step1Badge", null, "step3Badge", null];

  return (
    <section
      id="preview"
      className="relative min-h-dvh flex flex-col justify-center py-24 px-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #FBF5EE 0%, #F8F0E6 60%, #FDF8F2 100%)",
      }}
    >
      {/* ── Floating accents ── */}
      <motion.div
        className="absolute top-[10%] right-[4%] w-5 h-5 border-2 border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, -14, 0], rotate: [45, 50, 45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[12%] left-[3%] w-7 h-7 rounded-full border-2 border-[#FF6B2C]/15"
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.4, 0.15] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5,
        }}
      />
      <motion.div
        className="absolute top-[50%] left-[2%] flex gap-2"
        animate={{ opacity: [0.15, 0.4, 0.15] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/25" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/12" />
      </motion.div>
      <motion.div
        className="absolute bottom-[20%] right-[3%] w-4 h-4 border border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, 10, 0], rotate: [45, 50, 45] }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      />

      {/* ── Section header ── */}
      <div ref={ref} className="max-w-5xl mx-auto text-center mb-14 relative z-10">
        <motion.h2
          className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3"
          initial={fadeUp(0).initial}
          animate={inView ? fadeUp(0).animate : {}}
          transition={fadeUp(0).transition}
        >
          <span className="text-[#1A1A1A]">{t("howItWorks")}</span>
        </motion.h2>
        <motion.p
          className="text-gray-500 text-lg"
          initial={fadeUp(0.15).initial}
          animate={inView ? fadeUp(0.15).animate : {}}
          transition={fadeUp(0.15).transition}
        >
          {t("automationInMinutes")}
        </motion.p>
      </div>

      {/* ── Tab bar ── */}
      <motion.div
        className="flex items-center justify-center gap-2 sm:gap-4 mb-10 relative z-10"
        initial={fadeUp(0.25).initial}
        animate={inView ? fadeUp(0.25).animate : {}}
        transition={fadeUp(0.25).transition}
      >
        {STEPS.map((idx) => {
          const Icon = stepIcons[idx];
          const isActive = activeStep === idx;
          return (
            <button
              type="button"
              key={idx}
              onClick={() => goToStep(idx)}
              className={`relative flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "text-[#FF6B2C]"
                  : "text-[#1A1A1A]/45 hover:text-[#1A1A1A]/70"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t(stepKeys[idx])}</span>
              <span className="sm:hidden text-xs">
                {String(idx + 1).padStart(2, "0")}
              </span>

              {/* Active underline with progress fill */}
              {isActive && (
                <motion.div
                  layoutId="step-underline"
                  className="absolute -bottom-1 left-2 right-2 h-[3px] rounded-full bg-[#FF6B2C]/20 overflow-hidden"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                >
                  <motion.div
                    className="h-full bg-[#FF6B2C] rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </motion.div>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* ── Main content: text + mock ── */}
      <motion.div
        className="max-w-6xl mx-auto relative z-10 w-full"
        initial={fadeUp(0.35).initial}
        animate={inView ? fadeUp(0.35).animate : {}}
        transition={fadeUp(0.35).transition}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
          {/* Left: text content */}
          <div dir="rtl" className="order-2 lg:order-1">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`text-${activeStep}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Step badge */}
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="text-4xl sm:text-5xl font-bold text-[#FF6B2C]/15">
                    {String(activeStep + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-2xl sm:text-3xl font-bold text-[#1A1A1A] mb-5 leading-snug">
                  {t(titleKeys[activeStep])}
                </h3>

                {/* Bullets */}
                <ul className="space-y-3 mb-6">
                  {bulletKeys[activeStep].map((key) => (
                    <li key={key} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#FF6B2C]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-[#FF6B2C]" />
                      </div>
                      <span className="text-gray-600 text-sm leading-relaxed">
                        {t(key)}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Time badge */}
                {badgeKeys[activeStep] && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF6B2C]/8 border border-[#FF6B2C]/15">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C] animate-pulse" />
                    <span className="text-xs font-medium text-[#FF6B2C]">
                      {t(badgeKeys[activeStep]!)}
                    </span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right: mock */}
          <div className="order-1 lg:order-2 relative">
            {/* Navigation arrows (desktop) */}
            <button
              type="button"
              onClick={() =>
                goToStep(
                  (activeStep === 0 ? 3 : activeStep - 1) as StepIdx,
                )
              }
              className="hidden lg:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-[#FF6B2C]/10 items-center justify-center text-[#FF6B2C]/60 hover:text-[#FF6B2C] hover:border-[#FF6B2C]/30 transition-colors shadow-sm cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                goToStep(((activeStep + 1) % 4) as StepIdx)
              }
              className="hidden lg:flex absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/80 backdrop-blur border border-[#FF6B2C]/10 items-center justify-center text-[#FF6B2C]/60 hover:text-[#FF6B2C] hover:border-[#FF6B2C]/30 transition-colors shadow-sm cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`mock-${activeStep}`}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeStep === 0 && <FormMock t={t} />}
                {activeStep === 1 && <PreviewMock t={t} />}
                {activeStep === 2 && <ConnectMock t={t} />}
                {activeStep === 3 && <FlowBuilderMock t={t} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

    </section>
  );
};

export default ProductPreviewSection;
