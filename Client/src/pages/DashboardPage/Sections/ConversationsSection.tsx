import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Phone,
  Clock,
  ArrowLeft,
  MessageCircle,
  Users,
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
  return `${days}d`;
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

/* ─────────────────────── Message Bubble ────────────────────── */

function MessageBubble({ msg }: { msg: Message }) {
  const isInbound = msg.direction === "inbound";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
      className={`max-w-[80%] ${isInbound ? "self-start" : "self-end"}`}
    >
      <div
        className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
          isInbound
            ? "bg-white border border-[#EDE6DD]/60 text-[#2D2A26] rounded-ss-sm"
            : "bg-[#2D2A26] text-white rounded-ee-sm"
        }`}
      >
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
          {msg.content ?? ""}
        </p>
      </div>
      <span
        className={`text-[10px] text-[#B8AFA4] mt-0.5 block px-1 ${
          isInbound ? "text-start" : "text-end"
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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
        .order("created_at", { ascending: true })
        .limit(100);
      return (data ?? []) as Message[];
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

  /* ═══════════════════════ RENDER ═══════════════════════════ */

  return (
    <motion.div variants={fadeUp} className="flex flex-col">
      {/* Section Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-[#FF7E47]/10 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-[#FF7E47]" />
        </div>
        <h2 className="text-base font-bold text-[#2D2A26]">
          {t("conversationsTitle")}
        </h2>
        {sessions.length > 0 && (
          <span className="text-[11px] font-semibold text-[#A39B90] bg-[#FAF7F3] px-2 py-0.5 rounded-full">
            {sessions.length}
          </span>
        )}
      </div>

      {/* Master-Detail Card */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_28px_rgba(45,42,38,0.06)] border border-[#EDE6DD]/50 flex flex-col lg:flex-row min-h-[420px] max-h-[520px]">
        {/* ── Left Panel: Session List ── */}
        <div className="lg:w-[280px] w-full border-b lg:border-b-0 lg:border-e border-[#EDE6DD]/50 flex flex-col shrink-0">
          {/* List Header */}
          <div className="px-4 py-3 border-b border-[#EDE6DD]/40 bg-[#FDFBF8]">
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#A39B90] uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              {t("phoneLabel")}
            </div>
          </div>

          {/* Session Items */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: "thin", scrollbarColor: "#E5DDD3 transparent" }}
          >
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-4 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#FAF7F3] flex items-center justify-center mb-3">
                  <MessageCircle className="w-5 h-5 text-[#B8AFA4]" />
                </div>
                <p className="text-sm text-[#A39B90] font-medium">
                  {t("conversationsEmpty")}
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {sessions.map((session) => (
                  <motion.button
                    key={session.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    onClick={() => setSelectedId(session.id)}
                    className={`w-full text-start px-4 py-3.5 transition-all duration-200 border-b border-[#EDE6DD]/30 cursor-pointer group ${
                      effectiveSelectedId === session.id
                        ? "bg-[#FF7E47]/[0.06] border-s-2 border-s-[#FF7E47]"
                        : "hover:bg-[#FAF7F3]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#A39B90] group-hover:text-[#FF7E47] transition-colors" />
                        <span className="text-[13px] font-bold text-[#2D2A26] tracking-tight font-mono">
                          {formatPhone(session.phone)}
                        </span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] text-[#B8AFA4]">
                      <Clock className="w-2.5 h-2.5" />
                      {relativeTime(session.last_message_at)}
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ── Right Panel: Message History ── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Chat Header */}
          {selectedSession ? (
            <div className="px-4 sm:px-5 py-3 border-b border-[#EDE6DD]/40 bg-[#FDFBF8] flex items-center gap-3 shrink-0">
              <button
                onClick={() => setSelectedId(null)}
                className="lg:hidden p-1 rounded-lg hover:bg-[#FAF7F3] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-[#7A7267] rtl:rotate-180" />
              </button>
              <div className="w-8 h-8 rounded-full bg-[#2D2A26] flex items-center justify-center">
                <Phone className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#2D2A26] font-mono truncate">
                  {formatPhone(selectedSession.phone)}
                </p>
                <span className="text-[10px] text-[#B8AFA4]">
                  {relativeTime(selectedSession.last_message_at)}
                </span>
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-5 py-3 border-b border-[#EDE6DD]/40 bg-[#FDFBF8] shrink-0">
              <p className="text-[13px] font-bold text-[#A39B90]">
                {t("conversationsSelectPrompt")}
              </p>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 px-4 sm:px-5 py-4 overflow-y-auto flex flex-col gap-2"
            style={{
              background:
                "linear-gradient(180deg, #FDFBF8 0%, #FAF7F3 100%)",
              scrollbarWidth: "thin",
              scrollbarColor: "#E5DDD3 transparent",
            }}
          >
            {!effectiveSelectedId ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#FAF7F3] border border-[#EDE6DD]/50 flex items-center justify-center mb-3">
                  <MessageSquare className="w-7 h-7 text-[#C8C0B6]" />
                </div>
                <p className="text-sm text-[#A39B90]">
                  {t("conversationsSelectPrompt")}
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-sm text-[#A39B90]">
                  {t("noMessages")}
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
