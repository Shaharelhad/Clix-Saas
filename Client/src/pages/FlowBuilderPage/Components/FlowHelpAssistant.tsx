import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Bot, RotateCcw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { callFlowAssistant } from "@/services/edge-functions";
import ChatPanel, { type ChatMessage } from "@/pages/CreateBotPage/Sections/ChatPanel";

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

export default function FlowHelpAssistant() {
  const { t } = useTranslation("flow");

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "greeting", role: "bot", text: t("helpGreeting"), time: nowStamp() },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const historyRef = useRef<HistoryEntry[]>([]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text, time: nowStamp() },
    ]);
    setInput("");
    setIsSending(true);

    // Add to history
    historyRef.current = [...historyRef.current, { role: "user" as const, content: text }].slice(-10);

    try {
      const result = await callFlowAssistant({
        message: text,
        history: historyRef.current,
      });

      if (result.error) throw new Error(result.error);

      const data = result.data as { response?: string } | null;
      const reply = data?.response || "...";

      // Add assistant reply to history
      historyRef.current = [...historyRef.current, { role: "assistant" as const, content: reply }].slice(-10);

      setMessages((prev) => [
        ...prev,
        { id: `bot-${Date.now()}`, role: "bot", text: reply, time: nowStamp() },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: "bot",
          text: err instanceof Error ? err.message : "Error",
          time: nowStamp(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending]);

  const handleReset = () => {
    setMessages([
      { id: "greeting", role: "bot", text: t("helpGreeting"), time: nowStamp() },
    ]);
    historyRef.current = [];
    setInput("");
  };

  return (
    <>
      {/* Toggle button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#FF7E47] text-white shadow-lg hover:bg-[#E86B38] transition-colors cursor-pointer"
          >
            <Bot className="w-4 h-4" />
            <span className="text-sm font-medium">{t("helpOpen")}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Help panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-6 z-40 w-[360px] h-[500px] flex flex-col shadow-2xl rounded-2xl overflow-hidden border border-[#EDE6DD]/60"
          >
            <ChatPanel
              title={t("helpTitle")}
              icon={<Bot className="w-4 h-4 text-[#FF7E47]" />}
              statusText={t("helpStatus")}
              statusColor="emerald"
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              isSending={isSending}
              placeholder={t("helpPlaceholder")}
              variant="demo"
              headerAction={
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleReset}
                    className="p-1.5 rounded-xl hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                    title={t("helpReset")}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#A39B90] hover:text-[#FF7E47]" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                    title={t("helpClose")}
                  >
                    <X className="w-3.5 h-3.5 text-[#A39B90] hover:text-[#FF7E47]" />
                  </button>
                </div>
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
