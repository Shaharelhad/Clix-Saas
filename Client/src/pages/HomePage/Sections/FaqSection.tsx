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

  return (
    <section id="faq" className="py-20 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-[#FF6B2C] text-sm font-bold tracking-wider uppercase mb-3 block">
            {t("faqLabel")}
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
            {t("faqTitle")}
          </h2>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {FAQ_KEYS.map((n) => (
            <AccordionItem
              key={n}
              value={`faq-${n}`}
              className="rounded-xl border border-gray-200 bg-gray-50 px-5"
            >
              <AccordionTrigger className="text-gray-900 text-base sm:text-lg font-medium hover:no-underline">
                {t(`faqQ${n}`)}
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 text-sm sm:text-base leading-relaxed">
                {t(`faqA${n}`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FaqSection;
