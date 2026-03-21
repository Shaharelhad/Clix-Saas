import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { callWClixAPIConnect } from "@/services/edge-functions";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";

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

/* ── Tutorial slider config ── */
type Platform = "android" | "iphone";

const TUTORIAL_STEPS = {
  android: [
    { textKey: "tutorialStepAndroid1", image: "/tutorial/android/androidstep1.jpg" },
    { textKey: "tutorialStepAndroid2", image: "/tutorial/android/androidstep2.jpg" },
  ],
  iphone: [
    { textKey: "tutorialStepIphone1", image: "/tutorial/iphone/iphonestep1.jpg" },
    { textKey: "tutorialStepIphone2", image: "/tutorial/iphone/iphonestep2.jpg" },
  ],
} as const;

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 120 : -120,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.35, ease: EASE },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -120 : 120,
    opacity: 0,
    transition: { duration: 0.25, ease: EASE },
  }),
};

/* ── Confetti particle config ── */
const PARTICLE_COLORS = ["#FF7E47", "#FFB878", "#FFC599", "#FF9A6C", "#FFD4B8"];

function generateParticles(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 400,
    y: (Math.random() - 0.5) * 400 - 100,
    rotate: Math.random() * 720 - 360,
    scale: Math.random() * 0.6 + 0.4,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    delay: Math.random() * 0.3,
    size: Math.random() * 8 + 4,
  }));
}

/* ── Success Overlay ── */
function SuccessOverlay({ onGoToDashboard, t }: { onGoToDashboard: () => void; t: (key: string) => string }) {
  const particles = useMemo(() => generateParticles(16), []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(253, 248, 242, 0.92)", backdropFilter: "blur(8px)" }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: [0, p.scale, 0],
            opacity: [1, 1, 0],
            rotate: p.rotate,
          }}
          transition={{ duration: 1.4, delay: p.delay, ease: "easeOut" }}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
        />
      ))}

      <div className="flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="relative"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1.3], opacity: [0.5, 0, 0] }}
            transition={{ duration: 1.2, delay: 0.3 }}
            className="absolute inset-0 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,126,71,0.3) 0%, transparent 70%)" }}
          />
          <svg width="96" height="96" viewBox="0 0 96 96" className="relative">
            <motion.circle
              cx="48"
              cy="48"
              r="44"
              fill="#FF7E47"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              style={{ transformOrigin: "center" }}
            />
            <motion.path
              d="M28 50 L42 64 L68 34"
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 0.5, ease: "easeOut" }}
            />
          </svg>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7, ease: EASE }}
          className="text-center space-y-2"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#2D2A26]">
            {t("connectSuccessTitle")}
          </h2>
          <p className="text-base text-[#7A7267] max-w-sm mx-auto">
            {t("connectSuccessSubtitle")}
          </p>
        </motion.div>

        <motion.button
          type="button"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0, ease: EASE }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onGoToDashboard}
          className="inline-flex items-center gap-3 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-lg rounded-2xl px-10 py-4 transition-colors duration-300 shadow-[0_4px_24px_rgba(255,126,71,0.35)] hover:shadow-[0_6px_32px_rgba(255,126,71,0.45)] cursor-pointer"
        >
          {t("goToDashboard")}
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}

