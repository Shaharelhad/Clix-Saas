import { useAuth } from "@/hooks/useAuth";
import { callBotDemo, callBotEditRequest } from "@/services/webhooks";
import { motion } from "framer-motion";
import { ArrowLeft, Bot, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import ChatPanel, { type ChatMessage } from "./ChatPanel";

/* ─────────────────────────── Types ─────────────────────────── */

interface PreviewSectionProps {
  onNext: () => void;
}

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
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

/* ─────────────────────── Timestamp helper ──────────────────── */

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

const PreviewSection = ({ onNext }: PreviewSectionProps) => {
  const { t } = useTranslation("createBot");
  const { user } = useAuth();

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

  /* ── Edit chat state ── */
  const [editMessages, setEditMessages] = useState<ChatMessage[]>(() => [
    {
      id: "edit-greeting",
      role: "bot",
      text: t("editBotDesc"),
      time: nowStamp(),
    },
  ]);
  const [editInput, setEditInput] = useState("");
  const [isEditSending, setIsEditSending] = useState(false);

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

  /* ── Send edit message ── */
  const handleEditSend = useCallback(async () => {
    const text = editInput.trim();
    if (!text || isEditSending) return;

    const userMsg: ChatMessage = {
      id: `edit-user-${Date.now()}`,
      role: "user",
      text,
      time: nowStamp(),
    };

    setEditMessages((prev) => [...prev, userMsg]);
    setEditInput("");
    setIsEditSending(true);

    try {
      const result = await callBotEditRequest({
        user_id: user?.id ?? "",
        edit_request: text,
      });

      if (result.error) throw new Error(result.error);

      const data = result.data as {
        summary?: string;
        proposed_changes?: string;
        message?: string;
      } | null;

      const responseText =
        data?.summary || data?.proposed_changes || data?.message || t("editBotSuccess");

      const botMsg: ChatMessage = {
        id: `edit-bot-${Date.now()}`,
        role: "bot",
        text: responseText,
        time: nowStamp(),
      };

      setEditMessages((prev) => [...prev, botMsg]);

      // Reset demo conversation so user can test new behavior
      handleNewConversation();
    } catch (err) {
      const botMsg: ChatMessage = {
        id: `edit-bot-err-${Date.now()}`,
        role: "bot",
        text: err instanceof Error ? err.message : t("editBotError"),
        time: nowStamp(),
      };
      setEditMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsEditSending(false);
    }
  }, [editInput, isEditSending, user?.id, t,]);

  /* ═══════════════════════ RENDER ═══════════════════════════ */

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5 pt-2"
    >
      {/* ── Side-by-side panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 lg:gap-5">
        {/* Demo Panel — Left */}
        <motion.div variants={fadeUp} className="lg:col-span-4">
          <ChatPanel
            title={t("chatbotDemo")}
            icon={<Bot className="w-4 h-4 text-[#FF7E47]" />}
            statusText="Online"
            statusColor="emerald"
            messages={messages}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            isSending={isSending}
            placeholder={t("typeMessage")}
            variant="demo"
            headerAction={
              <motion.button
                whileHover={{ scale: 1.08, rotate: -15 }}
                whileTap={{ scale: 0.92 }}
                onClick={handleNewConversation}
                className="p-1.5 rounded-xl hover:bg-[#FAF7F3] transition-colors group cursor-pointer"
                title={t("newConversation")}
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#A39B90] group-hover:text-[#FF7E47] transition-colors" />
              </motion.button>
            }
          />
        </motion.div>

        {/* Edit Panel — Right */}
        <motion.div variants={fadeUp} className="lg:col-span-3">
          <ChatPanel
            title={t("editBotTitle")}
            icon={<Sparkles className="w-4 h-4 text-[#FF7E47]" />}
            statusText="AI Editor"
            statusColor="orange"
            messages={editMessages}
            input={editInput}
            onInputChange={setEditInput}
            onSend={handleEditSend}
            isSending={isEditSending}
            placeholder={t("editBotPlaceholder")}
            variant="edit"
          />
        </motion.div>
      </div>

      {/* ── Let's Go Button ── */}
      <motion.div variants={fadeUp} className="flex justify-center pt-2 pb-4">
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
