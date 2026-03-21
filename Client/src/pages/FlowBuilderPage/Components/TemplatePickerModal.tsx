import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { FLOW_TEMPLATES } from "@/data/flow-templates";

interface TemplatePickerModalProps {
  onSelect: (templateId: string) => void;
  /** When provided, renders as a modal overlay with a close button instead of full-page */
  onClose?: () => void;
}

export default function TemplatePickerModal({ onSelect, onClose }: TemplatePickerModalProps) {
  const { t } = useTranslation("flow");
  const isModal = !!onClose;

  const content = (
    <div className={isModal ? "max-w-2xl w-full px-6 py-8" : "max-w-2xl w-full px-6"}>
      {/* Header */}
      <div className="text-center mb-8">
        {isModal && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 start-4 p-2 rounded-lg hover:bg-[#EDE6DD]/40 cursor-pointer"
          >
            <X className="w-5 h-5 text-[#7A7267]" />
          </button>
        )}
        <h1 className={`font-bold text-[#2D2A26] mb-2 ${isModal ? "text-xl" : "text-2xl"}`}>
          {t("templatePickerTitle")}
        </h1>
        <p className="text-sm text-[#A39B90]">
          {t("templatePickerSubtitle")}
        </p>
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-4">
        {FLOW_TEMPLATES.map((template, i) => {
          const Icon = template.icon;
          const nodeCount = template.flowJson.nodes.length;
          const isBlank = template.id === "blank";

          return (
            <motion.button
              type="button"
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              onClick={() => onSelect(template.id)}
              className={`group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all cursor-pointer text-center ${
                isBlank
                  ? "border-dashed border-[#EDE6DD] hover:border-[#A39B90] bg-white/50"
                  : "border-[#EDE6DD]/60 hover:border-[#FF7E47]/50 hover:shadow-md bg-white"
              }`}
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  isBlank
                    ? "bg-[#EDE6DD]/40 group-hover:bg-[#EDE6DD]/60"
                    : "bg-[#FFF5F0] group-hover:bg-[#FFE8DC]"
                }`}
              >
                <Icon
                  className={`w-6 h-6 ${
                    isBlank
                      ? "text-[#A39B90] group-hover:text-[#7A7267]"
                      : "text-[#FF7E47]"
                  }`}
                />
              </div>

              {/* Name */}
              <span className="text-sm font-bold text-[#2D2A26]">
                {t(template.nameKey)}
              </span>

              {/* Description */}
              <span className="text-xs text-[#A39B90] leading-relaxed">
                {t(template.descKey)}
              </span>

              {/* Step count badge */}
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  isBlank
                    ? "bg-[#EDE6DD]/50 text-[#A39B90]"
                    : "bg-[#FFF5F0] text-[#FF7E47]"
                }`}
              >
                {t("templateSteps", { count: nodeCount })}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );

  // Modal overlay mode
  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        dir="rtl"
        onClick={onClose}
      >
        <div
          className="relative bg-[#FAF7F3] rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    );
  }

  // Full-page mode (first visit)
  return (
    <div className="h-[calc(100vh-3.5rem)] flex items-center justify-center bg-[#FAF7F3]" dir="rtl">
      {content}
    </div>
  );
}
