import { useRef, useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";

/* ─────────────────────────── Types ─────────────────────────── */

export interface ChatMessage {
  id: string;
  role: "bot" | "user";
  text: string;
  time: string;
  imageUrl?: string;
  buttons?: { id: string; label: string }[];
  header?: string;
  footer?: string;
}

interface ChatPanelProps {
  title: string;
  icon: ReactNode;
  statusText: string;
  statusColor?: string;
  messages: ChatMessage[];
  input: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  isSending: boolean;
  placeholder: string;
  headerAction?: ReactNode;
  variant?: "demo" | "edit";
  className?: string;
  onButtonClick?: (label: string) => void;
  clickedMessageIds?: Set<string>;
}

/* ─────────────────────── Animation config ──────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ═══════════════════════ TYPING INDICATOR ═══════════════════ */

function TypingIndicator({ variant = "demo" }: { variant?: "demo" | "edit" }) {
  const dotColor = variant === "edit" ? "bg-[#FF7E47]/60" : "bg-[#B8AFA4]";
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
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

function ChatBubble({
  msg,
  variant = "demo",
  onButtonClick,
  buttonsDisabled,
}: {
  msg: ChatMessage;
  variant?: "demo" | "edit";
  onButtonClick?: (label: string) => void;
  buttonsDisabled?: boolean;
}) {
  const isBot = msg.role === "bot";

  const botBg =
    variant === "edit"
      ? "bg-gradient-to-br from-[#FF7E47]/8 to-[#FF7E47]/4 text-[#3D3730] border border-[#FF7E47]/12"
      : "bg-[#2D2A26] text-white";

  const userBg =
    variant === "edit"
      ? "bg-[#2D2A26] text-white"
      : "bg-[#FF7E47]/10 text-[#4A4640] border border-[#FF7E47]/15";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`max-w-[82%] ${isBot ? "self-start" : "self-end"}`}
    >
      <div
        className={`${isBot ? botBg : userBg} rounded-2xl ${isBot ? "rounded-ss-sm" : "rounded-ee-sm"} px-4 py-3 shadow-sm overflow-hidden`}
      >
        {/* Image */}
        {msg.imageUrl && (
          <img
            src={msg.imageUrl}
            alt=""
            className="rounded-lg max-h-[180px] w-full object-cover mb-2 -mx-4 -mt-3 px-0"
            style={{ width: "calc(100% + 2rem)", maxWidth: "calc(100% + 2rem)", marginLeft: "-1rem", marginRight: "-1rem", marginTop: "-0.75rem" }}
          />
        )}
        {/* Header */}
        {msg.header && <p className="text-sm font-bold leading-relaxed">{msg.header}</p>}
        {/* Text */}
        {msg.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
        {/* Footer */}
        {msg.footer && <p className="text-[11px] opacity-60 mt-1">{msg.footer}</p>}
        {/* Buttons */}
        {msg.buttons && msg.buttons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {msg.buttons.map((btn) => (
              <button
                type="button"
                key={btn.id}
                onClick={() => onButtonClick?.(btn.label)}
                disabled={buttonsDisabled}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                  buttonsDisabled
                    ? "bg-amber-50/50 border-amber-200/50 text-amber-400 cursor-default"
                    : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 active:scale-95"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <span
        className={`text-[10px] text-[#B8AFA4] mt-1 block px-1 ${isBot ? "text-start" : "text-end"}`}
      >
        {msg.time}
      </span>
    </motion.div>
  );
}

/* ═══════════════════════ CHAT PANEL ═════════════════════════ */

const ChatPanel = ({
  title,
  icon,
  statusText,
  statusColor = "emerald",
  messages,
  input,
  onInputChange,
  onSend,
  isSending,
  placeholder,
  headerAction,
  variant = "demo",
  className = "",
  onButtonClick,
  clickedMessageIds,
}: ChatPanelProps) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const isEdit = variant === "edit";
  const accentColor = isEdit ? "#FF7E47" : "#FF7E47";
  const headerBorder = isEdit
    ? "border-[#FF7E47]/10"
    : "border-[#EDE6DD]/40";
  const statusDotColor = statusColor === "emerald"
    ? "bg-emerald-400"
    : `bg-[${accentColor}]`;
  const statusTextColor = statusColor === "emerald"
    ? "text-emerald-500"
    : "text-[#FF7E47]";

  return (
    <div
      className={`flex flex-col bg-white rounded-2xl overflow-hidden shadow-[0_2px_28px_rgba(45,42,38,0.06)] border ${isEdit ? "border-[#FF7E47]/15" : "border-[#EDE6DD]/50"} h-full ${className}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 sm:px-5 py-3 border-b ${headerBorder} shrink-0`}
        style={
          isEdit
            ? { background: "linear-gradient(135deg, #FFF8F4 0%, #FFFAF7 100%)" }
            : undefined
        }
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${isEdit ? "bg-gradient-to-br from-[#FF7E47]/20 to-[#FF7E47]/10" : "bg-[#FF7E47]/12"}`}
            >
              {icon}
            </div>
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className={`absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full ${statusDotColor} border-2 border-white`}
            />
          </div>
          <div>
            <span className="font-bold text-[#2D2A26] text-[13px] block leading-tight">
              {title}
            </span>
            <span className={`text-[10px] ${statusTextColor} font-medium`}>
              {statusText}
            </span>
          </div>
        </div>
        {headerAction}
      </div>

      {/* Messages */}
      <div
        className="flex-1 px-4 sm:px-5 py-4 overflow-y-auto flex flex-col gap-2.5 scroll-smooth min-h-[320px] max-h-[420px]"
        style={{
          background: isEdit
            ? "linear-gradient(180deg, #FFFAF7 0%, #FFF6F0 50%, #FFFBF8 100%)"
            : "linear-gradient(180deg, #FDFBF8 0%, #FAF7F3 100%)",
          scrollbarWidth: "thin",
          scrollbarColor: isEdit
            ? "#FFD4BD transparent"
            : "#E5DDD3 transparent",
        }}
      >
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            variant={variant}
            onButtonClick={onButtonClick}
            buttonsDisabled={clickedMessageIds?.has(msg.id)}
          />
        ))}

        {isSending && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="self-start max-w-[80%]"
          >
            <div
              className={`${isEdit ? "bg-[#FF7E47]/8 border border-[#FF7E47]/10" : "bg-[#2D2A26]"} rounded-2xl rounded-ss-sm shadow-sm`}
            >
              <TypingIndicator variant={variant} />
            </div>
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div
        className={`px-3 sm:px-4 py-3 border-t ${headerBorder} bg-white shrink-0`}
      >
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              placeholder={placeholder}
              className={`w-full border rounded-xl px-3.5 py-2.5 pe-11 text-sm text-[#2D2A26] placeholder-[#B8AFA4] outline-none transition-all duration-200 disabled:opacity-50 ${
                isEdit
                  ? "bg-[#FFF8F4] border-[#FFD4BD]/60 focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15"
                  : "bg-[#FAF7F3] border-[#E5DDD3] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15"
              }`}
            />
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.9 }}
              onClick={onSend}
              disabled={!input.trim() || isSending}
              className="absolute top-1/2 -translate-y-1/2 end-1.5 p-1.5 rounded-lg bg-[#FF7E47] hover:bg-[#E86B38] transition-all duration-200 disabled:opacity-40 disabled:hover:bg-[#FF7E47] cursor-pointer disabled:cursor-not-allowed"
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
    </div>
  );
};

export default ChatPanel;
export { TypingIndicator, ChatBubble };
