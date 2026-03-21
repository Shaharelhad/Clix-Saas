import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, LogOut, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const EASE = [0.22, 1, 0.36, 1] as const;
const POLL_INTERVAL = 30_000; // 30 seconds

export default function PendingPage() {
  const { t } = useTranslation("pending");
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isApproved,
    isPending,
    hasCompletedOnboarding,
    isLoading: authLoading,
    signOut,
    refreshProfile,
  } = useAuth();

  const [isChecking, setIsChecking] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  // Redirect logic
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
      return;
    }
    if (isApproved) {
      navigate(hasCompletedOnboarding ? "/dashboard" : "/create-bot", {
        replace: true,
      });
    }
  }, [isAuthenticated, isApproved, hasCompletedOnboarding, authLoading, navigate]);

  // Auto-poll for status change
  useEffect(() => {
    if (!isAuthenticated || !isPending) return;

    const interval = setInterval(() => {
      refreshProfile();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [isAuthenticated, isPending, refreshProfile]);

  const handleCheckStatus = async () => {
    setIsChecking(true);
    await refreshProfile();
    setIsChecking(false);
    setShowStatus(true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  // Loading gate
  if (authLoading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen font-secular-one flex items-center justify-center"
        style={{
          background:
            "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)",
        }}
      >
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B2C]" />
        </motion.div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen font-secular-one relative"
      style={{
        background:
          "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)",
      }}
    >
      {/* Background glow */}
      <div className="hero-glow-light" />

      {/* Floating geometric accents */}
      <motion.div
        className="absolute top-[12%] right-[10%] w-5 h-5 border-2 border-[#FF6B2C]/20 rotate-45"
        animate={{ y: [0, -14, 0], rotate: [45, 52, 45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[18%] left-[8%] w-3.5 h-3.5 rounded-full bg-[#FF6B2C]/15"
        animate={{ y: [0, 12, 0], scale: [1, 1.4, 1] }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5,
        }}
      />
      <motion.div
        className="absolute top-[50%] right-[6%] w-7 h-7 rounded-full border-2 border-[#FF6B2C]/15"
        animate={{ scale: [1, 1.2, 1], opacity: [0.15, 0.35, 0.15] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
      <motion.div
        className="absolute bottom-[22%] left-[12%] w-4 h-4 border-2 border-[#FF6B2C]/20"
        animate={{ y: [0, 10, 0], rotate: [0, 12, 0] }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      />
      <motion.div
        className="absolute top-[60%] left-[5%] w-9 h-[2px] bg-[#FF6B2C]/15"
        animate={{ scaleX: [1, 1.6, 1], opacity: [0.15, 0.35, 0.15] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4,
        }}
      />
      <motion.div
        className="absolute bottom-[30%] right-[18%] flex gap-1.5"
        animate={{ opacity: [0.15, 0.4, 0.15] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/30" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/20" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/10" />
      </motion.div>

      {/* Centered content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="flex items-center justify-center gap-2.5 mb-8"
          dir="ltr"
        >
          <img
            src="/clix-logo-full.png"
            alt="CLIX"
            className="h-8 drop-shadow-[0_0_12px_rgba(255,107,44,0.3)]"
          />
          <span className="text-[#2D2A26] font-bold text-2xl tracking-wide select-none">
            CLIX
          </span>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="w-full max-w-[420px]"
        >
          <div
            className="rounded-2xl px-7 py-8 sm:px-9 sm:py-10"
            style={{
              background: "rgba(255, 255, 255, 0.55)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.7)",
              boxShadow:
                "0 8px 32px rgba(0, 0, 0, 0.06), 0 2px 8px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
            }}
          >
            {/* Bell icon with rocking animation */}
            <motion.div
              className="flex justify-center mb-6"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,107,44,0.12), rgba(255,107,44,0.22))",
                  border: "1px solid rgba(255,107,44,0.18)",
                }}
              >
                <Bell className="w-8 h-8 text-[#FF6B2C] bell-rock" />
              </div>
            </motion.div>

            {/* Text */}
            <div className="text-center space-y-3 mb-6">
              <h1 className="text-[22px] font-bold text-[#2D2A26]">
                {t("title")}
              </h1>
              <p className="text-[#7A7267] text-sm leading-relaxed">
                {t("subtitle")}
              </p>
            </div>

            {/* Inline status badge */}
            <AnimatePresence>
              {showStatus && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto", marginBottom: 24 }}
                  exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                  className="overflow-hidden"
                >
                  <div
                    className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl"
                    style={{
                      background: isPending
                        ? "rgba(255, 160, 60, 0.10)"
                        : "rgba(34, 197, 94, 0.10)",
                      border: isPending
                        ? "1px solid rgba(255, 160, 60, 0.25)"
                        : "1px solid rgba(34, 197, 94, 0.25)",
                    }}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isPending
                          ? "bg-[#FF9F3C] animate-pulse"
                          : "bg-green-500",
                      )}
                    />
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isPending ? "text-[#B86E1A]" : "text-green-700",
                      )}
                    >
                      {isPending
                        ? t("statusPending")
                        : t("statusApproved")}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Check Status button */}
            <motion.button
              type="button"
              onClick={handleCheckStatus}
              disabled={isChecking}
              whileHover={isChecking ? {} : { scale: 1.015 }}
              whileTap={isChecking ? {} : { scale: 0.985 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={cn(
                "clix-btn w-full text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2",
                isChecking && "opacity-60 pointer-events-none",
              )}
            >
              <RefreshCw
                className={cn("w-4 h-4", isChecking && "animate-spin")}
              />
              {t("checkStatusBtn")}
            </motion.button>

            {/* Divider */}
            <div className="my-4 border-t border-[#EDE6DD]/60" />

            {/* Log out button */}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-[#A39B90] hover:text-[#7A7267] transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              {t("signOutBtn")}
            </button>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="text-[#A39B90] text-xs mt-8 tracking-wide"
        >
          {t("tagline")}
        </motion.p>
      </div>
    </div>
  );
}
