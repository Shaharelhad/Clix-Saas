import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  ArrowRight,
  Loader2,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type AuthMode = "login" | "signup" | "forgot";

const EASE = [0.22, 1, 0.36, 1] as const;
const ORANGE = "#FF6B2C";
const ORANGE_DARK = "#E8590C";

const formVariants = {
  enter: { opacity: 0, y: 24, filter: "blur(4px)" },
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -16, filter: "blur(4px)" },
};

/* ── Shared input field (light theme) ── */

function InputField({
  icon: Icon,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  dir = "ltr",
  showToggle,
  onToggle,
  isVisible,
}: {
  icon: typeof Mail;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  dir?: "ltr" | "rtl";
  showToggle?: boolean;
  onToggle?: () => void;
  isVisible?: boolean;
}) {
  return (
    <div>
      <label className="block text-[#2D2A26]/60 text-sm mb-1">{label}</label>
      <div className="relative group">
        <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[#A39B90] transition-colors group-focus-within:text-[#FF6B2C]/70" />
        <input
          type={showToggle ? (isVisible ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          className={cn(
            "w-full bg-white border border-[#EDE6DD] rounded-xl text-[#2D2A26] text-sm",
            "placeholder:text-[#A39B90]/60 transition-all duration-200",
            "focus:outline-none focus:border-[#FF6B2C]/50 focus:shadow-[0_0_0_3px_rgba(255,107,44,0.08)]",
            "hover:border-[#D5CEC5]",
            "py-2.5 pr-10",
            showToggle ? "pl-10" : "pl-3.5",
          )}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A39B90] hover:text-[#7A7267] transition-colors"
          >
            {isVisible ? (
              <EyeOff className="w-[17px] h-[17px]" />
            ) : (
              <Eye className="w-[17px] h-[17px]" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Submit button ── */

function SubmitBtn({
  label,
  isSubmitting,
}: {
  label: string;
  isSubmitting: boolean;
}) {
  return (
    <motion.button
      type="submit"
      disabled={isSubmitting}
      whileHover={isSubmitting ? {} : { scale: 1.015 }}
      whileTap={isSubmitting ? {} : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "clix-btn w-full text-[15px] py-3 rounded-xl flex items-center justify-center gap-2",
        isSubmitting && "opacity-60 pointer-events-none",
      )}
    >
      <Loader2
        className={cn(
          "w-4 h-4 animate-spin",
          isSubmitting ? "block" : "hidden",
        )}
      />
      {label}
    </motion.button>
  );
}

/* ── Illustration panel — chat mockup ── */

function IllustrationPanel() {
  const { t } = useTranslation("auth");

  return (
    <div
      className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #1A1614 0%, #2D2620 50%, #1A1614 100%)",
      }}
    >
      {/* Subtle glow */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 50% 40%, ${ORANGE}15, transparent 70%)`,
        }}
      />

      {/* Floating accents */}
      <motion.div
        className="absolute top-[8%] right-[8%] w-5 h-5 border-2 border-[#FF6B2C]/40 rotate-45"
        animate={{ y: [0, -14, 0], rotate: [45, 52, 45] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[15%] left-[6%] w-3 h-3 rounded-full bg-[#FF6B2C]/30"
        animate={{ y: [0, 12, 0], scale: [1, 1.4, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />
      <motion.div
        className="absolute bottom-[12%] right-[10%] w-7 h-7 rounded-full border-2 border-[#FF6B2C]/25"
        animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[25%] left-[8%] w-4 h-4 border-2 border-[#FF6B2C]/30"
        animate={{ y: [0, 10, 0], rotate: [0, 12, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
      <motion.div
        className="absolute top-[50%] left-[4%] w-9 h-[2px] bg-[#FF6B2C]/25"
        animate={{ scaleX: [1, 1.6, 1], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-8 max-w-md">
        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-white text-2xl xl:text-3xl font-bold text-center mb-2 leading-snug"
        >
          {t("illustrationTitle")}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="text-white/50 text-sm text-center mb-8"
        >
          {t("illustrationSubtitle")}
        </motion.p>

        {/* Chat mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          className="w-full max-w-[320px]"
        >
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.06] backdrop-blur-sm shadow-2xl">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})` }}
              >
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white/90">CLIX Bot</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[11px] text-white/40">Online</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div dir="rtl" className="p-3 space-y-2.5 min-h-[200px]">
              {/* User message */}
              <motion.div
                className="flex justify-end"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <div className="bg-[#DCF8C6]/90 rounded-2xl rounded-se-sm px-3 py-1.5 max-w-[80%]">
                  <p className="text-[13px] text-gray-800">{t("chatMsg1")}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5 text-left">12:34</p>
                </div>
              </motion.div>

              {/* Bot response */}
              <motion.div
                className="flex justify-start gap-1.5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.4 }}
              >
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-1"
                  style={{ background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})` }}
                >
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white/10 rounded-2xl rounded-ss-sm px-3 py-1.5 max-w-[80%]">
                  <p className="text-[13px] text-white/85">{t("chatMsg2")}</p>
                  <p className="text-[9px] text-white/30 mt-0.5 text-left">12:34</p>
                </div>
              </motion.div>

              {/* Second user message */}
              <motion.div
                className="flex justify-end"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4, duration: 0.4 }}
              >
                <div className="bg-[#DCF8C6]/90 rounded-2xl rounded-se-sm px-3 py-1.5 max-w-[80%]">
                  <p className="text-[13px] text-gray-800">{t("chatMsg3")}</p>
                  <p className="text-[9px] text-gray-500 mt-0.5 text-left">12:35</p>
                </div>
              </motion.div>

              {/* Typing indicator */}
              <motion.div
                className="flex justify-start gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8, duration: 0.3 }}
              >
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-1"
                  style={{ background: `linear-gradient(135deg, ${ORANGE}, ${ORANGE_DARK})` }}
                >
                  <Bot className="w-3 h-3 text-white" />
                </div>
                <div className="bg-white/10 rounded-2xl rounded-ss-sm px-3 py-1.5">
                  <div className="flex items-center gap-1 py-0.5 px-0.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ── Main AuthPage ── */

export default function AuthPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const {
    signUp,
    signIn,
    resetPassword,
    isAuthenticated,
    isAdmin,
    isApproved,
    isPending,
    hasCompletedOnboarding,
    isLoading: authLoading,
  } = useAuth();

  const initialLoadDone = useRef(false);
  if (!authLoading) initialLoadDone.current = true;

  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode");
  const [mode, setMode] = useState<AuthMode>(
    initialMode === "signup" || initialMode === "forgot" ? initialMode : "login",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Signup
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signupPw, setSignupPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Forgot
  const [forgotEmail, setForgotEmail] = useState("");

  // Redirect authenticated users
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) return;
    if (isAdmin) navigate("/admin/dashboard", { replace: true });
    else if (isPending) navigate("/pending", { replace: true });
    else if (isApproved)
      navigate(hasCompletedOnboarding ? "/dashboard" : "/create-bot", {
        replace: true,
      });
  }, [isAuthenticated, isAdmin, isApproved, isPending, hasCompletedOnboarding, authLoading, navigate]);

  // Loading gate
  if (!initialLoadDone.current) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)" }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B2C]" />
        </motion.div>
      </div>
    );
  }

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setSuccess(null);
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim()) return setError(t("errorEmailRequired"));
    if (!isValidEmail(loginEmail)) return setError(t("errorEmailInvalid"));
    if (!loginPassword) return setError(t("errorPasswordRequired"));

    setIsSubmitting(true);
    try {
      const { error: authErr } = await signIn(loginEmail, loginPassword);
      if (authErr) setError(t("errorLoginFailed"));
    } catch {
      setError(t("errorLoginFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError(t("errorNameRequired"));
    if (!signupEmail.trim()) return setError(t("errorEmailRequired"));
    if (!isValidEmail(signupEmail)) return setError(t("errorEmailInvalid"));
    if (!phone.trim()) return setError(t("errorPhoneRequired"));
    if (signupPw.length < 6) return setError(t("errorPasswordMin"));
    if (signupPw !== confirmPw) return setError(t("errorPasswordMismatch"));

    setIsSubmitting(true);
    try {
      const { data, error: authErr } = await signUp(
        signupEmail,
        signupPw,
        name,
        phone,
      );
      if (authErr) {
        setError(authErr.message);
        return;
      }

      if (!data?.session) {
        setSuccess(t("signupConfirmEmail"));
        return;
      }

      navigate("/pending");
    } catch {
      setError(t("errorLoginFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!forgotEmail.trim()) return setError(t("errorEmailRequired"));
    if (!isValidEmail(forgotEmail)) return setError(t("errorEmailInvalid"));

    setIsSubmitting(true);
    try {
      const { error: authErr } = await resetPassword(forgotEmail);
      if (authErr) {
        setError(authErr.message);
        return;
      }
      setSuccess(t("resetEmailSent"));
    } catch {
      setError(t("errorLoginFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="h-dvh font-secular-one grid grid-cols-1 lg:grid-cols-[55%_45%] overflow-hidden"
    >
      {/* ── Left panel — Illustration (dark) ── */}
      <IllustrationPanel />

      {/* ── Right panel — Form (warm cream) ── */}
      <div
        className="flex flex-col items-center justify-center px-4 sm:px-6 md:px-10 relative overflow-y-auto"
        style={{
          background: "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)",
        }}
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex items-center justify-center gap-2 mb-6 cursor-pointer"
          dir="ltr"
          onClick={() => navigate("/")}
        >
          <img
            src="/clix-logo-full.png"
            alt="CLIX"
            className="h-7"
          />
        </motion.div>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="w-full max-w-[380px]"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              variants={formVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE }}
            >
              {/* ── LOGIN ── */}
              {mode === "login" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="text-center mb-5">
                    <h1 className="text-[22px] font-bold text-[#2D2A26] mb-1">
                      {t("loginTitle")}
                    </h1>
                    <p className="text-[#7A7267] text-sm">
                      {t("loginSubtitle")}
                    </p>
                  </div>

                  <MessageAlert error={error} success={success} />

                  <InputField
                    icon={Mail}
                    label={t("emailLabel")}
                    type="email"
                    value={loginEmail}
                    onChange={setLoginEmail}
                    placeholder={t("emailPlaceholder")}
                  />
                  <InputField
                    icon={Lock}
                    label={t("passwordLabel")}
                    value={loginPassword}
                    onChange={setLoginPassword}
                    placeholder={t("passwordPlaceholder")}
                    showToggle
                    onToggle={() => setShowLoginPw(!showLoginPw)}
                    isVisible={showLoginPw}
                  />

                  <div className="text-start">
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-[#A39B90] hover:text-[#FF6B2C] text-xs transition-colors"
                    >
                      {t("forgotPassword")}
                    </button>
                  </div>

                  <SubmitBtn label={t("loginBtn")} isSubmitting={isSubmitting} />

                  <p className="text-center text-[#7A7267] text-sm pt-1">
                    {t("noAccount")}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("signup")}
                      className="text-[#FF6B2C] hover:text-[#FF8F5C] transition-colors font-bold"
                    >
                      {t("signupLink")}
                    </button>
                  </p>
                </form>
              )}

              {/* ── SIGNUP ── */}
              {mode === "signup" && (
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="text-center mb-4">
                    <h1 className="text-[22px] font-bold text-[#2D2A26] mb-1">
                      {t("signupTitle")}
                    </h1>
                    <p className="text-[#7A7267] text-sm">
                      {t("signupSubtitle")}
                    </p>
                  </div>

                  <MessageAlert error={error} success={success} />

                  <InputField
                    icon={User}
                    label={t("fullNameLabel")}
                    value={name}
                    onChange={setName}
                    placeholder={t("fullNamePlaceholder")}
                    dir="rtl"
                  />
                  <InputField
                    icon={Mail}
                    label={t("emailLabel")}
                    type="email"
                    value={signupEmail}
                    onChange={setSignupEmail}
                    placeholder={t("emailPlaceholder")}
                  />
                  <InputField
                    icon={Phone}
                    label={t("phoneLabel")}
                    type="tel"
                    value={phone}
                    onChange={setPhone}
                    placeholder={t("phonePlaceholder")}
                  />
                  <InputField
                    icon={Lock}
                    label={t("passwordLabel")}
                    value={signupPw}
                    onChange={setSignupPw}
                    placeholder={t("passwordPlaceholder")}
                    showToggle
                    onToggle={() => setShowSignupPw(!showSignupPw)}
                    isVisible={showSignupPw}
                  />
                  <InputField
                    icon={Lock}
                    label={t("confirmPasswordLabel")}
                    value={confirmPw}
                    onChange={setConfirmPw}
                    placeholder={t("confirmPasswordPlaceholder")}
                    showToggle
                    onToggle={() => setShowConfirmPw(!showConfirmPw)}
                    isVisible={showConfirmPw}
                  />

                  <div className="pt-1">
                    <SubmitBtn label={t("signupBtn")} isSubmitting={isSubmitting} />
                  </div>

                  <p className="text-center text-[#7A7267] text-sm">
                    {t("hasAccount")}{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="text-[#FF6B2C] hover:text-[#FF8F5C] transition-colors font-bold"
                    >
                      {t("loginLink")}
                    </button>
                  </p>
                </form>
              )}

              {/* ── FORGOT PASSWORD ── */}
              {mode === "forgot" && (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="text-center mb-5">
                    <h1 className="text-[22px] font-bold text-[#2D2A26] mb-1">
                      {t("forgotTitle")}
                    </h1>
                    <p className="text-[#7A7267] text-sm">
                      {t("forgotSubtitle")}
                    </p>
                  </div>

                  <MessageAlert error={error} success={success} />

                  <InputField
                    icon={Mail}
                    label={t("emailLabel")}
                    type="email"
                    value={forgotEmail}
                    onChange={setForgotEmail}
                    placeholder={t("emailPlaceholder")}
                  />

                  <SubmitBtn label={t("resetBtn")} isSubmitting={isSubmitting} />

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="inline-flex items-center gap-1.5 text-[#FF6B2C] hover:text-[#FF8F5C] transition-colors text-sm font-bold"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      {t("backToLogin")}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-[#A39B90] text-xs mt-6 tracking-wide"
        >
          {t("tagline")}
        </motion.p>
      </div>
    </div>
  );
}

/* ── Alert component ── */

function MessageAlert({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  const msg = error || success;
  const isError = !!error;

  if (!msg) return null;

  return (
    <div
      className={cn(
        "rounded-xl px-4 py-3 mb-1 border text-sm text-center",
        isError
          ? "bg-red-50 border-red-200 text-red-600"
          : "bg-emerald-50 border-emerald-200 text-emerald-600",
      )}
    >
      {msg}
    </div>
  );
}
