import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bot, RotateCcw, Settings2, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { callFlowDemo } from "@/services/edge-functions";
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
  workflowId?: string | null;
}

export default function DemoChatSection({ resetKey = 0, workflowId }: DemoChatSectionProps) {
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
  const [sessionState, setSessionState] = useState<Record<string, unknown> | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [clickedMessageIds, setClickedMessageIds] = useState<Set<string>>(new Set());
  const [testPhone, setTestPhone] = useState("");
  const [showTestSettings, setShowTestSettings] = useState(false);

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
      setSessionState(null);
      setInput("");
      setClickedMessageIds(new Set());
    }
  }, [resetKey, t]);

  /* ── Build session state with test variables ── */
  const buildSessionState = useCallback(() => {
    const base = sessionState ?? {};
    if (!testPhone.trim()) return sessionState;
    const vars = (base.variables as Record<string, string>) ?? {};
    return { ...base, variables: { ...vars, phone: testPhone.trim() } };
  }, [sessionState, testPhone]);

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
      const stateToSend = buildSessionState();
      const result = await callFlowDemo({
        user_id: user?.id ?? "",
        workflow_id: workflowId,
        message: text,
        ...(conversationId ? { conversation_id: conversationId } : {}),
        ...(stateToSend ? { session_state: stateToSend } : {}),
      });

      if (result.error) throw new Error(result.error);

      const data = result.data as {
        responses?: { type: string; content: string; imageUrl?: string; buttons?: { id: string; label: string }[]; header?: string; footer?: string }[];
        response?: string;
        conversation_id?: string;
        session_state?: Record<string, unknown>;
      } | null;

      if (data?.conversation_id) setConversationId(data.conversation_id);
      if (data?.session_state) setSessionState(data.session_state);

      // Handle array responses (flow-demo format)
      if (data?.responses && Array.isArray(data.responses) && data.responses.length > 0) {
        const botMessages: ChatMessage[] = data.responses.map((r, i) => ({
          id: `bot-${Date.now()}-${i}`,
          role: "bot" as const,
          text: r.content || "...",
          time: nowStamp(),
          ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}),
          ...(r.buttons?.length ? { buttons: r.buttons } : {}),
          ...(r.header ? { header: r.header } : {}),
          ...(r.footer ? { footer: r.footer } : {}),
        }));
        setMessages((prev) => [...prev, ...botMessages]);
      } else if (data?.response) {
        setMessages((prev) => [
          ...prev,
          { id: `bot-${Date.now()}`, role: "bot", text: data.response!, time: nowStamp() },
        ]);
      }
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
  }, [input, isSending, user?.id, workflowId, conversationId, buildSessionState]);

  /* ── Button click in chat ── */
  const handleButtonClick = useCallback(async (label: string) => {
    if (isSending) return;

    // Find the message with these buttons and mark it clicked
    setMessages((prev) => {
      const lastBtnMsg = [...prev].reverse().find((m) => m.buttons?.some((b) => b.label === label));
      if (lastBtnMsg) setClickedMessageIds((s) => new Set(s).add(lastBtnMsg.id));
      return [
        ...prev,
        { id: `user-${Date.now()}`, role: "user" as const, text: label, time: nowStamp() },
      ];
    });
    setIsSending(true);

    try {
      const stateToSend = buildSessionState();
      const result = await callFlowDemo({
        user_id: user?.id ?? "",
        workflow_id: workflowId,
        message: label,
        ...(conversationId ? { conversation_id: conversationId } : {}),
        ...(stateToSend ? { session_state: stateToSend } : {}),
      });

      if (result.error) throw new Error(result.error);

      const data = result.data as {
        responses?: { type: string; content: string; imageUrl?: string; buttons?: { id: string; label: string }[]; header?: string; footer?: string }[];
        response?: string;
        conversation_id?: string;
        session_state?: Record<string, unknown>;
      } | null;

      if (data?.conversation_id) setConversationId(data.conversation_id);
      if (data?.session_state) setSessionState(data.session_state);

      if (data?.responses && Array.isArray(data.responses) && data.responses.length > 0) {
        const botMessages: ChatMessage[] = data.responses.map((r, i) => ({
          id: `bot-${Date.now()}-${i}`,
          role: "bot" as const,
          text: r.content || "...",
          time: nowStamp(),
          ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}),
          ...(r.buttons?.length ? { buttons: r.buttons } : {}),
          ...(r.header ? { header: r.header } : {}),
          ...(r.footer ? { footer: r.footer } : {}),
        }));
        setMessages((prev) => [...prev, ...botMessages]);
      } else if (data?.response) {
        setMessages((prev) => [
          ...prev,
          { id: `bot-${Date.now()}`, role: "bot", text: data.response!, time: nowStamp() },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: "bot",
          text: err instanceof Error ? err.message : "Something went wrong.",
          time: nowStamp(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [isSending, user?.id, workflowId, conversationId, buildSessionState]);

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
    setSessionState(null);
    setInput("");
    setClickedMessageIds(new Set());
  };

  /* ═══════════════════════ RENDER ═══════════════════════════ */

  return (
    <motion.div variants={fadeUp} className="flex flex-col h-full">
      {/* Test Settings */}
      <div className="border-b border-[#EDE6DD]/60 bg-[#FAF7F3]">
        <button
          type="button"
          onClick={() => setShowTestSettings((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-medium text-[#7A7267] hover:text-[#2D2A26] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 className="w-3 h-3" />
            {t("demoTestSettings")}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showTestSettings ? "rotate-180" : ""}`} />
        </button>
        {showTestSettings && (
          <div className="px-3 pb-2 flex items-center gap-2">
            <label className="text-[10px] text-[#A39B90] shrink-0">{t("demoTestPhone")}</label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="972501234567"
              className="flex-1 border border-[#EDE6DD] rounded-md px-2 py-1 text-xs text-[#2D2A26] bg-white focus:outline-none focus:border-[var(--brand-primary-light)] transition-colors"
              dir="ltr"
            />
          </div>
        )}
      </div>

      <ChatPanel
        title={t("demoChatTitle")}
        icon={<Bot className="w-4 h-4 text-[var(--brand-primary-light)]" />}
        statusText={t("demoChatStatus")}
        statusColor="emerald"
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        isSending={isSending}
        placeholder={t("demoChatPlaceholder")}
        variant="demo"
        onButtonClick={handleButtonClick}
        clickedMessageIds={clickedMessageIds}
        headerAction={
          <motion.button
            type="button"
            whileHover={{ scale: 1.08, rotate: -15 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleNewConversation}
            className="p-1.5 rounded-xl hover:bg-[#FAF7F3] transition-colors group cursor-pointer"
            title={t("newConversation")}
            aria-label={t("newConversation")}
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#A39B90] group-hover:text-[var(--brand-primary-light)] transition-colors" />
          </motion.button>
        }
      />
    </motion.div>
  );
}
