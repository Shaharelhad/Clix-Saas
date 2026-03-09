import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Bot, RotateCcw, X, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { callFlowDemo } from "@/services/edge-functions";
import ChatPanel, { type ChatMessage } from "@/pages/CreateBotPage/Sections/ChatPanel";

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

interface FlowPreviewSimulatorProps {
  workflowId: string | null;
}

export default function FlowPreviewSimulator({ workflowId }: FlowPreviewSimulatorProps) {
  const { t } = useTranslation("flow");
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "greeting", role: "bot", text: t("previewGreeting"), time: nowStamp() },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<Record<string, unknown> | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending || !workflowId) return;

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text, time: nowStamp() },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const result = await callFlowDemo({
        user_id: user?.id ?? "",
        workflow_id: workflowId,
        message: text,
        ...(conversationId ? { conversation_id: conversationId } : {}),
        ...(sessionState ? { session_state: sessionState } : {}),
      });

      if (result.error) throw new Error(result.error);

      const data = result.data as {
        responses?: { type: string; content: string; imageUrl?: string; buttons?: { id: string; label: string }[] }[];
        response?: string;
        conversation_id?: string;
        flow_completed?: boolean;
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
        }));
        setMessages((prev) => [...prev, ...botMessages]);
      } else if (data?.response) {
        // Fallback to single response format
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
          text: err instanceof Error ? err.message : "Error",
          time: nowStamp(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, user?.id, workflowId, conversationId, sessionState]);

  const handleReset = () => {
    setMessages([
      { id: "greeting", role: "bot", text: t("previewGreeting"), time: nowStamp() },
    ]);
    setConversationId(null);
    setSessionState(null);
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
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{t("previewOpen")}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Preview panel */}
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
              title={t("previewTitle")}
              icon={<Bot className="w-4 h-4 text-[#FF7E47]" />}
              statusText={t("previewStatus")}
              statusColor="emerald"
              messages={messages}
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              isSending={isSending}
              placeholder={t("previewPlaceholder")}
              variant="demo"
              headerAction={
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleReset}
                    className="p-1.5 rounded-xl hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                    title={t("previewReset")}
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#A39B90] hover:text-[#FF7E47]" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                    title={t("previewClose")}
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
