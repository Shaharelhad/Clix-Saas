import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Wifi,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { callWClixAPIConnect } from "@/services/webhooks";
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
  const { t } = useTranslation("createBot");
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

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

  // Poll session status when QR is shown
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
        {/* ── Tutorial Card ── */}
        <motion.div
          variants={fadeUp}
          className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50"
        >
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
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── WhatsApp Connect Card ── */}
        <motion.div
          key={`credentials-${errorCount}`}
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
          className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50"
        >
          {/* Title */}
          <div className="px-6 sm:px-8 pt-8 pb-2">
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-[#2D2A26] text-center">
                {t("connectWhatsApp")}
              </h2>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF7E47] to-[#E86B38] flex items-center justify-center flex-shrink-0 shadow-[0_2px_10px_rgba(255,126,71,0.3)]">
                <Wifi className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          {/* Already connected banner */}
          {(isAlreadyConnected || connectStatus === "success") && !showReconnect && (
            <div className="px-6 sm:px-8 py-6 space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-4 text-sm"
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/dashboard")}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-base rounded-2xl py-4 transition-all duration-300 shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)] cursor-pointer"
                >
                  {t("gotIt", { defaultValue: "Continue" })}
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowReconnect(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-white border-2 border-[#FF7E47] text-[#FF7E47] hover:bg-[#FFF5F0] font-bold text-base rounded-2xl py-4 transition-all duration-300 cursor-pointer"
                >
                  {t("reconnect", { defaultValue: "Reconnect" })}
                </motion.button>
              </div>
            </div>
          )}

          {/* QR Code + Connect flow — shown when not connected or reconnecting */}
          {(!isAlreadyConnected || showReconnect) && connectStatus !== "success" && (
            <>
              <div className="px-6 sm:px-8 py-8">
                <div className="max-w-md mx-auto space-y-6">
                  {/* QR Code display */}
                  {connectStatus === "qr" && qrCode && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <p className="text-sm text-[#7A7267] text-center">
                        {t("scanQrCode")}
                      </p>
                      <div className="bg-white p-4 rounded-2xl shadow-[0_4px_24px_rgba(45,42,38,0.08)] border border-[#EDE6DD]/50">
                        <img
                          src={qrCode}
                          alt="WhatsApp QR Code"
                          className="w-64 h-64 object-contain"
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#A39B90]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t("waitingForScan")}
                      </div>
                      <button
                        onClick={handleConnect}
                        className="inline-flex items-center gap-2 text-sm text-[#FF7E47] hover:text-[#E86B38] font-medium transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t("refreshQr", { defaultValue: "Refresh QR Code" })}
                      </button>
                    </motion.div>
                  )}

                  {/* Initial state — show connect button */}
                  {connectStatus !== "qr" && (
                    <motion.div variants={fadeUp} className="text-center">
                      <p className="text-sm text-[#7A7267] mb-4">
                        {t("connectDescription")}
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Error feedback */}
              <AnimatePresence>
                {connectStatus === "error" && (
                  <div className="px-6 sm:px-8 pb-2">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3.5 text-sm"
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
                  </div>
                )}
              </AnimatePresence>

              {/* Connect Button (only shown when not showing QR) */}
              {connectStatus !== "qr" && (
                <div className="px-6 sm:px-8 pb-8">
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="group w-full inline-flex items-center justify-center gap-3 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-base rounded-2xl py-4 transition-all duration-300 shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
                  >
                    <span className={isConnecting ? "inline-flex items-center gap-3" : "hidden"}>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t("connecting")}
                    </span>
                    <span className={isConnecting ? "hidden" : "inline-flex items-center gap-3"}>
                      {t("connectBot")}
                      <Wifi className="w-5 h-5 transition-transform group-hover:scale-110" />
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </>
  );
};

export default ConnectSection;
