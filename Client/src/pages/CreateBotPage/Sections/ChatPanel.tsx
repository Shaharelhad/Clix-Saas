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
  buttonText?: string;
  sections?: { title?: string; rows: { rowId: string; title: string; description?: string }[] }[];
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
  /** Right-side header action (cog/settings, etc.). Demo variant only. */
  headerAction?: ReactNode;
  /** Left-side header action (refresh, etc.). Demo variant only. */
  headerLeading?: ReactNode;
  variant?: "demo" | "edit";
  className?: string;
  onButtonClick?: (label: string) => void;
  clickedMessageIds?: Set<string>;
}

/* ─────────────────────── Animation config ──────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ═══════════════════════ TYPING INDICATOR ═══════════════════ */

function TypingIndicator({ variant = "demo" }: { variant?: "demo" | "edit" }) {
  const dotColor = variant === "edit" ? "bg-[var(--brand-primary-light)]/60" : "bg-[#B8AFA4]";
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
      ? "bg-white/70 text-slate-600 border border-[var(--brand-primary)]/10 italic shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
      : "bg-slate-900 text-white";

  const userBg =
    variant === "edit"
      ? "bg-[#0F172A] text-white"
      : "bg-[var(--brand-primary-light)]/10 text-[#4A4640] border border-[var(--brand-primary-light)]/15";

  // Edit variant: roomier card, no sharp corner (matches inspiration's full-width AI greeting card).
  // Demo variant: WhatsApp-style bubble with a sharp corner toward the speaker side.
  const isEdit = variant === "edit";
  const bubblePadding = isEdit ? "p-5" : "p-4";
  const bubbleCorner = isEdit
    ? ""
    : isBot
      ? "rounded-ss-none"
      : "rounded-ee-none";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`${isEdit ? "w-full" : `max-w-[82%] ${isBot ? "self-start" : "self-end"}`}`}
    >
      <div
        className={`${isBot ? botBg : userBg} rounded-2xl ${bubbleCorner} ${bubblePadding} shadow-sm overflow-hidden`}
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
                className={`text-xs px-3.5 py-1.5 rounded-full border transition-all cursor-pointer font-medium ${
                  buttonsDisabled
                    ? "bg-white border-slate-200 text-slate-500 opacity-55 cursor-default"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
        {/* List sections — tappable rows grouped by section, mirrors WhatsApp's
            bottom-sheet behavior. Row click sends the row's title as the user
            message (matched by matchRow on the backend). */}
        {msg.sections && msg.sections.length > 0 && (
          <div className="mt-3 -mx-1">
            {msg.buttonText && (
              <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1.5 px-1">
                ▾ {msg.buttonText}
              </p>
            )}
            <div className="flex flex-col gap-2">
              {msg.sections.map((section, sIdx) => (
                <div key={`section-${sIdx}`} className="flex flex-col gap-1">
                  {section.title && (
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 px-1 mt-1">
                      {section.title}
                    </p>
                  )}
                  {section.rows.map((row) => (
                    <button
                      type="button"
                      key={row.rowId}
                      onClick={() => onButtonClick?.(row.title)}
                      disabled={buttonsDisabled}
                      className={`text-start px-3 py-2 rounded-lg border transition-all w-full ${
                        buttonsDisabled
                          ? "bg-white/90 border-slate-200 text-slate-500 opacity-55 cursor-default"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] cursor-pointer"
                      }`}
                    >
                      <span className="text-xs font-medium block leading-tight">{row.title}</span>
                      {row.description && (
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                          {row.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Edit variant: timestamp lives inside the card (matches inspiration's
            in-card "PM 11:38" footer line on the AI greeting). */}
        {isEdit && (
          <div className="mt-3 text-[10px] text-slate-400 not-italic font-medium text-end">
            {msg.time}
          </div>
        )}
      </div>
      {!isEdit && (
        <span
          className={`text-[10px] text-[#B8AFA4] mt-1 block px-1 ${isBot ? "text-start" : "text-end"}`}
        >
          {msg.time}
        </span>
      )}
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
  headerLeading,
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
  const accentColor = isEdit ? "var(--brand-primary-light)" : "var(--brand-primary-light)";
  const headerBorder = isEdit
    ? "border-[var(--brand-primary-light)]/10"
    : "border-[#EDE6DD]/40";
  const statusDotColor = statusColor === "emerald"
    ? "bg-emerald-400"
    : `bg-[${accentColor}]`;
  const statusTextColor = statusColor === "emerald"
    ? "text-emerald-500"
    : "text-[var(--brand-primary-light)]";

  return (
    <div
      className={`flex flex-col rounded-2xl overflow-hidden shadow-[0_2px_28px_rgba(45,42,38,0.06)] border h-full ${className} ${
        isEdit
          ? "border-[var(--brand-primary)]/12"
          : "bg-white border-slate-200"
      }`}
      style={
        isEdit
          ? { background: "rgba(var(--brand-primary-rgb), 0.045)" }
          : undefined
      }
    >
      {/* Header */}
      {isEdit ? (
        <div className="flex items-center px-5 py-4 shrink-0">
          <div className="flex-1" />
          <div className="text-center">
            <span
              className="font-bold text-slate-800 text-[13px] block leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em] mt-1 block"
              style={{ color: "var(--brand-primary)" }}
            >
              {statusText}
            </span>
          </div>
          <div className="flex-1 flex justify-end">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: "rgba(var(--brand-primary-rgb), 0.08)",
                color: "var(--brand-primary)",
              }}
            >
              {icon}
            </div>
          </div>
        </div>
      ) : (
        // Demo variant: 3-section header (leading action | centered title | trailing action)
        // matching the inspiration's "Test Your Bot" layout.
        <div
          className={`flex items-center px-4 sm:px-5 py-3.5 border-b ${headerBorder} shrink-0 gap-2`}
        >
          <div className="flex-1 flex items-center">
            {headerLeading}
          </div>
          <div className="text-center">
            <span
              className="font-bold text-slate-800 text-[13px] block leading-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </span>
            <span className="flex items-center justify-center gap-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
              <span
                className={`text-[10px] font-bold uppercase tracking-tight ${statusTextColor}`}
              >
                {statusText}
              </span>
            </span>
          </div>
          <div className="flex-1 flex items-center justify-end">
            {headerAction}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 px-4 sm:px-5 py-4 overflow-y-auto flex flex-col gap-2.5 scroll-smooth min-h-[320px] max-h-[420px]"
        style={{
          background: isEdit ? "transparent" : "#ffffff",
          scrollbarWidth: "thin",
          scrollbarColor: isEdit
            ? "rgba(var(--brand-primary-rgb), 0.25) transparent"
            : "#d4d4d8 transparent",
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
              className={`${isEdit ? "bg-[var(--brand-primary-light)]/8 border border-[var(--brand-primary-light)]/10" : "bg-[#2D2A26]"} rounded-2xl rounded-ss-sm shadow-sm`}
            >
              <TypingIndicator variant={variant} />
            </div>
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div
        className={`px-3 sm:px-4 py-3 shrink-0 ${
          isEdit ? "" : `border-t ${headerBorder} bg-white`
        }`}
      >
        <div className="flex-1 relative">
          {/* Leading brand-tinted decorative chip — both variants get one to
              match the inspiration's "send chip" placement on the input start. */}
          <div
            className="absolute top-1/2 -translate-y-1/2 start-1.5 p-2 rounded-lg pointer-events-none z-10"
            style={{
              background: "rgba(var(--brand-primary-rgb), 0.1)",
              color: "var(--brand-primary)",
            }}
          >
            <Send className="w-3.5 h-3.5 rtl:-scale-x-100" strokeWidth={2.5} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            placeholder={placeholder}
            className={`w-full border rounded-xl py-3 ps-12 pe-12 text-sm text-[#2D2A26] placeholder-[#B8AFA4] outline-none transition-all duration-200 disabled:opacity-50 ${
              isEdit
                ? "bg-white border-[var(--brand-primary)]/15 focus:border-[var(--brand-primary)]/40 focus:ring-2 focus:ring-[var(--brand-primary)]/15 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                : "bg-slate-50 border-slate-200 focus:border-[var(--brand-primary)]/40 focus:ring-2 focus:ring-[var(--brand-primary)]/15"
            }`}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            onClick={onSend}
            disabled={!input.trim() || isSending}
            aria-label="Send"
            className={`absolute top-1/2 -translate-y-1/2 end-1.5 p-1.5 rounded-lg transition-all duration-200 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed ${
              isEdit
                ? "bg-[var(--brand-primary)] hover:brightness-90"
                : "bg-[var(--brand-primary-light)] hover:brightness-90"
            }`}
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
  );
};

export default ChatPanel;
export { TypingIndicator, ChatBubble };
