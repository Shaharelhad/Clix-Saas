import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Pencil, Trash2, Send, Bot, ArrowLeft } from "lucide-react";

interface PreviewSectionProps {
  onNext: () => void;
}

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
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

const PreviewSection = ({ onNext }: PreviewSectionProps) => {
  const { t } = useTranslation("createBot");
  const [leftInput, setLeftInput] = useState("");
  const [rightInput, setRightInput] = useState("");

  const now = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6 pt-4"
    >
      {/* ── Header with actions ── */}
      <motion.div
        variants={fadeUp}
        className="flex items-center justify-between"
      >
        <h2 className="text-xl font-bold text-[#2D2A26] flex items-center gap-2">
          {t("previewChangeTitle")}
          <motion.button
            whileHover={{ scale: 1.1, rotate: 8 }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-lg hover:bg-[#FF7E47]/10 transition-colors"
          >
            <Pencil className="w-4 h-4 text-[#FF7E47]" />
          </motion.button>
        </h2>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-2 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4 text-[#A39B90] hover:text-red-400 transition-colors" />
        </motion.button>
      </motion.div>

      {/* ── Chat Container ── */}
      <motion.div
        variants={fadeUp}
        className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_24px_rgba(45,42,38,0.05)] border border-[#EDE6DD]/50"
      >
        {/* Chat header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#EDE6DD]/40">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-[#FF7E47]/15 flex items-center justify-center">
              <Bot className="w-5 h-5 text-[#FF7E47]" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
          </div>
          <span className="font-bold text-[#2D2A26] text-sm">
            {t("chatbotDemo")}
          </span>
        </div>

        {/* Chat messages area */}
        <div
          className="p-6 min-h-[320px] flex flex-col gap-4"
          style={{
            background:
              "linear-gradient(180deg, #FDFBF8 0%, #FAF7F3 100%)",
          }}
        >
          {/* Bot message (start side) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[75%] self-start"
          >
            <div className="bg-[#2D2A26] text-white rounded-2xl rounded-ss-sm px-5 py-4 shadow-sm">
              <p className="text-sm leading-relaxed font-medium">
                {t("botMessage")}
              </p>
            </div>
            <span className="text-[10px] text-[#B8AFA4] mt-1.5 block px-1">
              {now}
            </span>
          </motion.div>

          {/* System message (end side) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-[65%] self-end"
          >
            <div className="bg-[#FF7E47]/10 text-[#4A4640] rounded-2xl rounded-ee-sm px-5 py-4 border border-[#FF7E47]/15">
              <p className="text-sm leading-relaxed font-medium">
                {t("systemMessage")}
              </p>
            </div>
            <span className="text-[10px] text-[#B8AFA4] mt-1.5 block text-end px-1">
              {now}
            </span>
          </motion.div>
        </div>

        {/* Input bar */}
        <div className="px-4 py-4 border-t border-[#EDE6DD]/40 bg-white">
          <div className="flex gap-3">
            {/* Left input */}
            <div className="flex-1 relative">
              <input
                type="text"
                dir="ltr"
                value={leftInput}
                onChange={(e) => setLeftInput(e.target.value)}
                placeholder={t("typeMessage")}
                className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-4 py-3 pe-11 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200"
              />
              <button className="absolute top-1/2 -translate-y-1/2 end-2 p-1.5 rounded-lg bg-[#FF7E47] hover:bg-[#E86B38] transition-colors">
                <Send className="w-3.5 h-3.5 text-white rtl:-scale-x-100" />
              </button>
            </div>

            {/* Right input */}
            <div className="flex-1 relative">
              <input
                type="text"
                dir="ltr"
                value={rightInput}
                onChange={(e) => setRightInput(e.target.value)}
                placeholder={t("typeMessage")}
                className="w-full bg-[#FAF7F3] border border-[#E5DDD3] rounded-xl px-4 py-3 pe-11 text-sm text-[#2D2A26] placeholder-[#B8AFA4] focus:border-[#FF7E47] focus:ring-2 focus:ring-[#FF7E47]/15 outline-none transition-all duration-200"
              />
              <button className="absolute top-1/2 -translate-y-1/2 end-2 p-1.5 rounded-lg bg-[#FF7E47] hover:bg-[#E86B38] transition-colors">
                <Send className="w-3.5 h-3.5 text-white rtl:-scale-x-100" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Let's Go Button ── */}
      <motion.div variants={fadeUp} className="flex justify-center pt-4 pb-4">
        <motion.button
          onClick={onNext}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#FF7E47] hover:bg-[#E86B38] text-white font-bold text-lg rounded-2xl px-14 py-4 transition-all duration-300 shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)]"
        >
          {t("letsGo")}
          <ArrowLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180 transition-transform group-hover:ltr:-translate-x-1 group-hover:rtl:translate-x-1" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default PreviewSection;
