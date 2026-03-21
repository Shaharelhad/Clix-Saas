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
  ChevronDown,
  ShieldBan,
  BookOpen,
  Phone,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { callWClixAPIConnect } from "@/services/edge-functions";
import ConversationsSection from "./Sections/ConversationsSection";
import BlockedNumbersModal from "./Sections/BlockedNumbersModal";
import WhatsAppConnectModal from "@/components/WhatsAppConnectModal";

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

  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);

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

  // Gateway health-check: poll every 15s to detect if customer disconnected from phone
  // Require 2 consecutive failures (~30s) before overwriting DB to avoid transient blips
  const failCountRef = useRef(0);
  const FAIL_THRESHOLD = 2;

  useEffect(() => {
    if (status !== "connected" && status !== "paused") return;
    if (status === "paused") return; // Don't health-check while paused
    let cancelled = false;
    failCountRef.current = 0;

    const check = async () => {
      const result = await callWClixAPIConnect({ user_id: userId, action: "status" });
      const gwData = result.data as { status?: string; phoneNumber?: string };
      const gw = gwData?.status;

      // Capture connected phone number from gateway
      if (gwData?.phoneNumber) setConnectedPhone(gwData.phoneNumber);
      else if (gw !== "connected" && gw !== "connecting") setConnectedPhone(null);

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

    const interval = setInterval(check, 15000);
    check();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, userId, refetchStatus]);


  const showFeedback = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  // ── Actions ──

  const handlePause = async () => {
    setLoading(true);
    setMenuOpen(false);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ bot_status: "paused" })
        .eq("id", userId);
      if (error) {
        showFeedback("error", t("pauseError"));
        setLoading(false);
        return;
      }
      await refetchStatus();
      showFeedback("success", t("pauseSuccess"));
    } catch {
      showFeedback("error", t("pauseError"));
    }
    setLoading(false);
  };

  const handleResume = async () => {
    setLoading(true);
    setMenuOpen(false);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ bot_status: "connected" })
        .eq("id", userId);
      if (error) {
        showFeedback("error", t("resumeError"));
        setLoading(false);
        return;
      }
      await refetchStatus();
      showFeedback("success", t("resumeSuccess"));
    } catch {
      showFeedback("error", t("resumeError"));
    }
    setLoading(false);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    setMenuOpen(false);
    setShowConfirmDisconnect(false);
    try {
      const result = await callWClixAPIConnect({ user_id: userId, action: "disconnect" });
      if (result.error) {
        showFeedback("error", t("disconnectError"));
        setLoading(false);
        return;
      }
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ bot_status: "created" })
        .eq("id", userId);
      if (dbError) {
        showFeedback("error", t("disconnectError"));
        setLoading(false);
        return;
      }
      await refetchStatus();
      setConnectedPhone(null);
      showFeedback("success", t("disconnectSuccess"));
    } catch {
      showFeedback("error", t("disconnectError"));
    }
    setLoading(false);
  };

  const handleReconnect = async () => {
    setMenuOpen(false);

    // If paused, just resume
    if (status === "paused") {
      await handleResume();
      return;
    }

    // If disconnected, open the connect modal
    setConnectModalOpen(true);
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
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={loading}
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border ${config.border} ${config.bg} shadow-sm cursor-pointer transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-60`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#7A7267]" />
        ) : (
          <span className="relative flex h-2.5 w-2.5">
            {status === "connected" && (
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dot}`} />
          </span>
        )}
        <span className={`text-xs font-bold uppercase tracking-wider ${config.text}`}>
          {t(config.label)}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 ${config.text} transition-transform ${menuOpen ? "rotate-180" : ""}`} />
      </button>

      {/* ── Dropdown menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute end-0 top-full mt-2 z-50 bg-white rounded-xl shadow-[0_8px_32px_rgba(45,42,38,0.12)] border border-[#EDE6DD]/50 overflow-hidden min-w-[180px]"
          >
            {status === "connected" && (
              <>
                {connectedPhone && (
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-[#EDE6DD]/50">
                    <Phone className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium text-[#2D2A26] direction-ltr" dir="ltr">
                      +{connectedPhone}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePause(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#4A4640] hover:bg-amber-50 transition-colors cursor-pointer"
                >
                  <Pause className="w-4 h-4 text-amber-500" />
                  {t("pauseBot")}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowConfirmDisconnect(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  {t("disconnectBot")}
                </button>
              </>
            )}

            {status === "paused" && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleResume(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#4A4640] hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 text-emerald-500" />
                  {t("resumeBot")}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowConfirmDisconnect(true); setMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  {t("disconnectBot")}
                </button>
              </>
            )}

            {status === "disconnected" && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReconnect(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#4A4640] hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <Wifi className="w-4 h-4 text-emerald-500" />
                  {t("reconnectBot")}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setConnectModalOpen(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#4A4640] hover:bg-blue-50 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  {t("connectTutorial")}
                </button>
              </>
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
                  type="button"
                  onClick={() => setShowConfirmDisconnect(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#EDE6DD] text-sm font-medium text-[#7A7267] hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
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

      {/* ── WhatsApp Connect Modal ── */}
      <WhatsAppConnectModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        userId={userId}
        onConnected={() => {
          refetchStatus();
          setConnectModalOpen(false);
          showFeedback("success", t("resumeSuccess"));
        }}
      />

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
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);

  // Fetch blocked numbers (shared cache with modal)
  const { data: blockedNumbers = [] } = useQuery({
    queryKey: ["blocked_numbers", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("blocked_numbers")
        .eq("id", user!.id)
        .single();
      const raw = data?.blocked_numbers;
      return Array.isArray(raw) ? (raw as string[]) : [];
    },
    enabled: !!user?.id,
  });
  const blockedCount = blockedNumbers.length;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="px-3 py-5 sm:px-5 sm:py-5 md:p-8 max-w-7xl mx-auto"
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

        {/* Bot Status + Blocked Numbers */}
        {user?.id && (
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBlockedModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-[#EDE6DD] bg-white shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-[#D5CEC5]"
            >
              <ShieldBan className="w-4 h-4 text-[#7A7267]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#7A7267]">
                {t("blockedNumbers")}
              </span>
              {blockedCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
                  {blockedCount}
                </span>
              )}
            </button>
            <BotStatusPill userId={user.id} />
          </motion.div>
        )}
      </div>

      {/* ── Conversations (full width) ── */}
      <motion.div variants={fadeUp}>
        <ConversationsSection />
      </motion.div>

      {/* ── Blocked Numbers Modal ── */}
      {user?.id && (
        <BlockedNumbersModal
          open={blockedModalOpen}
          onClose={() => setBlockedModalOpen(false)}
          userId={user.id}
        />
      )}
    </motion.div>
  );
}
