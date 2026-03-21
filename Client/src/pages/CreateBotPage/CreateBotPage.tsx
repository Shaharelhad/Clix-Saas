import { useState, useEffect, useCallback, Component, type ReactNode, type ErrorInfo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, FileText, Eye, Wifi, LogOut, SkipForward } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { cn } from "@/lib/utils";
import FormSection from "./Sections/FormSection";
import PreviewSection from "./Sections/PreviewSection";
import ConnectSection from "./Sections/ConnectSection";

/**
 * Local error boundary that swallows DOM manipulation errors caused by
 * browser extensions (Google Translate, Grammarly, etc.) modifying text nodes.
 * Placed INSIDE CreateBotPage so that phase state above it is preserved
 * when React recreates this subtree after catching the error.
 */
class PhaseContentBoundary extends Component<
  { children: ReactNode },
  { hasRealError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasRealError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Swallow DOM manipulation errors from browser extensions
    if (
      error.name === "NotFoundError" &&
      (error.message.includes("removeChild") ||
        error.message.includes("insertBefore"))
    ) {
      return { hasRealError: false };
    }
    // Mark real errors so we can re-throw in render
    return { hasRealError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (
      error.name === "NotFoundError" &&
      (error.message.includes("removeChild") ||
        error.message.includes("insertBefore"))
    ) {
      return;
    }
  }

  render() {
    // For non-DOM errors, throw so the outer ErrorBoundary handles them
    if (this.state.hasRealError) {
      this.setState({ hasRealError: false });
      throw new Error("Application error caught by PhaseContentBoundary");
    }
    return this.props.children;
  }
}

type Phase = "form" | "preview" | "connect";

const STEPS = [
  { id: "form", icon: FileText, labelKey: "stepForm" },
  { id: "preview", icon: Eye, labelKey: "stepPreview" },
  { id: "connect", icon: Wifi, labelKey: "stepConnect" },
] as const;

const PHASE_INDEX: Record<Phase, number> = {
  form: 0,
  preview: 1,
  connect: 2,
};

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

const CreateBotPage = () => {
  const { t, i18n } = useTranslation("createBot");
  const { signOut, hasCompletedOnboarding, user, refreshProfile } = useAuth();
  const [isSkipping, setIsSkipping] = useState(false);
  const navigate = useNavigate();
  const isRTL = i18n.language === "he";

  const [phase, setPhase] = useState<Phase>(() => {
    // If returning from dashboard (already completed onboarding), always start on form
    // This handles the case where a user skipped, went to dashboard, then clicked "Create Bot"
    if (hasCompletedOnboarding) {
      sessionStorage.removeItem("createBot_phase");
      return "form";
    }
    const saved = sessionStorage.getItem("createBot_phase") as Phase | null;
    return saved && ["form", "preview", "connect"].includes(saved)
      ? saved
      : "form";
  });
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    sessionStorage.setItem("createBot_phase", phase);
  }, [phase]);

  const goToPhase = (nextPhase: Phase) => {
    if (nextPhase === phase) return;
    // Save immediately so phase survives auth-guard remounts
    sessionStorage.setItem("createBot_phase", nextPhase);
    const nextIdx = PHASE_INDEX[nextPhase];
    const curIdx = PHASE_INDEX[phase];
    const dir = isRTL
      ? nextIdx < curIdx
        ? 1
        : -1
      : nextIdx > curIdx
        ? 1
        : -1;
    setDirection(dir);
    setPhase(nextPhase);
  };

  const handleNext = useCallback(() => {
    setPhase((prev) => {
      const next: Phase | null =
        prev === "form" ? "preview" : prev === "preview" ? "connect" : null;
      if (!next) return prev;
      sessionStorage.setItem("createBot_phase", next);
      // Direction is set separately (non-critical for correctness)
      setDirection(1);
      return next;
    });
  }, []);

  const handleSkip = useCallback(async () => {
    setIsSkipping(true);
    try {
      const userId = user?.id ?? "";
      if (userId) {
        await supabase
          .from("profiles")
          .update({ bot_status: "created" })
          .eq("id", userId);
        refreshProfile();
      }
      sessionStorage.removeItem("createBot_wizardStep");
      sessionStorage.setItem("createBot_phase", "preview");
      setDirection(1);
      setPhase("preview");
    } catch {
      setIsSkipping(false);
    }
  }, [user?.id, refreshProfile]);

  const showStepper = phase !== "form";

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className={cn(
        "min-h-screen font-secular-one relative",
        phase === "connect" ? "overflow-y-auto" : "overflow-hidden h-screen",
      )}
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
        type="button"
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

      {/* ── Skip button (only during form phase) ── */}
      {phase === "form" && (
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={handleSkip}
          disabled={isSkipping}
          className="absolute top-4 end-4 z-20 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-[#8C847A] backdrop-blur-xl transition-colors duration-200 hover:text-[#FF7E47] cursor-pointer disabled:opacity-50"
          style={{
            background: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(237,230,221,0.5)",
          }}
        >
          <div className="flex items-center gap-2">
            <span>{t("skipForm")}</span>
            <SkipForward className="w-4 h-4" />
          </div>
        </motion.button>
      )}

      {/* ── Stepper (only shown during preview/connect) ── */}
      {showStepper && (
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
              const currentIdx = PHASE_INDEX[phase];
              const isActive = i === currentIdx;
              const isCompleted = i < currentIdx;
              // Form step (0) is always completed and unclickable
              const isFormStep = i === 0;
              const isClickable = !isFormStep && i <= currentIdx;

              return (
                <div key={step.id} className="flex items-center">
                  {i > 0 && (
                    <div className="w-8 sm:w-14 mx-1 flex items-center">
                      <div
                        className={cn(
                          "w-full border-t-2 border-dashed transition-colors duration-500",
                          isCompleted || i <= currentIdx
                            ? "border-[#FF7E47]/50"
                            : "border-[#DDD5CA]",
                        )}
                      />
                    </div>
                  )}

                  <motion.button
                    type="button"
                    onClick={() =>
                      isClickable
                        ? goToPhase(step.id as Phase)
                        : undefined
                    }
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
                      isClickable ? "cursor-pointer" : "cursor-default",
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
      )}

      {/* ── Phase Content ── */}
      <div
        className={cn(
          "relative z-10 mx-auto",
          phase === "form"
            ? "pt-8"
            : phase === "preview"
              ? "max-w-6xl px-4"
              : "max-w-4xl px-4",
        )}
      >
        <PhaseContentBoundary>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={phase}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {phase === "form" && <FormSection onNext={handleNext} />}
              {phase === "preview" && <PreviewSection onNext={handleNext} />}
              {phase === "connect" && <ConnectSection />}
            </motion.div>
          </AnimatePresence>
        </PhaseContentBoundary>
      </div>
    </div>
  );
};

export default CreateBotPage;
