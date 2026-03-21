import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Send, Ticket } from "lucide-react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-500",
};

const STATUS_KEYS: Record<string, string> = {
  open: "ticketFilterSubmitted",
  in_progress: "ticketFilterInProgress",
  resolved: "ticketFilterResolved",
  closed: "ticketFilterClosed",
};

const STATUSES = ["all", "open", "in_progress", "resolved", "closed"] as const;
const STATUS_VALUES = ["open", "in_progress", "resolved", "closed"] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export default function AdminTicketsSection() {
  const { t } = useTranslation("admin");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["admin", "tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(
          "id, conversation_id, subject, status, user_id, created_at, updated_at, profiles(full_name, email)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const selected = tickets.find((t) => t.id === selectedId);

  const { data: messages = [] } = useQuery({
    queryKey: ["admin", "ticket-messages", selected?.conversation_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("user_message, bot_response, created_at")
        .eq("conversation_id", selected!.conversation_id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!selected,
  });

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const replyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ticket_messages").insert({
        conversation_id: selected!.conversation_id,
        user_id: user!.id,
        user_message: "",
        bot_response: reply.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "ticket-messages", selected?.conversation_id],
      });
      setReply("");
      showFeedback(t("ticketReplied"));
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus })
        .eq("id", selected!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "counts"] });
      showFeedback(t("ticketStatusUpdated"));
    },
  });

  const card =
    "bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

  const filterKeys: Record<string, string> = {
    all: "ticketFilterAll",
    open: "ticketFilterSubmitted",
    in_progress: "ticketFilterInProgress",
    resolved: "ticketFilterResolved",
    closed: "ticketFilterClosed",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#D8723C]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-5 gap-4 overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="shrink-0"
      >
        <h1 className="text-xl font-bold text-[#111111]">
          {t("ticketsTitle")}
        </h1>
        <p className="text-xs text-[#999999] mt-0.5">
          {t("ticketsSubtitle")}
        </p>
      </motion.div>

      {/* Filters */}
      <div className="flex gap-2 shrink-0">
        {STATUSES.map((s) => (
          <button
            type="button"
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              statusFilter === s
                ? "bg-[#D8723C]/10 text-[#D8723C] border border-[#D8723C]/25"
                : "text-[#999999] hover:text-[#111111] hover:bg-black/[0.04] border border-transparent"
            )}
          >
            {t(filterKeys[s])}
          </button>
        ))}
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Ticket list */}
        <div
          className={cn(
            card,
            "w-[380px] shrink-0 flex flex-col overflow-hidden"
          )}
        >
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#CCCCCC]">
                <Ticket className="w-8 h-8 mb-2" />
                <p className="text-xs">{t("ticketsEmpty")}</p>
              </div>
            ) : (
              filtered.map((ticket) => (
                <button
                  type="button"
                  key={ticket.id}
                  onClick={() => setSelectedId(ticket.id)}
                  className={cn(
                    "w-full text-start px-4 py-3.5 border-b border-[#F0ECE7] hover:bg-[#FAFAF8] transition-colors cursor-pointer",
                    selectedId === ticket.id && "bg-[#FDF9F6] border-s-2 border-s-[#D8723C]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-[#111111] truncate flex-1">
                      {ticket.subject}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ms-2 ${STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}`}
                    >
                      {t(STATUS_KEYS[ticket.status] ?? "ticketFilterSubmitted")}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#AAAAAA] truncate">
                    {ticket.profiles?.full_name} &middot; {ticket.profiles?.email}
                  </p>
                  <p className="text-[10px] text-[#CCCCCC] mt-0.5">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Detail */}
        <div className={cn(card, "flex-1 flex flex-col overflow-hidden")}>
          {selected ? (
            <>
              {/* Detail header */}
              <div className="px-5 py-4 border-b border-[#F0ECE7] shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold text-[#111111] truncate flex-1">
                    {selected.subject}
                  </h2>
                  <select
                    value={selected.status}
                    onChange={(e) => statusMutation.mutate(e.target.value)}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-[#E8E4DF] bg-white text-[#111111] cursor-pointer focus:outline-none focus:border-[#D8723C]"
                  >
                    {STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {t(STATUS_KEYS[s])}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-[#AAAAAA]">
                  {t("ticketFrom")}: {selected.profiles?.full_name} ({selected.profiles?.email})
                  &middot; {new Date(selected.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {messages.map((msg, i) => (
                  <div key={i} className="space-y-2">
                    {msg.user_message && (
                      <div className="bg-[#FAFAF8] border border-[#F0ECE7] rounded-xl px-4 py-3">
                        <p className="text-[10px] font-bold text-[#AAAAAA] mb-1">
                          {selected.profiles?.full_name}
                        </p>
                        <p className="text-sm text-[#111111] whitespace-pre-wrap">
                          {msg.user_message}
                        </p>
                      </div>
                    )}
                    {msg.bot_response && (
                      <div className="bg-[#D8723C]/5 border border-[#D8723C]/10 rounded-xl px-4 py-3">
                        <p className="text-[10px] font-bold text-[#D8723C] mb-1">
                          Admin
                        </p>
                        <p className="text-sm text-[#111111] whitespace-pre-wrap">
                          {msg.bot_response}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Reply bar */}
              <div className="px-5 py-3 border-t border-[#F0ECE7] shrink-0">
                {feedback && (
                  <p className="text-xs text-emerald-600 mb-2">{feedback}</p>
                )}
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={t("ticketReplyPlaceholder")}
                    rows={2}
                    className="flex-1 border border-[#E8E4DF] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#D8723C] focus:ring-1 focus:ring-[#D8723C]/20 transition-colors resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => replyMutation.mutate()}
                    disabled={!reply.trim() || replyMutation.isPending}
                    className="self-end px-4 py-2.5 rounded-xl bg-[#D8723C] hover:bg-[#C4632F] disabled:opacity-50 text-white text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    {t("ticketReply")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#CCCCCC]">
              <Ticket className="w-10 h-10 mb-3" />
              <p className="text-sm">{t("ticketSelectPrompt")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
