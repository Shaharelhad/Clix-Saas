import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Phone,
  ArrowLeft,
  RotateCcw,
  AlertTriangle,
  MoreVertical,
  Archive,
} from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/types/database";

/* ─────────────────────────── Types ─────────────────────────── */

type Session = Pick<
  Tables<"subscriber_sessions">,
  "id" | "phone" | "status" | "last_message_at" | "created_at"
>;

type Message = Pick<
  Tables<"flow_message_log">,
  "id" | "direction" | "content" | "message_type" | "created_at"
>;

/* ─────────────────────── Animation config ──────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

/* ─────────────────────── Helpers ──────────────────────────── */

function relativeTime(dateStr: string | null) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function formatPhone(phone: string) {
  const clean = phone.replace(/\D/g, "");
  if (clean.length >= 12 && clean.startsWith("972")) {
    return `+${clean.slice(0, 3)}-${clean.slice(3, 5)}-${clean.slice(5, 8)}-${clean.slice(8)}`;
  }
  if (clean.length >= 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Last 2 digits of a phone number, used for the avatar tile. */
function avatarDigits(phone: string) {
  const clean = phone.replace(/\D/g, "");
  return clean.slice(-2) || "??";
}

/* ─────────────────────── Message Bubble ────────────────────── */

function MessageBubble({ msg }: { msg: Message }) {
  // "inbound" = customer → us (rendered on the start side, dark)
  // "outbound" = bot → customer (rendered on the end side, white)
  const isInbound = msg.direction === "inbound";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`max-w-[70%] ${isInbound ? "self-start" : "self-end"}`}
    >
      <div
        className={
          isInbound
            ? "bg-zinc-900 text-white px-3.5 py-2 rounded-[20px] rounded-ss-none shadow-md"
            : "bg-white border border-[#f3f0e6] text-zinc-800 px-3.5 py-2 rounded-[20px] rounded-ee-none shadow-sm"
        }
      >
        {(msg.message_type === "buttons" || msg.message_type === "image") && (
          <span
            className={`text-[9px] font-bold uppercase tracking-wider block mb-0.5 ${
              isInbound ? "text-white/60" : "text-[var(--brand-primary)]/60"
            }`}
          >
            [{msg.message_type === "buttons" ? "BUTTONS SENT" : "IMAGE SENT"}]
          </span>
        )}
        <p className="text-[13px] leading-snug whitespace-pre-wrap">{msg.content ?? ""}</p>
      </div>
      <span
        className={`text-[9px] text-zinc-400 mt-0.5 block px-1 ${
          isInbound ? "text-end" : "text-start"
        }`}
      >
        {formatTime(msg.created_at)}
      </span>
    </motion.div>
  );
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

export default function ConversationsSection() {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const chatMenuTriggerRef = useRef<HTMLButtonElement>(null);

  // Close chat menu on click outside
  useEffect(() => {
    if (!chatMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (chatMenuTriggerRef.current?.contains(e.target as Node)) return;
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node))
        setChatMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [chatMenuOpen]);

  // Close chat menu on Escape
  useEffect(() => {
    if (!chatMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [chatMenuOpen]);

  /* ── Query: user's active_flow_id ── */
  const { data: workflowId } = useQuery({
    queryKey: ["user_workflow_id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("active_flow_id")
        .eq("id", user.id)
        .single();
      return data?.active_flow_id ?? null;
    },
    enabled: !!user?.id,
  });

  /* ── Query: active sessions ── */
  const { data: sessions = [] } = useQuery({
    queryKey: ["active_sessions", workflowId],
    queryFn: async () => {
      if (!workflowId) return [];
      const { data } = await supabase
        .from("subscriber_sessions")
        .select("id, phone, status, last_message_at, created_at")
        .eq("workflow_id", workflowId)
        .is("archived_at", null)
        .order("last_message_at", { ascending: false });
      return (data ?? []) as Session[];
    },
    enabled: !!workflowId,
    refetchInterval: 15_000,
  });

  const effectiveSelectedId =
    selectedId ?? (sessions.length > 0 ? sessions[0].id : null);

  /* ── Query: messages for selected session ── */
  const { data: messages = [] } = useQuery({
    queryKey: ["session_messages", effectiveSelectedId],
    queryFn: async () => {
      if (!effectiveSelectedId) return [];
      const { data } = await supabase
        .from("flow_message_log")
        .select("id, direction, content, message_type, created_at")
        .eq("session_id", effectiveSelectedId)
        .not("message_type", "in", "(api_call,api_call_error)")
        .order("created_at", { ascending: false })
        .limit(100);
      return ((data ?? []) as Message[]).reverse();
    },
    enabled: !!effectiveSelectedId,
    refetchInterval: 5_000,
  });

  /* ── Auto-scroll messages (within container only) ── */
  useEffect(() => {
    const c = messagesContainerRef.current;
    if (c) c.scrollTop = c.scrollHeight;
  }, [messages]);

  const selectedSession = sessions.find((s) => s.id === effectiveSelectedId);

  /* ── Reset session handler ── */
  const handleResetSession = async () => {
    if (!effectiveSelectedId) return;
    setResetting(true);
    try {
      const { error } = await supabase.rpc("reset_conversation_session" as never, {
        p_session_id: effectiveSelectedId,
      } as never);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["active_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session_messages", effectiveSelectedId] });
    } catch (err) {
      console.error("Reset session error:", err);
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  };

  /* ── Archive session handler — soft-hides the session from active chats.
        flow-webhook clears archived_at on next inbound message, so it auto-restores. */
  const handleArchiveSession = async () => {
    if (!effectiveSelectedId) return;
    setArchiving(true);
    try {
      const { error } = await supabase.rpc("archive_conversation_session" as never, {
        p_session_id: effectiveSelectedId,
      } as never);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["active_sessions"] });
      setSelectedId(null);
    } catch (err) {
      console.error("Archive session error:", err);
    } finally {
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  };

  /* ═══════════════════════ RENDER ═══════════════════════════ */

  return (
    <motion.div variants={fadeUp} className="flex flex-col flex-1 min-h-0">
      {/* Section Header (lifted from inner card per design) */}
      <div className="flex items-center gap-2.5 mb-3 shrink-0">
        <span
          className="bg-[var(--brand-primary)] text-white text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {sessions.length}
        </span>
        <h3
          className="text-[20px] font-semibold text-zinc-900 tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {t("conversationsTitle")}
        </h3>
      </div>

      {/* Bento layout: chat-window first → start side (right in RTL, near the
          sidebar); contacts second → end side (left in RTL). Matches the
          Stitch design. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 flex-1 min-h-0">
        {/* ── Chat Window (col-span-8) ── */}
        <div className="lg:col-span-8 bg-white rounded-[28px] shadow-[0_40px_80px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden border border-zinc-100 min-h-0">
          {/* Chat Header */}
          {selectedSession ? (
            <div className="px-4 sm:px-5 py-3 border-b border-zinc-50 flex items-center justify-between bg-zinc-50/30 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden p-1 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 text-zinc-500 rtl:rotate-180" />
                </button>
                <div className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center text-white font-bold text-xs">
                  {avatarDigits(selectedSession.phone)}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-bold text-zinc-900 truncate"
                    style={{ fontFamily: "var(--font-display)" }}
                    dir="ltr"
                  >
                    {formatPhone(selectedSession.phone)}
                  </p>
                </div>
              </div>
              <div className="relative">
                <button
                  ref={chatMenuTriggerRef}
                  type="button"
                  onClick={() => setChatMenuOpen((o) => !o)}
                  className="p-1.5 hover:bg-zinc-100 rounded-full text-zinc-400 transition-colors"
                  aria-label="More"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
                <AnimatePresence>
                  {chatMenuOpen && (
                    <motion.div
                      ref={chatMenuRef}
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute end-0 top-full mt-2 z-30 bg-white rounded-xl shadow-[0_8px_32px_rgba(45,42,38,0.12)] border border-[#EDE6DD]/50 overflow-hidden min-w-[200px]"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setChatMenuOpen(false);
                          setShowResetConfirm(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#4A4640] hover:bg-red-50 hover:text-red-500 transition-colors text-start"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {t("resetSession")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChatMenuOpen(false);
                          setShowArchiveConfirm(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#4A4640] hover:bg-zinc-50 transition-colors text-start"
                      >
                        <Archive className="w-4 h-4" />
                        {t("archiveSession")}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-5 py-3 border-b border-zinc-50 bg-zinc-50/30 shrink-0">
              <p className="text-sm font-bold text-zinc-400">
                {t("conversationsSelectPrompt")}
              </p>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-2.5 min-h-0"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#E5DDD3 transparent" }}
          >
            {!effectiveSelectedId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mb-3">
                  <MessageSquare className="w-7 h-7 text-zinc-300" />
                </div>
                <p className="text-sm text-zinc-400">
                  {t("conversationsSelectPrompt")}
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <p className="text-sm text-zinc-400">{t("noMessages")}</p>
              </div>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
            )}
          </div>
        </div>

        {/* ── Contacts Panel (col-span-4) ── */}
        <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
          <div className="bg-white rounded-[28px] p-4 sm:p-5 shadow-[0_40px_80px_rgba(0,0,0,0.04)] border border-zinc-100 flex-1 flex flex-col min-h-0">
            <div className="mb-3 shrink-0">
              <h4
                className="text-[13px] font-semibold uppercase tracking-widest text-zinc-400"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {t("contactsTitle")}
              </h4>
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto -mx-1.5 px-1.5 space-y-1.5"
              style={{ scrollbarWidth: "thin", scrollbarColor: "#E5DDD3 transparent" }}
            >
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-4 py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex items-center justify-center mb-3">
                    <Phone className="w-5 h-5 text-zinc-300" />
                  </div>
                  <p className="text-sm text-zinc-400 font-medium">
                    {t("conversationsEmpty")}
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {sessions.map((session) => {
                    const isActive = effectiveSelectedId === session.id;
                    return (
                      <motion.button
                        type="button"
                        key={session.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        onClick={() => setSelectedId(session.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors text-start ${
                          isActive
                            ? "bg-[rgba(var(--brand-primary-rgb),0.05)] border border-[rgba(var(--brand-primary-rgb),0.1)]"
                            : "hover:bg-zinc-50 border border-transparent"
                        }`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 ${
                            isActive
                              ? "bg-zinc-900 text-white"
                              : "bg-zinc-200 text-zinc-600"
                          }`}
                        >
                          {avatarDigits(session.phone)}
                        </div>
                        <div className="flex-1 min-w-0 text-start">
                          <p
                            className="font-bold text-zinc-900 truncate text-[13px]"
                            style={{ fontFamily: "var(--font-display)" }}
                            dir="ltr"
                          >
                            {formatPhone(session.phone)}
                          </p>
                        </div>
                        <div className="text-end flex flex-col items-end gap-0.5 shrink-0">
                          <span className="text-[10px] font-bold text-zinc-400">
                            {relativeTime(session.last_message_at)}
                          </span>
                          <Phone className="w-3.5 h-3.5 text-zinc-300" />
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
            onClick={() => setShowResetConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-base font-bold text-[#2D2A26]">
                  {t("resetSession")}
                </h3>
              </div>
              <p className="text-sm text-[#7A7267]">{t("resetSessionConfirm")}</p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#EDE6DD] text-sm font-semibold text-[#7A7267] hover:bg-[#FAF7F3] transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleResetSession}
                  disabled={resetting}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {resetting ? "..." : t("resetSessionAction")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archive Confirmation Modal */}
      <AnimatePresence>
        {showArchiveConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4"
            onClick={() => setShowArchiveConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Archive className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="text-base font-bold text-[#2D2A26]">
                  {t("archiveSession")}
                </h3>
              </div>
              <p className="text-sm text-[#7A7267]">{t("archiveSessionConfirm")}</p>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#EDE6DD] text-sm font-semibold text-[#7A7267] hover:bg-[#FAF7F3] transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleArchiveSession}
                  disabled={archiving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  {archiving ? "..." : t("archiveSessionAction")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
