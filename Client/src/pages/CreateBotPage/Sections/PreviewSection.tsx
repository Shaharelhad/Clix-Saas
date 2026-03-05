import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  ArrowLeft,
  MessageSquare,
  Pencil,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { callBotDemo, callBotEditRequest, callBotEditApply } from "@/services/webhooks";

/* ─────────────────────────── Types ─────────────────────────── */

interface PreviewSectionProps {
  onNext: () => void;
}

interface ChatMessage {
  id: string;
  role: "bot" | "user";
  text: string;
  time: string;
}

type ActiveTab = "demo" | "edit";

/* ─────────────────────── Animation config ──────────────────── */

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

const tabContent = {
  enter: { opacity: 0, y: 12 },
  active: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

/* ─────────────────────── Timestamp helper ──────────────────── */

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/* ═══════════════════════ TYPING INDICATOR ═══════════════════ */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#B8AFA4]"
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.18,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════ CHAT BUBBLE ════════════════════════ */

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isBot = msg.role === "bot";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`max-w-[80%] ${isBot ? "self-start" : "self-end"}`}
    >
      <div
        className={
          isBot
            ? "bg-[#2D2A26] text-white rounded-2xl rounded-ss-sm px-5 py-3.5 shadow-sm"
            : "bg-[#FF7E47]/10 text-[#4A4640] rounded-2xl rounded-ee-sm px-5 py-3.5 border border-[#FF7E47]/15"
        }
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
      </div>
      <span
        className={`text-[10px] text-[#B8AFA4] mt-1 block px-1 ${
          isBot ? "text-start" : "text-end"
        }`}
      >
        {msg.time}
      </span>
    </motion.div>
  );
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