const ConnectSection = () => {
  const { t, i18n } = useTranslation("createBot");
  const isRTL = i18n.language === "he";
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  /* ── Tutorial slider state ── */
  const [platform, setPlatform] = useState<Platform>("android");
  const [tutorialStep, setTutorialStep] = useState(0);
  const [slideDirection, setSlideDirection] = useState(0);

  const steps = TUTORIAL_STEPS[platform];
  const currentStep = steps[tutorialStep];
  const totalSteps = steps.length;

  const handlePlatformChange = (p: Platform) => {
    setPlatform(p);
    setTutorialStep(0);
    setSlideDirection(0);
  };

  const goNext = () => {
    if (tutorialStep >= totalSteps - 1) return;
    setSlideDirection(isRTL ? -1 : 1);
    setTutorialStep((s) => s + 1);
  };
  const goPrev = () => {
    if (tutorialStep <= 0) return;
    setSlideDirection(isRTL ? 1 : -1);
    setTutorialStep((s) => s - 1);
  };

  /* ── Bot status & connect logic (unchanged) ── */
  const { data: botStatus, refetch: refetchBotStatus } = useQuery({
    queryKey: ["bot_status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("bot_status")
        .eq("id", user.id)
        .single();
      return data?.bot_status ?? null;
    },
    enabled: !!user?.id,
  });

  const connectFailCountRef = useRef(0);
  const CONNECT_FAIL_THRESHOLD = 3;

  useEffect(() => {
    if (botStatus !== "connected" || !user?.id) return;

    let cancelled = false;
    connectFailCountRef.current = 0;

    const check = async () => {
      const result = await callWClixAPIConnect({ user_id: user.id, action: "status" });
      const gatewayStatus = (result.data as { status?: string })?.status;

      if (!cancelled) {
        if (gatewayStatus === "connected" || gatewayStatus === "connecting") {
          connectFailCountRef.current = 0;
        } else {
          connectFailCountRef.current += 1;
          if (connectFailCountRef.current >= CONNECT_FAIL_THRESHOLD) {
            await supabase
              .from("profiles")
              .update({ bot_status: "created" })
              .eq("id", user.id);
            refetchBotStatus();
            connectFailCountRef.current = 0;
          }
        }
      }
    };

    const interval = setInterval(check, 30000);
    check();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [botStatus, user?.id, refetchBotStatus]);

  const isAlreadyConnected = botStatus === "connected";
  const [showReconnect, setShowReconnect] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [connectStatus, setConnectStatus] = useState<
    "idle" | "qr" | "success" | "error"
  >("idle");
  const [connectError, setConnectError] = useState("");
  const [errorCount, setErrorCount] = useState(0);

  const pollStatus = useCallback(async () => {
    if (!user?.id) return;
    const result = await callWClixAPIConnect({
      user_id: user.id,
      action: "status",
    });
    if (result.data && (result.data as { status: string }).status === "connected") {
      setIsPolling(false);
      setConnectStatus("success");
      await Promise.all([refreshProfile(), refetchBotStatus()]);
    }
  }, [user?.id, refreshProfile, refetchBotStatus]);

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [isPolling, pollStatus]);

  const handleConnect = async () => {
    if (!user?.id) return;
    setIsConnecting(true);
    setConnectStatus("idle");
    setConnectError("");
    setQrCode(null);

    try {
      const result = await callWClixAPIConnect({ user_id: user.id });

      if (result.error) throw new Error(result.error);

      const data = result.data as { status: string; qr?: string };

      if (data.status === "already_connected") {
        setConnectStatus("success");
        await Promise.all([refreshProfile(), refetchBotStatus()]);
      } else if (data.status === "qr_generated" && data.qr) {
        setQrCode(data.qr);
        setConnectStatus("qr");
        setIsPolling(true);
      } else {
        throw new Error(t("connectError"));
      }
    } catch (err) {
      setConnectStatus("error");
      setErrorCount((c) => c + 1);
      setConnectError(
        err instanceof Error ? err.message : t("connectError"),
      );
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {connectStatus === "success" && (
          <SuccessOverlay
            onGoToDashboard={() => navigate("/dashboard")}
            t={t}
          />
        )}
      </AnimatePresence>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-6 pt-4"
      >
        {/* ── Unified Dark Tutorial + Connect Card ── */}
        <motion.div
          key={`card-${errorCount}`}
          variants={fadeUp}
          animate={
            connectStatus === "error"
              ? { x: [0, -8, 8, -6, 6, -3, 3, 0] }
              : undefined
          }
          transition={
            connectStatus === "error"
              ? { duration: 0.5 }
              : undefined
          }
          className="rounded-2xl overflow-hidden shadow-[0_4px_32px_rgba(0,0,0,0.3)]"
          style={{ background: "#111B21" }}
        >
          {/* ── Platform Toggle ── */}
          <div className="flex justify-center gap-2 pt-6 pb-2">
            {(["android", "iphone"] as const).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => handlePlatformChange(p)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  platform === p
                    ? "bg-[#25D366] text-white shadow-[0_2px_12px_rgba(37,211,102,0.35)]"
                    : "bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white"
                }`}
              >
                {t(p === "android" ? "platformAndroid" : "platformIphone")}
              </button>
            ))}
          </div>

          {/* ── Title ── */}
          <div className="text-center px-6 pt-3 pb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {t("connectTitle")}
            </h2>
          </div>

          {/* ── Tutorial Slider ── */}
          <div className="relative px-4 sm:px-8 pb-4">
            {/* Prev Arrow (always visual left) */}
            <button
              type="button"
              onClick={goPrev}
              disabled={tutorialStep <= 0}
              className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Slide Content */}
            <div className="overflow-hidden mx-8 sm:mx-10">
              <AnimatePresence mode="wait" custom={slideDirection}>
                <motion.div
                  key={`${platform}-${tutorialStep}`}
                  custom={slideDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center"
                >
                  {/* Text Column */}
                  <div className="space-y-4 order-2 md:order-1 text-center md:text-start">
                    <p className="text-xs sm:text-sm text-gray-500 font-medium">
                      {t("stepCounter", { current: tutorialStep + 1, total: totalSteps })}
                    </p>
                    <p className="text-base sm:text-lg text-white leading-relaxed">
                      {t(currentStep.textKey)}
                    </p>
                  </div>

                  {/* Image Column */}
                  <div className="flex justify-center order-1 md:order-2">
                    <img
                      src={currentStep.image}
                      alt={t(currentStep.textKey)}
                      className="h-[260px] sm:h-[320px] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] object-contain"
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Next Arrow (always visual right) */}
            <button
              type="button"
              onClick={goNext}
              disabled={tutorialStep >= totalSteps - 1}
              className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* ── Dot Indicators ── */}
          <div className="flex justify-center gap-2 pb-5">
            {steps.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  setSlideDirection(i > tutorialStep ? (isRTL ? -1 : 1) : (isRTL ? 1 : -1));
                  setTutorialStep(i);
                }}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  i === tutorialStep
                    ? "w-6 h-2 bg-[#25D366]"
                    : "w-2 h-2 bg-white/25 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* ── Divider ── */}
          <div className="mx-6 sm:mx-8 border-t border-white/10" />

          {/* ── Connect Actions Area ── */}
          <div className="px-6 sm:px-8 py-6 space-y-4">
            {/* Already connected banner */}
            {(isAlreadyConnected || connectStatus === "success") && !showReconnect && (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 rounded-xl px-5 py-4 text-sm"
                >
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="font-semibold">
                    {connectStatus === "success"
                      ? t("connectSuccess")
                      : t("alreadyConnected")}
                  </span>
                </motion.div>
                <div className="flex gap-3">
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate("/dashboard")}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1fb855] text-white font-bold text-base rounded-xl py-3.5 transition-all duration-300 shadow-[0_4px_20px_rgba(37,211,102,0.3)] cursor-pointer"
                  >
                    {t("gotIt")}
                  </motion.button>
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowReconnect(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-transparent border-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 font-bold text-base rounded-xl py-3.5 transition-all duration-300 cursor-pointer"
                  >
                    {t("reconnect", { defaultValue: "Reconnect" })}
                  </motion.button>
                </div>
              </div>
            )}

            {/* QR Code + Connect flow */}
            {(!isAlreadyConnected || showReconnect) && connectStatus !== "success" && (
              <>
                {/* QR Code display */}
                {connectStatus === "qr" && qrCode && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <p className="text-sm text-gray-400 text-center">
                      {t("scanQrCode")}
                    </p>
                    <div className="bg-white p-4 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
                      <img
                        src={qrCode}
                        alt="WhatsApp QR Code"
                        className="w-64 h-64 object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("waitingForScan")}
                    </div>
                    <button
                      type="button"
                      onClick={handleConnect}
                      className="inline-flex items-center gap-2 text-sm text-[#25D366] hover:text-[#1fb855] font-medium transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {t("refreshQr")}
                    </button>
                  </motion.div>
                )}

                {/* Error feedback */}
                <AnimatePresence>
                  {connectStatus === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-3 bg-red-900/30 border border-red-700/40 text-red-300 rounded-xl px-5 py-3.5 text-sm"
                    >
                      <motion.div
                        animate={{
                          boxShadow: [
                            "0 0 0 0 rgba(239,68,68,0.4)",
                            "0 0 0 10px rgba(239,68,68,0)",
                            "0 0 0 0 rgba(239,68,68,0)",
                          ],
                        }}
                        transition={{ duration: 1, repeat: 1 }}
                        className="rounded-full flex-shrink-0"
                      >
                        <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                      </motion.div>
                      {connectError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action buttons (when not showing QR) */}
                {connectStatus !== "qr" && (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="group flex-1 inline-flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#1fb855] text-white font-bold text-base rounded-xl py-3.5 transition-all duration-300 shadow-[0_4px_20px_rgba(37,211,102,0.3)] hover:shadow-[0_6px_28px_rgba(37,211,102,0.4)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <span className={isConnecting ? "inline-flex items-center gap-3" : "hidden"}>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t("connecting")}
                        </span>
                        <span className={isConnecting ? "hidden" : "inline-flex items-center gap-3"}>
                          {t("getQrCode")}
                          <Wifi className="w-5 h-5 transition-transform group-hover:scale-110" />
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sessionStorage.removeItem("createBot_phase");
                          navigate("/dashboard");
                        }}
                        className="inline-flex items-center justify-center gap-2 border-2 border-white/20 text-gray-400 hover:text-white hover:border-white/40 font-bold text-base rounded-xl px-6 py-3.5 transition-all duration-300 cursor-pointer"
                      >
                        <SkipForward className="w-5 h-5" />
                        {t("skipToDashboard")}
                      </button>
                    </div>
                    <div className="flex justify-center gap-6 text-sm">
                      <button
                        type="button"
                        className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                        onClick={(e) => e.preventDefault()}
                      >
                        {t("linkWithPhone")}
                      </button>
                      <button
                        type="button"
                        className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                        onClick={(e) => e.preventDefault()}
                      >
                        {t("sendQrToClient")}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </>
  );
};

export default ConnectSection;
