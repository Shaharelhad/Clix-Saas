import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bot, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { callBotDemo } from "@/services/webhooks";
import ChatPanel, {
  type ChatMessage,
} from "@/pages/CreateBotPage/Sections/ChatPanel";

/* ─────────────────────── Animation config ──────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
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

interface DemoChatSectionProps {
  resetKey?: number;
}

export default function DemoChatSection({ resetKey = 0 }: DemoChatSectionProps) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "greeting",
      role: "bot",
      text: t("demoChatGreeting"),
      time: nowStamp(),
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  /* ── Reset when edit is applied ── */
  useEffect(() => {
    if (resetKey > 0) {
      setMessages([
        {
          id: "greeting",
          role: "bot",
          text: t("demoChatGreeting"),
          time: nowStamp(),
        },
      ]);
      setConversationId(null);
      setInput("");
    }
  }, [resetKey, t]);

  /* ── Send message ── */
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
        text: t("demoChatGreeting"),
        time: nowStamp(),
      },
    ]);
    setConversationId(null);
    setInput("");
  };

  /* ═══════════════════════ RENDER ═══════════════════════════ */

  return (
    <motion.div variants={fadeUp} className="flex flex-col h-full">
      <ChatPanel
        title={t("demoChatTitle")}
        icon={<Bot className="w-4 h-4 text-[#FF7E47]" />}
        statusText={t("demoChatStatus")}
        statusColor="emerald"
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        isSending={isSending}
        placeholder={t("demoChatPlaceholder")}
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
  );
}
