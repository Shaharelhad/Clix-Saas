import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { callWClixAPIConnect } from "@/services/edge-functions";

const EASE = [0.22, 1, 0.36, 1] as const;

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

/* ── Props ── */
interface WhatsAppConnectModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onConnected?: () => void;
}

export default function WhatsAppConnectModal({
  open,
  onClose,
  userId,
  onConnected,
}: WhatsAppConnectModalProps) {
  const { t, i18n } = useTranslation(["createBot", "dashboard"]);
  const isRTL = i18n.language === "he";

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

  /* ── QR connect state ── */
  const [isConnecting, setIsConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [connectStatus, setConnectStatus] = useState<"idle" | "qr" | "success" | "error">("idle");
  const [connectError, setConnectError] = useState("");
  const [errorCount, setErrorCount] = useState(0);

  /* ── Reset state when modal closes ── */
  useEffect(() => {
    if (!open) {
      setQrCode(null);
      setIsPolling(false);
      setConnectStatus("idle");
      setConnectError("");
      setIsConnecting(false);
      setErrorCount(0);
      setTutorialStep(0);
      setSlideDirection(0);
    }
  }, [open]);

  /* ── Poll for connection status ── */
  const pollStatus = useCallback(async () => {
    if (!userId) return;
    const result = await callWClixAPIConnect({ user_id: userId, action: "status" });
    if (result.data && (result.data as { status: string }).status === "connected") {
      setIsPolling(false);
      setConnectStatus("success");
      onConnected?.();
    }
  }, [userId, onConnected]);

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [isPolling, pollStatus]);

  // Auto-stop polling after 2 minutes
  useEffect(() => {
    if (!isPolling) return;
    const timeout = setTimeout(() => {
      setIsPolling(false);
      setQrCode(null);
    }, 120000);
    return () => clearTimeout(timeout);
  }, [isPolling]);

  /* ── Connect handler ── */
  const handleConnect = async () => {
    if (!userId) return;
    setIsConnecting(true);
    setConnectStatus("idle");
    setConnectError("");
    setQrCode(null);

    try {
      const result = await callWClixAPIConnect({ user_id: userId });
      if (result.error) throw new Error(result.error);

      const data = result.data as { status: string; qr?: string };

      if (data.status === "already_connected") {
        setConnectStatus("success");
        onConnected?.();
      } else if (data.status === "qr_generated" && data.qr) {
        setQrCode(data.qr);
        setConnectStatus("qr");
        setIsPolling(true);
      } else {
        throw new Error(t("createBot:connectError"));
      }
    } catch (err) {
      setConnectStatus("error");
      setErrorCount((c) => c + 1);
      setConnectError(err instanceof Error ? err.message : t("createBot:connectError"));
    } finally {
      setIsConnecting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto rounded-2xl shadow-[0_4px_32px_rgba(0,0,0,0.3)]"
          style={{ background: "#111B21" }}
        >
          {/* ── Close button ── */}
          <div className="flex justify-end px-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* ── Success state ── */}
          {connectStatus === "success" ? (
            <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-2">
              <div className="w-16 h-16 rounded-full bg-emerald-900/40 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">
                  {t("createBot:connectSuccessTitle")}
                </h3>
                <p className="text-sm text-gray-400">
                  {t("createBot:connectSuccessSubtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1fb855] text-white font-bold text-base rounded-xl px-8 py-3 transition-all duration-300 shadow-[0_4px_20px_rgba(37,211,102,0.3)] cursor-pointer"
              >
                {t("createBot:gotIt")}
              </button>
            </div>
          ) : (
            <>
              {/* ── Platform Toggle ── */}
              <div className="flex justify-center gap-2 pb-2">
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
                    {t(`createBot:${p === "android" ? "platformAndroid" : "platformIphone"}`)}
                  </button>
                ))}
              </div>

              {/* ── Title ── */}
              <div className="text-center px-6 pt-3 pb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {t("createBot:connectTitle")}
                </h2>
              </div>

              {/* ── Tutorial Slider ── */}
              <div className="relative px-4 sm:px-8 pb-4">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={tutorialStep <= 0}
                  className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

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
                      <div className="space-y-4 order-2 md:order-1 text-center md:text-start">
                        <p className="text-xs sm:text-sm text-gray-500 font-medium">
                          {t("createBot:stepCounter", { current: tutorialStep + 1, total: totalSteps })}
                        </p>
                        <p className="text-base sm:text-lg text-white leading-relaxed">
                          {t(`createBot:${currentStep.textKey}`)}
                        </p>
                      </div>
                      <div className="flex justify-center order-1 md:order-2">
                        <img
                          src={currentStep.image}
                          alt={t(`createBot:${currentStep.textKey}`)}
                          className="h-[220px] sm:h-[280px] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] object-contain"
                        />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

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

              {/* ── Connect Actions ── */}
              <div
                key={`actions-${errorCount}`}
                className="px-6 sm:px-8 py-6 space-y-4"
              >
                {/* QR Code display */}
                {connectStatus === "qr" && qrCode && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <p className="text-sm text-gray-400 text-center">
                      {t("createBot:scanQrCode")}
                    </p>
                    <div className="bg-white p-4 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
                      <img
                        src={qrCode}
                        alt="WhatsApp QR Code"
                        className="w-56 h-56 object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("createBot:waitingForScan")}
                    </div>
                    <button
                      type="button"
                      onClick={handleConnect}
                      className="inline-flex items-center gap-2 text-sm text-[#25D366] hover:text-[#1fb855] font-medium transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      {t("createBot:refreshQr")}
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
                      <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                      {connectError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action button (when not showing QR) */}
                {connectStatus !== "qr" && (
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="group w-full inline-flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#1fb855] text-white font-bold text-base rounded-xl py-3.5 transition-all duration-300 shadow-[0_4px_20px_rgba(37,211,102,0.3)] hover:shadow-[0_6px_28px_rgba(37,211,102,0.4)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span className={isConnecting ? "inline-flex items-center gap-3" : "hidden"}>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t("createBot:connecting")}
                    </span>
                    <span className={isConnecting ? "hidden" : "inline-flex items-center gap-3"}>
                      {t("createBot:getQrCode")}
                      <Wifi className="w-5 h-5 transition-transform group-hover:scale-110" />
                    </span>
                  </button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
