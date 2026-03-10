import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface WizardNavigatorProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  showBack?: boolean;
  isSubmit?: boolean;
}

const WizardNavigator = ({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  nextDisabled = false,
  showBack = true,
  isSubmit = false,
}: WizardNavigatorProps) => {
  const { t, i18n } = useTranslation("createBot");
  const isRTL = i18n.language === "he";
  const useProgressBar = totalSteps > 10;

  return (
    <div className="flex items-center justify-between gap-4 w-full max-w-lg mx-auto pt-8">
      {/* Back button */}
      <div className="w-12">
        {showBack && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="w-11 h-11 rounded-full border border-[#E5DDD3] bg-white flex items-center justify-center text-[#7A7267] hover:border-[#FF7E47] hover:text-[#FF7E47] transition-colors duration-200 shadow-sm cursor-pointer"
          >
            {isRTL ? (
              <ArrowRight className="w-4.5 h-4.5" />
            ) : (
              <ArrowLeft className="w-4.5 h-4.5" />
            )}
          </motion.button>
        )}
      </div>

      {/* Dot indicators or progress bar */}
      <div className="flex-1 flex items-center justify-center">
        {useProgressBar ? (
          <div className="w-full max-w-[200px] h-1.5 rounded-full bg-[#EDE6DD] overflow-hidden">
            <motion.div
              className="h-full bg-[#FF7E47] rounded-full"
              initial={false}
              animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const isActive = i === currentStep;
              const isCompleted = i < currentStep;
              return (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{
                    width: isActive ? 10 : 7,
                    height: isActive ? 10 : 7,
                    backgroundColor: isActive
                      ? "#FF7E47"
                      : isCompleted
                        ? "rgba(255,126,71,0.45)"
                        : "#DDD5CA",
                  }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-full"
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Next / Submit button */}
      <motion.button
        type="button"
        whileHover={nextDisabled ? undefined : { scale: 1.03 }}
        whileTap={nextDisabled ? undefined : { scale: 0.97 }}
        onClick={onNext}
        disabled={nextDisabled}
        className={cn(
          "inline-flex items-center gap-2 font-bold text-sm rounded-xl px-6 py-3 transition-all duration-200 cursor-pointer",
          isSubmit
            ? "bg-[#FF7E47] hover:bg-[#E86B38] text-white shadow-[0_4px_20px_rgba(255,126,71,0.3)] hover:shadow-[0_6px_28px_rgba(255,126,71,0.4)]"
            : "bg-[#6C5CE7] hover:bg-[#5A4BD6] text-white shadow-[0_4px_20px_rgba(108,92,231,0.25)]",
          nextDisabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {isSubmit ? (
          <>
            {t("createBotBtn")}
            <Sparkles className="w-4 h-4" />
          </>
        ) : (
          <>
            {t("nextStep")}
            {isRTL ? (
              <ArrowLeft className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </>
        )}
      </motion.button>
    </div>
  );
};

export default WizardNavigator;
