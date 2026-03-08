import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  WifiOff,
  Pause,
  Play,
  Power,
  Loader2,
  RefreshCw,
  ChevronDown,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { callWClixAPIConnect } from "@/services/edge-functions";
import ConversationsSection from "./Sections/ConversationsSection";

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

/* ─────────────────────── Status Config ──────────────────────── */

type BotStatusValue = "connected" | "paused" | "disconnected";

function resolveStatus(dbStatus: string | null): BotStatusValue {
  if (dbStatus === "connected") return "connected";
  if (dbStatus === "paused") return "paused";
  return "disconnected";
}

const STATUS_CONFIG: Record<
  BotStatusValue,
  { dot: string; bg: string; border: string; text: string; label: string }
> = {
  connected: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    label: "botConnected",
  },
  paused: {
    dot: "bg-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    label: "botPaused",
  },
  disconnected: {
    dot: "bg-red-400",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-600",
    label: "botDisconnected",
  },
};

/* ─────────────────────── Bot Status Pill ─────────────────────── */

function BotStatusPill({ userId }: { userId: string }) {
  const { t } = useTranslation("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // QR reconnect state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pendingReconnect, setPendingReconnect] = useState(false);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);

  // Query bot_status from profiles
  const {
    data: dbBotStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["dashboard_bot_status", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("bot_status")
        .eq("id", userId)
        .single();
      return data?.bot_status ?? null;
    },
    refetchInterval: 15000,
  });

  const status = resolveStatus(dbBotStatus ?? null);
  const config = STATUS_CONFIG[status];

  // Gateway health-check: poll every 30s to detect if customer disconnected from phone
  // Require 3 consecutive failures (~90s) before overwriting DB to avoid transient blips
  const failCountRef = useRef(0);
  const FAIL_THRESHOLD = 3;

  useEffect(() => {
    if (status !== "connected") return;
    let cancelled = false;
    failCountRef.current = 0;

    const check = async () => {
      const result = await callWClixAPIConnect({ user_id: userId, action: "status" });
      const gw = (result.data as { status?: string })?.status;

      if (!cancelled) {
        if (gw === "connected" || gw === "connecting") {
          failCountRef.current = 0;
        } else {
          failCountRef.current += 1;
          if (failCountRef.current >= FAIL_THRESHOLD) {
            await supabase.from("profiles").update({ bot_status: "created" }).eq("id", userId);
            refetchStatus();
            failCountRef.current = 0;
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
  }, [status, userId, refetchStatus]);

  // Reconnect polling — continues even after QR modal is closed, auto-stops after 2 min
  useEffect(() => {
    if (!pendingReconnect) return;
    let cancelled = false;

    const poll = async () => {
      const result = await callWClixAPIConnect({ user_id: userId, action: "status" });
      const gw = (result.data as { status?: string })?.status;
      // Gateway returns "connected" when WhatsApp session is established
      if (!cancelled && gw === "connected") {
        setPendingReconnect(false);
        setQrCode(null);
        refetchStatus();
        showFeedback("success", t("resumeSuccess"));
      }
    };

    const interval = setInterval(poll, 3000);
    // Auto-stop after 2 minutes
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setPendingReconnect(false);
        setQrCode(null);
      }
    }, 120000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pendingReconnect, userId, refetchStatus, t]);

  const showFeedback = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  // ── Actions ──

  const handlePause = async () => {
    setLoading(true);
    setMenuOpen(false);
    await supabase.from("profiles").update({ bot_status: "paused" }).eq("id", userId);
    await refetchStatus();
    showFeedback("success", t("pauseSuccess"));
    setLoading(false);
  };

  const handleResume = async () => {
    setLoading(true);
    setMenuOpen(false);
    await supabase.from("profiles").update({ bot_status: "connected" }).eq("id", userId);
    await refetchStatus();
    showFeedback("success", t("resumeSuccess"));
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setMenuOpen(false);
    setShowConfirmDisconnect(false);
    await callWClixAPIConnect({ user_id: userId, action: "disconnect" });
    await refetchStatus();
    showFeedback("success", t("disconnectSuccess"));
    setLoading(false);
  };

  const handleReconnect = async () => {
    setMenuOpen(false);

    // If paused, just resume
    if (status === "paused") {
      await handleResume();
      return;
    }

    // If disconnected, start QR flow
    setLoading(true);
    const result = await callWClixAPIConnect({ user_id: userId });
    const data = result.data as { status?: string; qr?: string } | null;

    if (data?.status === "already_connected") {
      await supabase.from("profiles").update({ bot_status: "connected" }).eq("id", userId);
      await refetchStatus();
      showFeedback("success", t("resumeSuccess"));
    } else if (data?.qr) {
      setQrCode(data.qr);
      setPendingReconnect(true);
    }
    setLoading(false);
  };

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    const timer = setTimeout(() => document.addEventListener("click", handler), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handler);
    };
  }, [menuOpen]);

  return (
    <motion.div variants={fadeUp} className="relative shrink-0">
      {/* ── Main pill ── */}
      <button
        onClick={() => { if (!qrCode && !pendingReconnect) setMenuOpen((o) => !o); }}
        disabled={loading}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border ${
          pendingReconnect && !qrCode ? "border-blue-200 bg-blue-50" : `${config.border} ${config.bg}`
        } shadow-sm cursor-pointer transition-all hover:shadow-md disabled:opacity-60`}
      >
        {loading || (pendingReconnect && !qrCode) ? (
          <Loader2 className={`w-4 h-4 animate-spin ${pendingReconnect && !qrCode ? "text-blue-500" : "text-[#7A7267]"}`} />
        ) : (
          <span className="relative flex h-2.5 w-2.5">
            {status === "connected" && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dot}`} />
          </span>
        )}
        <span className={`text-xs font-bold uppercase tracking-wider ${
          pendingReconnect && !qrCode ? "text-blue-600" : config.text
        }`}>
          {pendingReconnect && !qrCode ? t("connecting") : t(config.label)}
        </span>
        {!qrCode && !pendingReconnect && <ChevronDown className={`w-3.5 h-3.5 ${config.text} transition-transform ${menuOpen ? "rotate-180" : ""}`} />}
      </button>

      {/* ── Dropdown menu ── */}
      <AnimatePresence>
        {menuOpen && !qrCode && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-full mt-2 z-50 bg-white rounded-xl shadow-[0_8px_32px_rgba(45,42,38,0.12)] border border-[#EDE6DD]/50 overflow-hidden min-w-[180px]"
          >
            {status === "connected" && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePause(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#4A4640] hover:bg-amber-50 transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4 text-amber-500" />
                {t("pauseBot")}
              </button>
            )}

            {status === "paused" && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleResume(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#4A4640] hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-500" />
                  {t("resumeBot")}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowConfirmDisconnect(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  {t("disconnectBot")}
                </button>
              </>
            )}

            {status === "disconnected" && (
              <button
                onClick={(e) => { e.stopPropagation(); handleReconnect(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#4A4640] hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <Wifi className="w-4 h-4 text-emerald-500" />
                {t("reconnectBot")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Disconnect confirmation dialog ── */}
      <AnimatePresence>
        {showConfirmDisconnect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setShowConfirmDisconnect(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-[#2D2A26]">{t("disconnectBot")}</h3>
              </div>
              <p className="text-sm text-[#7A7267]">{t("disconnectConfirm")}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmDisconnect(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#EDE6DD] text-sm font-medium text-[#7A7267] hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors cursor-pointer"
                >
                  {t("disconnectBot")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QR Code reconnect overlay ── */}
      <AnimatePresence>
        {qrCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={() => setQrCode(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#2D2A26]">{t("reconnectBot")}</h3>
                <button
                  onClick={() => setQrCode(null)}
                  className="p-1 rounded-lg hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-[#7A7267]" />
                </button>
              </div>
              <p className="text-sm text-[#7A7267]">{t("scanToReconnect")}</p>
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-xl shadow-[0_4px_24px_rgba(45,42,38,0.08)] border border-[#EDE6DD]/50">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-[#A39B90]">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("waitingForScan")}
              </div>
              <button
                onClick={handleReconnect}
                className="w-full inline-flex items-center justify-center gap-2 text-sm text-[#FF7E47] hover:text-[#E86B38] font-medium transition-colors cursor-pointer py-2"
              >
                <RefreshCw className="w-4 h-4" />
                {t("refreshQr")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Feedback toast ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`absolute end-0 top-full mt-2 z-40 px-4 py-2 rounded-xl text-xs font-medium shadow-md whitespace-nowrap ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {feedback.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

export default function DashboardPage() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();

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

        {/* Bot Status */}
        {user?.id && <BotStatusPill userId={user.id} />}
      </div>

      {/* ── Conversations (full width) ── */}
      <motion.div variants={fadeUp}>
        <ConversationsSection />
      </motion.div>
    </motion.div>
  );
}