const PreviewSection = ({ onNext }: PreviewSectionProps) => {
  const { t } = useTranslation("createBot");
  const { user } = useAuth();

  /* ── Tab state ── */
  const [activeTab, setActiveTab] = useState<ActiveTab>("demo");

  /* ── Demo chat state ── */
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "greeting",
      role: "bot",
      text: t("botMessage"),
      time: nowStamp(),
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Edit tab state ── */
  const [editRequest, setEditRequest] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [editError, setEditError] = useState("");
  const [proposedChanges, setProposedChanges] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  /* ── Auto-scroll chat ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  /* ── Focus input on tab switch ── */
  useEffect(() => {
    if (activeTab === "demo") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [activeTab]);

  /* ── Send demo message ── */
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
      time: nowStamp(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const result = await callBotDemo({
        user_id: user?.id ?? "",
        message: text,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      });

      if (result.error) throw new Error(result.error);

      const data = result.data as {
        response?: string;
        conversation_id?: string;
      } | null;

      if (data?.conversation_id) {
        setConversationId(data.conversation_id);
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: "bot",
        text: data?.response ?? "...",
        time: nowStamp(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const botMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        role: "bot",
        text:
          err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
        time: nowStamp(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isSending, user?.id, conversationId]);

  /* ── New conversation ── */
  const handleNewConversation = () => {
    setMessages([
      {
        id: "greeting",
        role: "bot",
        text: t("botMessage"),
        time: nowStamp(),
      },
    ]);
    setConversationId(null);
    setInput("");
  };

  /* ── Submit edit request ── */
  const handleEditSubmit = async () => {
    if (!editRequest.trim() || isEditing) return;

    setIsEditing(true);
    setEditStatus("idle");
    setEditError("");
    setProposedChanges("");

    try {
      const result = await callBotEditRequest({
        user_id: user?.id ?? "",
        edit_request: editRequest.trim(),
      });

      if (result.error) throw new Error(result.error);

      const data = result.data as {
        summary?: string;
        proposed_changes?: string;
        message?: string;
      } | null;

      setEditStatus("success");
      setProposedChanges(
        data?.summary || data?.proposed_changes || data?.message || "",
      );
      setEditRequest("");
    } catch (err) {
      setEditStatus("error");
      setEditError(
        err instanceof Error ? err.message : t("editBotError"),
      );
    } finally {
      setIsEditing(false);
    }
  };

  /* ── Apply proposed edit changes ── */
  const handleApplyEdit = async () => {
    if (isApplying) return;
    setIsApplying(true);

    try {
      const result = await callBotEditApply({
        user_id: user?.id ?? "",
        proposed_changes: proposedChanges,
      });

      if (result.error) throw new Error(result.error);

      setEditStatus("idle");
      setProposedChanges("");
      // Reset demo conversation so user can test the new behavior
      handleNewConversation();
      setActiveTab("demo");
    } catch (err) {
      setEditStatus("error");
      setEditError(
        err instanceof Error ? err.message : t("editBotError"),
      );
    } finally {
      setIsApplying(false);
    }
  };

  /* ── Key handler for chat input ── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ═══════════════════════ RENDER ═══════════════════════════ */

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6 pt-4"
    >
      {/* ── Tab Switcher ── */}
      <motion.div variants={fadeUp} className="flex justify-center">
        <div className="inline-flex rounded-2xl p-1.5 bg-white shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50">
          {(["demo", "edit"] as const).map((tab) => {
            const isActive = activeTab === tab;
            const Icon = tab === "demo" ? MessageSquare : Pencil;
            return (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                whileHover={!isActive ? { scale: 1.03 } : undefined}
                whileTap={{ scale: 0.97 }}
                className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-colors duration-300 cursor-pointer ${
                  isActive
                    ? "text-white"
                    : "text-[#A39B90] hover:text-[#7A7267]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-xl bg-[#FF7E47] shadow-[0_2px_12px_rgba(255,126,71,0.35)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {t(tab === "demo" ? "tabDemo" : "tabEdit")}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "demo" ? (
          <motion.div
            key="demo"
            variants={tabContent}
            initial="enter"
            animate="active"
            exit="exit"
          >
            {/* ── Chat Container ── */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50"
            >
              {/* Chat header */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-[#EDE6DD]/40">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-[#FF7E47]/15 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-[#FF7E47]" />
                    </div>
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute -bottom-0.5 -end-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-[#2D2A26] text-sm block leading-tight">
                      {t("chatbotDemo")}
                    </span>
                    <span className="text-[10px] text-emerald-500 font-medium">
                      Online
                    </span>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.08, rotate: -15 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleNewConversation}
                  className="p-2 rounded-xl hover:bg-[#FAF7F3] transition-colors group"
                  title={t("newConversation")}
                >
                  <RotateCcw className="w-4 h-4 text-[#A39B90] group-hover:text-[#FF7E47] transition-colors" />
                </motion.button>
              </div>

              {/* Chat messages area */}
              <div
                className="px-5 sm:px-6 py-5 min-h-[340px] max-h-[420px] overflow-y-auto flex flex-col gap-3 scroll-smooth"
                style={{
                  background:
                    "linear-gradient(180deg, #FDFBF8 0%, #FAF7F3 100%)",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#E5DDD3 transparent",
                }}
              >
                {messages.map((msg) => (
                  <ChatBubble key={msg.id} msg={msg} />
                ))}

                {/* Typing indicator */}
                {isSending && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="self-start max-w-[80%]"
                  >
                    <div className="bg-[#2D2A26] rounded-2xl rounded-ss-sm shadow-sm">
                      <TypingIndicator />
                    </div>
                    <span className="text-[10px] text-[#B8AFA4] mt-1 block px-1">
                      {t("typingIndicator")}
                    </span>
                  </motion.div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Input bar */}
              <div className="px-4 sm:px-5 py-3.5 border-t border-[#EDE6DD]/40 bg-white">
                <div className="flex gap-2.5">
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isSending}
                      placeholder={t("typeMessage")}
                      className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-4 py-3 pe-12 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200 disabled:opacity-50"
                    />
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={handleSend}
                      disabled={!input.trim() || isSending}
                      className="absolute top-1/2 -translate-y-1/2 end-2 p-2 rounded-lg bg-[#FF7E47] hover:bg-[#E86B38] transition-all duration-200 disabled:opacity-40 disabled:hover:bg-[#FF7E47] cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isSending ? (
                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-white rtl:-scale-x-100" />
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            variants={tabContent}
            initial="enter"
            animate="active"
            exit="exit"
          >
            {/* ── Edit Bot Card ── */}
            <motion.div
              variants={fadeUp}
              className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50"
            >
              {/* Header */}
              <div className="px-6 sm:px-8 pt-8 pb-4">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <h2 className="text-xl sm:text-2xl font-bold text-[#2D2A26] text-center">
                    {t("editBotTitle")}
                  </h2>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF7E47] to-[#E86B38] flex items-center justify-center flex-shrink-0 shadow-[0_2px_10px_rgba(255,126,71,0.3)]">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                </div>
                <p className="text-sm text-[#7A7267] text-center max-w-md mx-auto leading-relaxed">
                  {t("editBotDesc")}
                </p>
              </div>

              {/* Edit form */}
              <div className="px-6 sm:px-8 pb-6">
                <textarea
                  value={editRequest}
                  onChange={(e) => setEditRequest(e.target.value)}
                  placeholder={t("editBotPlaceholder")}
                  disabled={isEditing}
                  rows={4}
                  className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-5 py-4 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200 resize-none disabled:opacity-50"
                />
              </div>

              {/* Status feedback */}
              <AnimatePresence>
                {editStatus === "success" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 sm:px-8 pb-4"
                  >
                    <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3.5 text-sm">
                      <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">{t("editBotSuccess")}</p>
                        {proposedChanges && (
                          <div className="mt-2 pt-2 border-t border-emerald-200/50">
                            <p className="text-xs font-bold text-emerald-600 mb-1">
                              {t("proposedChanges")}
                            </p>
                            <p className="text-xs text-emerald-600/80 leading-relaxed whitespace-pre-wrap">
                              {proposedChanges}
                            </p>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleApplyEdit}
                              disabled={isApplying}
                              className="mt-3 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl px-4 py-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {isApplying ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  {t("editBotProcessing")}
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {t("applyChanges", { defaultValue: "Apply Changes" })}
                                </>
                              )}
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {editStatus === "error" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 sm:px-8 pb-4"
                  >
                    <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3.5 text-sm">
                      <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
                      {editError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <div className="px-6 sm:px-8 pb-8">
                <motion.button
                  whileHover={!isEditing ? { scale: 1.01 } : undefined}
                  whileTap={!isEditing ? { scale: 0.99 } : undefined}
                  onClick={handleEditSubmit}
                  disabled={isEditing || !editRequest.trim()}
                  className="group w-full inline-flex items-center justify-center gap-3 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-base rounded-2xl py-4 transition-all duration-300 shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 cursor-pointer"
                >
                  {isEditing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {t("editBotProcessing")}
                    </>
                  ) : (
                    <>
                      {t("editBotSubmit")}
                      <Pencil className="w-4 h-4 transition-transform group-hover:rotate-12" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Let's Go Button ── */}
      <motion.div variants={fadeUp} className="flex justify-center pt-4 pb-4">
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-lg rounded-2xl px-14 py-4 transition-all duration-300 shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)] cursor-pointer"
        >
          {t("letsGo")}
          <ArrowLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180 transition-transform group-hover:ltr:-translate-x-1 group-hover:rtl:translate-x-1" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default PreviewSection;
