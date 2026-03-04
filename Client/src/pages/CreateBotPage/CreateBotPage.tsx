import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FileText, Eye, Wifi, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import FormSection from "./Sections/FormSection";
import PreviewSection from "./Sections/PreviewSection";
import ConnectSection from "./Sections/ConnectSection";

const STEPS = [
  { id: "form", icon: FileText, labelKey: "stepForm" },
  { id: "preview", icon: Eye, labelKey: "stepPreview" },
  { id: "connect", icon: Wifi, labelKey: "stepConnect" },
] as const;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const CreateBotPage = () => {
  const { t, i18n } = useTranslation("createBot");
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set()
  );
  const isRTL = i18n.language === "he";

  const goToStep = (step: number) => {
    if (step === currentStep) return;
    // Allow going to completed steps or the next uncompleted step
    if (step > currentStep && !completedSteps.has(currentStep)) return;
    const dir = isRTL ? (step < currentStep ? 1 : -1) : step > currentStep ? 1 : -1;
    setDirection(dir);
    setCurrentStep(step);
  };

  const handleNext = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    if (currentStep < STEPS.length - 1) {
      setDirection(isRTL ? -1 : 1);
      setCurrentStep((s) => s + 1);
    }
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen font-secular-one relative overflow-hidden"
      style={{
        background:
          "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)",
      }}
    >
      {/* ── Decorative warm gradient orbs ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-30"
          style={{
            background:
              "radial-gradient(circle, rgba(255,126,71,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-60 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, rgba(255,180,120,0.12) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* ── Logout ── */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={async () => {
          await signOut();
          navigate("/");
        }}
        className="absolute top-4 start-4 z-20 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[#8C847A] backdrop-blur-xl transition-colors duration-200 hover:text-[#FF7E47] cursor-pointer"
        style={{
          background: "rgba(255,255,255,0.5)",
          border: "1px solid rgba(237,230,221,0.5)",
        }}
      >
        <div className="flex items-center gap-2">
          <LogOut className="w-4 h-4" />
          <span>{t("logout")}</span>
        </div>
      </motion.button>

      {/* ── Stepper ── */}
      <div className="relative z-10 pt-8 pb-4 flex justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-0 rounded-full px-2 py-2 backdrop-blur-xl"
          style={{
            background: "rgba(255,255,255,0.7)",
            boxShadow:
              "0 4px 30px rgba(45,42,38,0.06), 0 1px 3px rgba(45,42,38,0.04)",
            border: "1px solid rgba(237,230,221,0.6)",
          }}
        >
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isCompleted = completedSteps.has(i);
            const isClickable =
              isActive || isCompleted || (i === currentStep + 1 && completedSteps.has(currentStep));

            return (
              <div key={step.id} className="flex items-center">
                {/* Dashed connector */}
                {i > 0 && (
                  <div className="w-8 sm:w-14 mx-1 flex items-center">
                    <div
                      className={cn(
                        "w-full border-t-2 border-dashed transition-colors duration-500",
                        isCompleted || (i <= currentStep)
                          ? "border-[#FF7E47]/50"
                          : "border-[#DDD5CA]"
                      )}
                    />
                  </div>
                )}

                {/* Step pill */}
                <motion.button
                  onClick={() => isClickable ? goToStep(i) : undefined}
                  whileHover={isClickable ? { scale: 1.04 } : undefined}
                  whileTap={isClickable ? { scale: 0.97 } : undefined}
                  className={cn(
                    "relative flex items-center gap-2 rounded-full px-4 sm:px-5 py-2.5 text-sm font-bold transition-all duration-400",
                    isActive &&
                      "bg-[#FF7E47] text-white shadow-[0_2px_16px_rgba(255,126,71,0.35)]",
                    isCompleted &&
                      !isActive &&
                      "bg-white text-[#FF7E47] border border-[#FF7E47]/20",
                    !isActive &&
                      !isCompleted &&
                      "bg-transparent text-[#A39B90]",
                    isClickable ? "cursor-pointer" : "cursor-default"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <Check className="w-4 h-4" strokeWidth={3} />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">
                    {t(step.labelKey)}
                  </span>
                </motion.button>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* ── Step Content ── */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 pb-16">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {currentStep === 0 && <FormSection onNext={handleNext} />}
            {currentStep === 1 && <PreviewSection onNext={handleNext} />}
            {currentStep === 2 && <ConnectSection />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CreateBotPage;
