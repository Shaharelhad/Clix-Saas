import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  MessageCircle,
  ChevronRight,
  Plus,
  Headphones,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

/* ── Status colors ── */
const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-600 border-blue-500/20",
  in_progress: "bg-amber-500/15 text-amber-600 border-amber-500/20",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
  closed: "bg-neutral-400/15 text-neutral-500 border-neutral-400/20",
};
const STATUS_KEYS: Record<string, string> = {
  open: "statusOpen",
  in_progress: "statusInProgress",
  resolved: "statusResolved",
  closed: "statusClosed",
};

interface SupportTicketModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export default function SupportTicketModal({
  open,
  onClose,
  userId,
}: SupportTicketModalProps) {
  const { t } = useTranslation("support");
  const qc = useQueryClient();

  /* ── State ── */
  const [view, setView] = useState<"list" | "chat" | "new">("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  /* ── Queries ── */
  const { data: tickets = [] } = useQuery({
    queryKey: ["support_tickets", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, conversation_id, subject, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: open,
  });

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  const { data: ticketMessages = [] } = useQuery({
    queryKey: ["ticket_messages", selectedTicket?.conversation_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_messages")
        .select("user_message, bot_response, created_at")
        .eq("conversation_id", selectedTicket!.conversation_id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!selectedTicket,
  });

  /* ── Auto-scroll to bottom on messages change ── */
  useEffect(() => {
    if (view === "chat") {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [ticketMessages, view]);

  /* ── Feedback flash ── */
  const flash = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  /* ── Create new ticket ── */
  const createMutation = useMutation({
    mutationFn: async () => {
      const conversationId = crypto.randomUUID();
      const { error: e1 } = await supabase.from("support_tickets").insert({
        user_id: userId,
        conversation_id: conversationId,
        subject: subject.trim(),
        status: "open",
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("ticket_messages").insert({
        user_id: userId,
        conversation_id: conversationId,
        user_message: message.trim(),
        bot_response: "",
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support_tickets", userId] });
      setSubject("");
      setMessage("");
      flash(t("success"));
      setView("list");
    },
    onError: () => flash(t("error")),
  });

  /* ── Reply to existing ticket ── */
  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket) return;
      const { error: e1 } = await supabase.from("ticket_messages").insert({
        user_id: userId,
        conversation_id: selectedTicket.conversation_id,
        user_message: replyText.trim(),
        bot_response: "",
      });
      if (e1) throw e1;
      // Reopen if resolved
      if (selectedTicket.status === "resolved") {
        await supabase
          .from("support_tickets")
          .update({ status: "open" })
          .eq("id", selectedTicket.id);
        qc.invalidateQueries({ queryKey: ["support_tickets", userId] });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["ticket_messages", selectedTicket?.conversation_id],
      });
      setReplyText("");
    },
  });

  /* ── Navigation helpers ── */
  const openTicket = (id: string) => {
    setSelectedTicketId(id);
    setReplyText("");
    setView("chat");
  };
  const goBack = () => {
    setView("list");
    setSelectedTicketId(null);
  };
  const startNew = () => {
    setSubject("");
    setMessage("");
    setView("new");
  };

  /* ── Time formatter ── */
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return t("justNow");
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
    if (d.toDateString() === now.toDateString())
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const isClosed =
    selectedTicket?.status === "closed" ||
    selectedTicket?.status === "resolved";

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

        {/* Modal */}
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:w-[520px] h-[85dvh] sm:h-[560px] bg-[#FAF7F3] rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/15 overflow-hidden flex flex-col border border-[#EDE6DD]/60"
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-5 py-4 bg-[#2D2A26] text-white shrink-0">
            {view !== "list" && (
              <button
                type="button"
                onClick={goBack}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer -ms-1"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            )}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#FF7E47] flex items-center justify-center shrink-0">
                <Headphones className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold truncate">
                  {view === "chat" && selectedTicket
                    ? selectedTicket.subject
                    : t("title")}
                </h3>
                <p className="text-[10px] text-white/50 truncate">
                  {view === "chat" && selectedTicket
                    ? t(STATUS_KEYS[selectedTicket.status] ?? "statusOpen")
                    : t("subtitle")}
                </p>
              </div>
            </div>
            {view === "chat" && selectedTicket && (
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[selectedTicket.status] ?? STATUS_COLORS.open}`}
              >
                {t(STATUS_KEYS[selectedTicket.status] ?? "statusOpen")}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ms-1"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* ── Feedback toast ── */}
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-16 left-4 right-4 z-20 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium text-center shadow-lg"
              >
                {feedback}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ═══════════════════════════════════════════════
              VIEW: TICKET LIST
             ═══════════════════════════════════════════════ */}
          {view === "list" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* New conversation button */}
              <div className="px-4 pt-4 pb-2 shrink-0">
                <button
                  type="button"
                  onClick={startNew}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FF7E47] hover:bg-[#E86B38] text-white text-sm font-bold transition-colors cursor-pointer shadow-sm shadow-[#FF7E47]/20"
                >
                  <Plus className="w-4 h-4" />
                  {t("newConversation")}
                </button>
              </div>

              {/* Ticket list */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {tickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-[#EDE6DD]/60 flex items-center justify-center mb-3">
                      <MessageCircle className="w-7 h-7 text-[#C5BDB3]" />
                    </div>
                    <p className="text-sm font-semibold text-[#7A7267]">
                      {t("noTickets")}
                    </p>
                    <p className="text-xs text-[#A39B90] mt-1 max-w-[200px]">
                      {t("noTicketsDesc")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 pt-1">
                    {tickets.map((ticket) => {
                      const statusColor =
                        STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open;
                      return (
                        <button
                          type="button"
                          key={ticket.id}
                          onClick={() => openTicket(ticket.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#EDE6DD]/40 transition-colors cursor-pointer text-start group"
                        >
                          <div className="w-9 h-9 rounded-full bg-[#EDE6DD]/60 flex items-center justify-center shrink-0 group-hover:bg-[#FF7E47]/10 transition-colors">
                            <MessageCircle className="w-4 h-4 text-[#A39B90] group-hover:text-[#FF7E47] transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-[#2D2A26] truncate">
                                {ticket.subject}
                              </p>
                              <span className="text-[10px] text-[#A39B90] shrink-0">
                                {fmtTime(ticket.created_at)}
                              </span>
                            </div>
                            <span
                              className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-1 ${statusColor}`}
                            >
                              {t(STATUS_KEYS[ticket.status] ?? "statusOpen")}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              VIEW: NEW TICKET
             ═══════════════════════════════════════════════ */}
          {view === "new" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#7A7267] mb-1.5 block">
                    {t("subjectLabel")}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t("subjectPlaceholder")}
                    className="w-full border border-[#EDE6DD] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#C5BDB3] focus:outline-none focus:border-[#FF7E47] focus:ring-1 focus:ring-[#FF7E47]/20 transition-colors bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#7A7267] mb-1.5 block">
                    {t("messageLabel")}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("messagePlaceholder")}
                    rows={5}
                    className="w-full border border-[#EDE6DD] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#C5BDB3] focus:outline-none focus:border-[#FF7E47] focus:ring-1 focus:ring-[#FF7E47]/20 transition-colors resize-none bg-white"
                  />
                </div>
              </div>

              {/* Send button */}
              <div className="px-5 pb-5 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={
                    !subject.trim() || !message.trim() || createMutation.isPending
                  }
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FF7E47] hover:bg-[#E86B38] disabled:opacity-50 text-white text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {createMutation.isPending ? t("submitting") : t("submit")}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              VIEW: CHAT THREAD
             ═══════════════════════════════════════════════ */}
          {view === "chat" && selectedTicket && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(0,0,0,0.02) 1px, transparent 1px)",
                  backgroundSize: "16px 16px",
                }}
              >
                {ticketMessages.map((msg, i) => (
                  <div key={i} className="space-y-3">
                    {/* User message — right aligned */}
                    {msg.user_message && (
                      <motion.div
                        initial={i === ticketMessages.length - 1 ? { opacity: 0, y: 8 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[80%]">
                          <div className="bg-[#2D2A26] text-white rounded-2xl rounded-ee-md px-4 py-2.5 shadow-sm">
                            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">
                              {msg.user_message}
                            </p>
                          </div>
                          <p className="text-[10px] text-[#A39B90] mt-1 text-end pe-1">
                            {fmtTime(msg.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Admin reply — left aligned */}
                    {msg.bot_response && (
                      <motion.div
                        initial={i === ticketMessages.length - 1 ? { opacity: 0, y: 8 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="max-w-[80%]">
                          <div className="flex items-center gap-1.5 mb-1 ps-1">
                            <div className="w-4 h-4 rounded-full bg-[#FF7E47] flex items-center justify-center">
                              <Headphones className="w-2.5 h-2.5 text-white" />
                            </div>
                            <span className="text-[10px] font-bold text-[#FF7E47]">
                              {t("supportTeam")}
                            </span>
                          </div>
                          <div className="bg-white border border-[#EDE6DD]/80 rounded-2xl rounded-ss-md px-4 py-2.5 shadow-sm">
                            <p className="text-[13px] text-[#2D2A26] leading-relaxed whitespace-pre-wrap">
                              {msg.bot_response}
                            </p>
                          </div>
                          <p className="text-[10px] text-[#A39B90] mt-1 ps-1">
                            {fmtTime(msg.created_at)}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Reply input */}
              <div className="shrink-0 border-t border-[#EDE6DD]/60 bg-white px-4 py-3">
                {isClosed ? (
                  <p className="text-xs text-[#A39B90] text-center py-1">
                    {t("ticketClosed")}
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <textarea
                      dir="rtl"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (replyText.trim() && !replyMutation.isPending) {
                            replyMutation.mutate();
                          }
                        }
                      }}
                      placeholder={t("replyPlaceholder")}
                      rows={1}
                      className="flex-1 border border-[#EDE6DD] rounded-xl px-3 py-2 text-sm text-[#2D2A26] placeholder:text-[#C5BDB3] focus:outline-none focus:border-[#FF7E47] focus:ring-1 focus:ring-[#FF7E47]/20 transition-colors resize-none bg-[#FAF7F3] max-h-24"
                      style={{ minHeight: "38px" }}
                    />
                    <button
                      type="button"
                      onClick={() => replyMutation.mutate()}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      className="w-9 h-9 rounded-xl bg-[#FF7E47] hover:bg-[#E86B38] disabled:opacity-40 flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-sm shadow-[#FF7E47]/20"
                    >
                      <Send className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
