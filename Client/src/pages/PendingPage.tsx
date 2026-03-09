import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Clock, LogOut, RefreshCw, Loader2 } from "lucide-react";
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
    isLoading: authLoading,
    signOut,
    refreshProfile,
  } = useAuth();

  const [isChecking, setIsChecking] = useState(false);

  // Redirect logic
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/auth", { replace: true });
      return;
    }
    if (isApproved) {
      navigate("/create-bot", { replace: true });
    }
  }, [isAuthenticated, isApproved, authLoading, navigate]);

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
        className="min-h-screen bg-black text-white font-secular-one flex items-center justify-center"
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
      className="min-h-screen bg-black text-white font-secular-one relative"
    >
      {/* Background glow */}
      <div className="hero-glow" />

      {/* Floating geometric accents */}
      <motion.div
        className="absolute top-[12%] right-[10%] w-5 h-5 border-2 border-[#FF6B2C]/40 rotate-45"
        animate={{ y: [0, -14, 0], rotate: [45, 52, 45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[18%] left-[8%] w-3.5 h-3.5 rounded-full bg-[#FF6B2C]/35"
        animate={{ y: [0, 12, 0], scale: [1, 1.4, 1] }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.5,
        }}
      />
      <motion.div
        className="absolute top-[50%] right-[6%] w-7 h-7 rounded-full border-2 border-[#FF6B2C]/25"
        animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
      <motion.div
        className="absolute bottom-[22%] left-[12%] w-4 h-4 border-2 border-[#FF6B2C]/35"
        animate={{ y: [0, 10, 0], rotate: [0, 12, 0] }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
      />
      <motion.div
        className="absolute top-[60%] left-[5%] w-9 h-[2px] bg-[#FF6B2C]/30"
        animate={{ scaleX: [1, 1.6, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4,
        }}
      />
      <motion.div
        className="absolute bottom-[30%] right-[18%] flex gap-1.5"
        animate={{ opacity: [0.25, 0.6, 0.25] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/50" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/30" />
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B2C]/15" />
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
            src="/clix-logo.svg"
            alt="CLIX"
            className="h-10 w-10 drop-shadow-[0_0_12px_rgba(255,107,44,0.3)]"
          />
          <span className="text-white font-bold text-2xl tracking-wide select-none">
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
          {/* Gradient border wrapper */}
          <div className="rounded-2xl bg-gradient-to-b from-white/[0.12] to-white/[0.03] p-px">
            <div className="rounded-2xl bg-black/80 backdrop-blur-xl px-7 py-8 sm:px-9 sm:py-10">
              {/* Clock icon */}
              <motion.div
                className="flex justify-center mb-6"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
              >
                <div className="w-16 h-16 rounded-2xl bg-[#FF6B2C]/10 border border-[#FF6B2C]/20 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-[#FF6B2C]" />
                </div>
              </motion.div>

              {/* Text */}
              <div className="text-center space-y-3 mb-8">
                <h1 className="text-[22px] font-bold text-white">
                  {t("title")}
                </h1>
                <p className="text-white/40 text-sm leading-relaxed">
                  {t("subtitle")}
                </p>
              </div>

              {/* Check Status button */}
              <motion.button
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
              <div className="my-4 border-t border-white/[0.06]" />

              {/* Log out button */}
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 flex items-center justify-center gap-2 text-white/40 hover:text-white/60 transition-colors text-sm"
              >
                <LogOut className="w-4 h-4" />
                {t("signOutBtn")}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="text-white/20 text-xs mt-8 tracking-wide"
        >
          {t("tagline")}
        </motion.p>
      </div>
    </div>
  );
}
