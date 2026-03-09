import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useDraftStatus } from "@/hooks/useDraftStatus";
import { callBotEditRequest } from "@/services/edge-functions";
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

interface EditBotSectionProps {
  onEditApplied?: () => void;
}

export default function EditBotSection({ onEditApplied }: EditBotSectionProps) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasDraft } = useDraftStatus();

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

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: `edit-user-${Date.now()}`,
      role: "user",
      text,
      time: nowStamp(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

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
        data?.summary ||
        data?.proposed_changes ||
        data?.message ||
        t("editBotSuccess");

      const botMsg: ChatMessage = {
        id: `edit-bot-${Date.now()}`,
        role: "bot",
        text: responseText,
        time: nowStamp(),
      };

      setMessages((prev) => [...prev, botMsg]);
      queryClient.invalidateQueries({ queryKey: ["draft-status"] });
      onEditApplied?.();
    } catch (err) {
      const botMsg: ChatMessage = {
        id: `edit-bot-err-${Date.now()}`,
        role: "bot",
        text: err instanceof Error ? err.message : t("editBotError"),
        time: nowStamp(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, user?.id, t, onEditApplied, queryClient]);

  return (
    <motion.div variants={fadeUp} className="flex flex-col h-full gap-3">
      {/* ── Chat Panel ── */}
      <ChatPanel
        title={t("editBotTitle")}
        icon={<Sparkles className="w-4 h-4 text-[#FF7E47]" />}
        statusText={hasDraft ? t("draftIndicator") : t("editBotStatus")}
        statusColor={hasDraft ? "amber" : "orange"}
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
