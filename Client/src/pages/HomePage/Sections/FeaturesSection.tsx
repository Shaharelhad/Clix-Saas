import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  MessageSquare,
  Zap,
  Rocket,
  Sparkles,
  Clock,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { key: "feature1", icon: Zap },
  { key: "feature2", icon: MessageSquare },
  { key: "feature3", icon: Rocket },
  { key: "feature4", icon: Sparkles },
  { key: "feature5", icon: Clock },
  { key: "feature6", icon: PenLine },
];

const ORANGE = "#FF6B2C";

const FeaturesSection = () => {
  const { t } = useTranslation("landing");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="features"
      className="relative min-h-dvh flex flex-col justify-center py-24 px-6 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)" }}
    >
      {/* Floating geometric accents */}
      <motion.div
        className="absolute top-[15%] left-[3%] w-6 h-6 rounded-full border-2 border-[#FF6B2C]/25"
        animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[10%] right-[4%] w-5 h-5 border-2 border-[#FF6B2C]/30 rotate-45"
        animate={{ y: [0, -12, 0], rotate: [45, 50, 45] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute top-[60%] right-[2%] w-3 h-3 rounded-full bg-[#FF6B2C]/25"
        animate={{ y: [0, 8, 0], opacity: [0.25, 0.6, 0.25] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      />

      <div ref={ref} className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <motion.span
            className="text-sm font-bold tracking-wider uppercase mb-3 block"
            style={{ color: ORANGE }}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {t("whyClix")}
          </motion.span>
          <motion.h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-4"
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {t("whyClixTitle")}
          </motion.h2>
          <motion.p
            className="text-gray-500 text-lg max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {t("whyClixDesc")}
          </motion.p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {FEATURES.map(({ key, icon: Icon }, index) => {
            const isLarge = index < 2;
            return (
              <motion.div
                key={key}
                className={cn(
                  "p-5 sm:p-8 relative overflow-hidden cursor-default rounded-[1.25rem]",
                  "border border-white/60 hover:border-[#FF6B2C]/40",
                  "transition-[border-color,box-shadow] duration-150",
                  "hover:shadow-[0_12px_40px_rgba(0,0,0,0.12),0_4px_16px_rgba(255,107,44,0.08)]",
                  isLarge ? "col-span-2" : "col-span-2 sm:col-span-1",
                )}
                style={{
                  background: "rgba(255, 255, 255, 0.7)",
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
                }}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                whileHover={{ y: -6 }}
                transition={{
                  duration: 0.6,
                  delay: inView ? 0.25 + index * 0.08 : 0,
                  ease: [0.22, 1, 0.36, 1],
                  y: { duration: 0.2, ease: "easeOut" },
                }}
              >
                {/* Orange accent bar at top */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#FF6B2C]/30 to-transparent" />

                {/* Decorative accent in large cards */}
                {isLarge && (
                  <div className="absolute top-4 left-4 w-4 h-4 border border-[#FF6B2C]/15 rotate-45 pointer-events-none" />
                )}

                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${ORANGE}15, ${ORANGE}30)`,
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color: ORANGE }} />
                </div>
                <h3 className="text-[#1A1A1A] font-bold text-base mb-2">
                  {t(key)}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {t(`${key}Desc`)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

    </section>
  );
};

export default FeaturesSection;
