import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Eye, Sparkles, HelpCircle, Workflow, Wrench, Palette, Plug } from "lucide-react";

const stagger = (i: number, base = 0.2) => base + i * 0.15;

const ProductPreviewSection = () => {
  const { t } = useTranslation("landing");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const sidebarItems = t("mockSidebar", { returnObjects: true }) as string[];
  const btnLabels = t("mockBtnLabels", { returnObjects: true }) as string[];
  const sidebarIcons = [Eye, Sparkles, HelpCircle, Sparkles, Workflow];

  return (
    <section
      className="relative min-h-dvh flex flex-col justify-center py-24 px-6 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FBF5EE 0%, #F8F0E6 60%, #FDF8F2 100%)" }}
    >
      {/* Floating geometric accents */}
      <motion.div
        className="absolute top-[10%] right-[4%] w-5 h-5 border-2 border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, -14, 0], rotate: [45, 50, 45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[12%] left-[3%] w-7 h-7 rounded-full border-2 border-[#FF6B2C]/15"
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.div
        className="absolute top-[50%] left-[2%] flex gap-2"
        animate={{ opacity: [0.15, 0.4, 0.15] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/40" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/25" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/12" />
      </motion.div>
      <motion.div
        className="absolute bottom-[20%] right-[3%] w-4 h-4 border border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, 10, 0], rotate: [45, 50, 45] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />

      {/* Section header */}
      <div ref={ref} className="max-w-5xl mx-auto text-center mb-14 relative z-10">
        <motion.h2
          className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3"
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="text-[#1A1A1A]">{t("howItWorks")}</span>
        </motion.h2>
        <motion.p
          className="text-gray-500 text-lg"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          {t("automationInMinutes")}
        </motion.p>
      </div>

      {/* Step indicators */}
      <motion.div
        className="flex items-center justify-center gap-4 sm:gap-8 mb-10 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {[
          { key: "step1", icon: Wrench },
          { key: "step2", icon: Palette },
          { key: "step3", icon: Plug },
        ].map((step, i) => (
          <div key={step.key} className="flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border border-[#FF6B2C]/30"
                style={{ background: "linear-gradient(135deg, rgba(255,107,44,0.08), rgba(255,107,44,0.18))" }}
              >
                <step.icon className="w-4.5 h-4.5 text-[#FF6B2C]" />
              </div>
              <span className="text-sm font-medium text-[#1A1A1A]/70">{t(step.key)}</span>
            </div>
            {i < 2 && (
              <div className="hidden sm:block w-8 h-px bg-[#FF6B2C]/20" />
            )}
          </div>
        ))}
      </motion.div>

      {/* Dashboard mockup — dark card on cream bg */}
      <motion.div
        className="max-w-6xl mx-auto relative z-10"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="bg-[#1A1510] rounded-2xl overflow-hidden border border-[#2A2318]/60 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B2C]/40" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B2C]/25" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B2C]/15" />
            <span className="text-[#FDF8F2]/25 text-xs mr-4 tracking-wider">
              CLIX Dashboard
            </span>
          </div>

          <div className="flex min-h-[420px]">
            {/* Sidebar */}
            <div className="hidden sm:flex flex-col w-48 border-l border-white/[0.06] bg-white/[0.02] p-3 gap-1">
              {sidebarItems.map((label, i) => {
                const Icon = sidebarIcons[i] ?? Sparkles;
                const isActive = i === 4;
                return (
                  <motion.div
                    key={i}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-[#FF6B2C]/15 text-[#FF6B2C]"
                        : "text-[#FDF8F2]/30 hover:text-[#FDF8F2]/50 hover:bg-white/[0.03]"
                    }`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: stagger(i, 0.4) }}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </motion.div>
                );
              })}
            </div>

            {/* Canvas area with n8n-style dotted grid */}
            <div
              className="flex-1 p-6 relative"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            >
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 justify-center h-full">
                {/* Start node */}
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: stagger(0, 0.5) }}
                >
                  <div className="w-28 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center backdrop-blur-sm">
                    <div className="text-[10px] text-[#FDF8F2]/35 mb-1">
                      {t("mockStart")}
                    </div>
                    <div className="text-xs text-[#FDF8F2]/65">שלום</div>
                  </div>
                  <div className="w-px h-6 bg-white/10 sm:hidden" />
                </motion.div>

                {/* Connector 1 */}
                <motion.div
                  className="hidden sm:block w-10 h-px bg-white/10 origin-left"
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={inView ? { scaleX: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.4, delay: stagger(1, 0.5) }}
                />

                {/* Text node */}
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: stagger(2, 0.5) }}
                >
                  <div className="w-36 rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center backdrop-blur-sm">
                    <div className="text-[10px] text-[#FDF8F2]/35 mb-1">
                      {t("mockTextMessage")}
                    </div>
                    <div className="text-xs text-[#FDF8F2]/65">
                      {t("mockGreeting")}
                    </div>
                  </div>
                  <div className="w-px h-6 bg-white/10 sm:hidden" />
                </motion.div>

                {/* Connector 2 */}
                <motion.div
                  className="hidden sm:block w-10 h-px bg-white/10 origin-left"
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={inView ? { scaleX: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.4, delay: stagger(3, 0.5) }}
                />

                {/* Buttons node — active with orange glow */}
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: stagger(4, 0.5) }}
                >
                  <motion.div
                    className="w-36 rounded-xl border border-[#FF6B2C]/30 bg-[#FF6B2C]/10 p-3 text-center backdrop-blur-sm"
                    animate={{
                      boxShadow: [
                        "0 0 20px rgba(255,107,44,0.08)",
                        "0 0 30px rgba(255,107,44,0.18)",
                        "0 0 20px rgba(255,107,44,0.08)",
                      ],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <div className="text-[10px] text-[#FF6B2C]/60 mb-1">
                      {t("mockButtons")}
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      {btnLabels.map((label, i) => (
                        <div
                          key={i}
                          className="text-[10px] text-[#FDF8F2]/45 bg-white/[0.05] rounded px-2 py-0.5"
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default ProductPreviewSection;
