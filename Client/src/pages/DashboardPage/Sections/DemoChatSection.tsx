import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, RotateCcw, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { callFlowDemo } from "@/services/edge-functions";
import ChatPanel, {
  type ChatMessage,
} from "@/pages/CreateBotPage/Sections/ChatPanel";

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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
  const [showSettings, setShowSettings] = useState(false);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);

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

  /* ── Close settings popover on outside click / Escape ── */
  useEffect(() => {
    if (!showSettings) return;
    const onMouseDown = (e: MouseEvent) => {
      if (settingsBtnRef.current?.contains(e.target as Node)) return;
      if (
        settingsPopoverRef.current &&
        !settingsPopoverRef.current.contains(e.target as Node)
      ) {
        setShowSettings(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSettings(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSettings]);

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
    <motion.div variants={fadeUp} className="flex flex-col h-full relative">
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
        headerLeading={
          <motion.button
            type="button"
            whileHover={{ scale: 1.08, rotate: -15 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleNewConversation}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors group cursor-pointer"
            title={t("newConversation")}
            aria-label={t("newConversation")}
          >
            <RotateCcw className="w-[18px] h-[18px] text-slate-400 group-hover:text-slate-600 transition-colors" />
          </motion.button>
        }
        headerAction={
          <motion.button
            ref={settingsBtnRef}
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowSettings((v) => !v)}
            className={`p-1.5 rounded-lg transition-colors group cursor-pointer ${
              showSettings ? "bg-slate-100 text-slate-700" : "hover:bg-slate-100"
            }`}
            title={t("demoTestSettings")}
            aria-label={t("demoTestSettings")}
            aria-expanded={showSettings}
          >
            <Settings
              className={`w-[18px] h-[18px] transition-colors ${
                showSettings ? "text-slate-700" : "text-slate-400 group-hover:text-slate-600"
              }`}
            />
          </motion.button>
        }
      />

      {/* ── Test Settings popover ── anchored to the cog in the header */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            ref={settingsPopoverRef}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="absolute top-14 end-3 z-30 w-64 bg-white rounded-2xl shadow-[0_12px_40px_-8px_rgba(15,23,42,0.18)] border border-slate-200 p-4"
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {t("demoTestSettings")}
            </p>
            <label
              htmlFor="test-phone-input"
              className="text-xs font-medium text-slate-600 block mb-1.5"
            >
              {t("demoTestPhone")}
            </label>
            <input
              id="test-phone-input"
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="972501234567"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-slate-50 outline-none focus:border-[var(--brand-primary)]/40 focus:ring-2 focus:ring-[var(--brand-primary)]/15 transition-all"
              dir="ltr"
              autoFocus
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
