import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ_KEYS = [1, 2, 3, 4, 5];

const FaqSection = () => {
  const { t } = useTranslation("landing");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="faq"
      className="relative min-h-dvh flex flex-col justify-center py-24 px-6 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #FBF5EE 0%, #F8F0E6 60%, #FDF8F2 100%)" }}
    >
      {/* Decorative side shapes — desktop only */}
      <motion.div
        className="hidden lg:block absolute top-[20%] left-[5%] w-5 h-5 border-2 border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, -12, 0], rotate: [45, 50, 45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="hidden lg:block absolute top-[40%] left-[4%] w-6 h-6 rounded-full border border-[#FF6B2C]/20"
        animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.div
        className="hidden lg:block absolute top-[60%] left-[6%] w-2 h-2 rounded-full bg-[#FF6B2C]/25"
        animate={{ y: [0, 8, 0], opacity: [0.25, 0.6, 0.25] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      <motion.div
        className="hidden lg:block absolute bottom-[25%] right-[4%] w-4 h-4 border border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, 10, 0], rotate: [45, 48, 45] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <div ref={ref} className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            className="text-[#FF6B2C] text-sm font-bold tracking-wider uppercase mb-3 block"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            {t("faqLabel")}
          </motion.span>
          <motion.h2
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#1A1A1A]"
            initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            {t("faqTitle")}
          </motion.h2>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {FAQ_KEYS.map((n, index) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: 0.2 + index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <AccordionItem
                value={`faq-${n}`}
                className="rounded-xl bg-white/60 backdrop-blur-sm border border-white/80 border-r-2 border-r-transparent shadow-[0_4px_16px_rgba(0,0,0,0.04)] px-4 sm:px-7 py-1 transition-all duration-300 data-[state=open]:border-r-[#FF6B2C] data-[state=open]:shadow-[0_8px_32px_rgba(255,107,44,0.08)]"
              >
                <AccordionTrigger className="text-[#1A1A1A] text-base sm:text-lg font-medium hover:no-underline hover:text-[#FF6B2C]/80 transition-colors">
                  {t(`faqQ${n}`)}
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 text-sm sm:text-base leading-relaxed">
                  {t(`faqA${n}`)}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FaqSection;
