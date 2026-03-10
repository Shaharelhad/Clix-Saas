import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAutoPublish } from "@/hooks/useAutoPublish";
import { callBotEditRequest } from "@/services/edge-functions";
import { fadeUp } from "@/lib/animations";
import ChatPanel, {
  type ChatMessage,
} from "@/pages/CreateBotPage/Sections/ChatPanel";

/* ─────────────────────── Helpers ──────────────────── */

function nowStamp() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function createChatMsg(idPrefix: string, role: ChatMessage["role"], text: string): ChatMessage {
  return { id: `${idPrefix}-${Date.now()}`, role, text, time: nowStamp() };
}

interface EditResponseData {
  summary?: string;
  proposed_changes?: string;
  message?: string;
}

function extractResponseText(data: EditResponseData | null, fallback: string): string {
  return data?.summary || data?.proposed_changes || data?.message || fallback;
}

/* ═══════════════════════ MAIN COMPONENT ════════════════════ */

interface EditBotSectionProps {
  onEditApplied?: () => void;
}

export default function EditBotSection({ onEditApplied }: EditBotSectionProps) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { autoPublish } = useAutoPublish();

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "edit-greeting",
      role: "bot",
      text: t("editBotGreeting"),
      time: nowStamp(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const appendMsg = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    appendMsg(createChatMsg("edit-user", "user", text));
    setInput("");
    setIsSending(true);

    try {
      const result = await callBotEditRequest({
        user_id: user?.id ?? "",
        edit_request: text,
      });
      if (result.error) throw new Error(result.error);

      const data = result.data as EditResponseData | null;
      appendMsg(createChatMsg("edit-bot", "bot", extractResponseText(data, t("editBotSuccess"))));
      await autoPublish();
      onEditApplied?.();
    } catch (err) {
      const errText = err instanceof Error ? err.message : t("editBotError");
      appendMsg(createChatMsg("edit-bot-err", "bot", errText));
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, user?.id, t, onEditApplied, autoPublish]);

  return (
    <motion.div variants={fadeUp} className="flex flex-col h-full gap-3">
      {/* ── Chat Panel ── */}
      <ChatPanel
        title={t("editBotTitle")}
        icon={<Sparkles className="w-4 h-4 text-[#FF7E47]" />}
        statusText={t("editBotStatus")}
        statusColor="orange"
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        isSending={isSending}
        placeholder={t("editBotPlaceholder")}
        variant="edit"
      />
    </motion.div>
  );
}
