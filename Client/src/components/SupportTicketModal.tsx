import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Ticket, ChevronRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-500",
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
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

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

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const conversationId = crypto.randomUUID();

      const { error: ticketErr } = await supabase
        .from("support_tickets")
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          subject: subject.trim(),
          status: "open",
        });
      if (ticketErr) throw ticketErr;

      const { error: msgErr } = await supabase
        .from("ticket_messages")
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          user_message: message.trim(),
          bot_response: "",
        });
      if (msgErr) throw msgErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support_tickets", userId] });
      setSubject("");
      setMessage("");
      setError(null);
      showFeedback(t("success"));
    },
    onError: () => setError(t("error")),
  });

  const handleSubmit = () => {
    setError(null);
    if (!subject.trim() || !message.trim()) return;
    submitMutation.mutate();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3">
            <div>
              <h3 className="text-lg font-bold text-[#2D2A26]">{t("title")}</h3>
              <p className="text-xs text-[#A39B90] mt-0.5">{t("subtitle")}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#FAF7F3] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-[#7A7267]" />
            </button>
          </div>

          {/* Form */}
          <div className="px-6 pb-3 space-y-3">
            <div>
              <label className="text-xs font-bold text-[#7A7267] mb-1 block">
                {t("subjectLabel")}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setError(null);
                }}
                placeholder={t("subjectPlaceholder")}
                className="w-full border border-[#EDE6DD] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#C5BDB3] focus:outline-none focus:border-[#FF7E47] focus:ring-1 focus:ring-[#FF7E47]/20 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-[#7A7267] mb-1 block">
                {t("messageLabel")}
              </label>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setError(null);
                }}
                placeholder={t("messagePlaceholder")}
                rows={3}
                className="w-full border border-[#EDE6DD] rounded-xl px-4 py-2.5 text-sm text-[#2D2A26] placeholder:text-[#C5BDB3] focus:outline-none focus:border-[#FF7E47] focus:ring-1 focus:ring-[#FF7E47]/20 transition-colors resize-none"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={
                !subject.trim() ||
                !message.trim() ||
                submitMutation.isPending
              }
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF7E47] hover:bg-[#E86B38] disabled:opacity-50 text-white text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {submitMutation.isPending ? t("submitting") : t("submit")}
            </button>

            {/* Error / Feedback */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-500 px-1"
                >
                  {error}
                </motion.p>
              )}
              {feedback && !error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-emerald-600 px-1"
                >
                  {feedback}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Past Tickets / Detail View */}
          <div className="px-6 pb-5">
            {selectedTicket ? (
              /* ── Ticket Detail ── */
              <div>
                <button
                  onClick={() => setSelectedTicketId(null)}
                  className="flex items-center gap-1 text-xs font-bold text-[#7A7267] hover:text-[#2D2A26] mb-3 cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  {t("back")}
                </button>
                <div className="flex items-center justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#2D2A26] truncate">
                      {selectedTicket.subject}
                    </p>
                    <p className="text-[11px] text-[#A39B90]">
                      {new Date(selectedTicket.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ms-2 ${STATUS_COLORS[selectedTicket.status] ?? STATUS_COLORS.open}`}
                  >
                    {t(STATUS_KEYS[selectedTicket.status] ?? "statusOpen")}
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {ticketMessages.map((msg, i) => (
                    <div key={i} className="space-y-2">
                      {msg.user_message && (
                        <div className="bg-[#FAF7F3] rounded-xl px-4 py-3">
                          <p className="text-[10px] font-bold text-[#A39B90] mb-1">
                            {t("yourMessage")}
                          </p>
                          <p className="text-sm text-[#2D2A26] whitespace-pre-wrap">
                            {msg.user_message}
                          </p>
                        </div>
                      )}
                      {msg.bot_response && (
                        <div className="bg-[#FF7E47]/5 border border-[#FF7E47]/10 rounded-xl px-4 py-3">
                          <p className="text-[10px] font-bold text-[#FF7E47] mb-1">
                            {t("adminReply")}
                          </p>
                          <p className="text-sm text-[#2D2A26] whitespace-pre-wrap">
                            {msg.bot_response}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* ── Ticket List ── */
              <>
                <p className="text-xs font-bold text-[#7A7267] mb-2">
                  {t("yourTickets")}
                </p>
                <div className="max-h-48 overflow-y-auto">
                  {tickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <div className="w-10 h-10 rounded-full bg-[#FAF7F3] flex items-center justify-center mb-2">
                        <Ticket className="w-5 h-5 text-[#C5BDB3]" />
                      </div>
                      <p className="text-sm font-medium text-[#7A7267]">
                        {t("noTickets")}
                      </p>
                      <p className="text-xs text-[#A39B90] mt-0.5">
                        {t("noTicketsDesc")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {tickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          onClick={() => setSelectedTicketId(ticket.id)}
                          className="w-full flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-[#FAF7F3] transition-colors cursor-pointer text-start"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-[#2D2A26] truncate">
                              {ticket.subject}
                            </p>
                            <p className="text-[11px] text-[#A39B90]">
                              {new Date(ticket.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ms-2 ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}`}
                          >
                            {t(STATUS_KEYS[ticket.status] ?? "statusOpen")}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
