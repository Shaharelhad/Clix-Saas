import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type AuthMode = "login" | "signup" | "forgot";

const EASE = [0.22, 1, 0.36, 1] as const;

const formVariants = {
  enter: { opacity: 0, y: 24, filter: "blur(4px)" },
  center: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -16, filter: "blur(4px)" },
};

/* ── Shared input field ── */

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
      <label className="block text-white/60 text-sm mb-1.5">{label}</label>
      <div className="relative group">
        <Icon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white/25 transition-colors group-focus-within:text-[#FF6B2C]/60" />
        <input
          type={showToggle ? (isVisible ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={dir}
          className={cn(
            "w-full bg-white/[0.05] border border-white/[0.08] rounded-xl text-white text-sm",
            "placeholder:text-white/20 transition-all duration-200",
            "focus:outline-none focus:border-[#FF6B2C]/40 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(255,107,44,0.08)]",
            "hover:border-white/[0.15] hover:bg-white/[0.06]",
            "py-3 pr-11",
            showToggle ? "pl-11" : "pl-4",
          )}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
          >
            {isVisible ? (
              <EyeOff className="w-[18px] h-[18px]" />
            ) : (
              <Eye className="w-[18px] h-[18px]" />
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
        "clix-btn w-full text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2",
        isSubmitting && "opacity-60 pointer-events-none",
      )}
    >
      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
      {label}
    </motion.button>
  );
}

export default function AuthPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const {
    signUp,
    signIn,
    resetPassword,
    isAuthenticated,
    isApproved,
    isPending,
    isLoading: authLoading,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
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
    if (isPending) navigate("/pending", { replace: true });
    else if (isApproved) navigate("/create-bot", { replace: true });
  }, [isAuthenticated, isApproved, isPending, authLoading, navigate]);

  // Loading gate — prevent flash of auth form for already-logged-in users
  if (authLoading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-black text-white font-secular-one flex items-center justify-center"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
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

  // ── Handlers ──

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim()) return setError(t("errorEmailRequired"));
    if (!isValidEmail(loginEmail)) return setError(t("errorEmailInvalid"));
    if (!loginPassword) return setError(t("errorPasswordRequired"));

    setIsSubmitting(true);
    const { error: authErr } = await signIn(loginEmail, loginPassword);
    setIsSubmitting(false);
    if (authErr) setError(t("errorLoginFailed"));
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
    const { data, error: authErr } = await signUp(
      signupEmail,
      signupPw,
      name,
      phone,
    );
    setIsSubmitting(false);
    if (authErr) {
      setError(authErr.message);
      return;
    }

    // If Supabase email confirmation is enabled, session will be null
    if (!data?.session) {
      setSuccess(t("signupConfirmEmail"));
      return;
    }

    navigate("/pending");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!forgotEmail.trim()) return setError(t("errorEmailRequired"));
    if (!isValidEmail(forgotEmail)) return setError(t("errorEmailInvalid"));

    setIsSubmitting(true);
    const { error: authErr } = await resetPassword(forgotEmail);
    setIsSubmitting(false);
    if (authErr) {
      setError(authErr.message);
      return;
    }
    setSuccess(t("resetEmailSent"));
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-black text-white font-secular-one relative"
    >
      {/* ── Background glow ── */}
      <div className="hero-glow" />

      {/* ── Floating geometric accents ── */}
      <motion.div
        className="absolute top-[12%] right-[10%] w-5 h-5 border-2 border-[#FF6B2C]/40 rotate-45"
        animate={{ y: [0, -14, 0], rotate: [45, 52, 45] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
        }}
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

      {/* ── Centered content ── */}
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
                    <form onSubmit={handleLogin} className="space-y-5">
                      <div className="text-center mb-7">
                        <h1 className="text-[22px] font-bold text-white mb-1.5">
                          {t("loginTitle")}
                        </h1>
                        <p className="text-white/40 text-sm">
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
                          className="text-white/30 hover:text-[#FF6B2C]/70 text-xs transition-colors"
                        >
                          {t("forgotPassword")}
                        </button>
                      </div>

                      <SubmitBtn label={t("loginBtn")} isSubmitting={isSubmitting} />

                      <p className="text-center text-white/40 text-sm pt-2">
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
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="text-center mb-6">
                        <h1 className="text-[22px] font-bold text-white mb-1.5">
                          {t("signupTitle")}
                        </h1>
                        <p className="text-white/40 text-sm">
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

                      <p className="text-center text-white/40 text-sm pt-1">
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
                    <form onSubmit={handleForgot} className="space-y-5">
                      <div className="text-center mb-7">
                        <h1 className="text-[22px] font-bold text-white mb-1.5">
                          {t("forgotTitle")}
                        </h1>
                        <p className="text-white/40 text-sm">
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

                      <div className="text-center pt-2">
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

/* ── Alert component ── */

function MessageAlert({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  const msg = error || success;
  if (!msg) return null;

  const isError = !!error;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-xl px-4 py-3 mb-1 border text-sm text-center",
        isError
          ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
      )}
    >
      {msg}
    </motion.div>
  );
}
