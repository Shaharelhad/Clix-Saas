import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  Lock,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Pencil,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

/* ── Section card wrapper ── */

function SectionCard({
  title,
  icon: Icon,
  headerAction,
  children,
}: {
  title: string;
  icon: typeof User;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-white rounded-2xl border border-[#EDE6DD]/60 shadow-[0_1px_12px_rgba(45,42,38,0.04)] p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF6B2C]/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#FF6B2C]" />
          </div>
          <h2 className="text-base font-bold text-[#2D2A26]">{title}</h2>
        </div>
        {headerAction}
      </div>
      {children}
    </motion.div>
  );
}

/* ── Input field ── */

function InputField({
  label,
  value,
  onChange,
  icon: Icon,
  dir = "ltr",
  readOnly = false,
  disabled = false,
  type = "text",
  placeholder,
  showToggle,
  onToggle,
  isVisible,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  icon: typeof User;
  dir?: "ltr" | "rtl";
  readOnly?: boolean;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  showToggle?: boolean;
  onToggle?: () => void;
  isVisible?: boolean;
}) {
  const inputType = showToggle ? (isVisible ? "text" : "password") : type;

  return (
    <div>
      <label className="block text-[#2D2A26]/60 text-sm mb-1">{label}</label>
      <div className="relative">
        <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-[17px] h-[17px] text-[#A39B90]" />
        <input
          type={inputType}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          disabled={disabled}
          dir={dir}
          placeholder={placeholder}
          className={cn(
            "w-full border border-[#EDE6DD] rounded-xl text-[#2D2A26] text-sm py-2.5 pr-10",
            showToggle ? "pl-10" : "pl-3.5",
            disabled
              ? "bg-[#F5F2EE] text-[#A39B90] cursor-not-allowed"
              : readOnly
                ? "bg-[#FAF7F4] cursor-default"
                : "bg-white focus:outline-none focus:border-[#FF6B2C]/50 focus:shadow-[0_0_0_3px_rgba(255,107,44,0.08)] hover:border-[#D5CEC5] transition-all duration-200",
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

/* ── Feedback message ── */

function FeedbackMsg({ msg, isError }: { msg: string | null; isError: boolean }) {
  if (!msg) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm",
        isError
          ? "bg-red-50 border border-red-200 text-red-600"
          : "bg-emerald-50 border border-emerald-200 text-emerald-600",
      )}
    >
      {!isError && <Check className="w-4 h-4 shrink-0" />}
      {msg}
    </div>
  );
}

/* ── Submit button ── */

function SubmitBtn({
  label,
  isSubmitting,
  onClick,
  disabled,
}: {
  label: string;
  isSubmitting: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSubmitting || disabled}
      className={cn(
        "clix-btn w-full sm:w-auto text-sm py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer",
        (isSubmitting || disabled) && "opacity-50 cursor-not-allowed",
      )}
    >
      <Loader2 className={cn("w-4 h-4 animate-spin", isSubmitting ? "block" : "hidden")} />
      {label}
    </button>
  );
}

/* ── Edit button ── */

function EditBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-[#FF6B2C] hover:text-[#E8590C] transition-colors cursor-pointer"
    >
      <Pencil className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/* ── Main ProfilePage ── */

export default function ProfilePage() {
  const { t } = useTranslation("profile");
  const { user, updateProfile, updatePassword } = useAuth();

  // Personal info state
  const [profileEditing, setProfileEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileIsError, setProfileIsError] = useState(false);

  // Password state
  const [pwEditing, setPwEditing] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwIsError, setPwIsError] = useState(false);

  const handleSaveProfile = async () => {
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      const { error } = await updateProfile({ full_name: fullName, phone });
      if (error) {
        setProfileIsError(true);
        setProfileMsg(t("profileUpdateError"));
      } else {
        setProfileIsError(false);
        setProfileMsg(t("profileUpdated"));
        setProfileEditing(false);
      }
    } catch {
      setProfileIsError(true);
      setProfileMsg(t("profileUpdateError"));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCancelProfile = () => {
    setFullName(user?.full_name ?? "");
    setPhone(user?.phone ?? "");
    setProfileEditing(false);
    setProfileMsg(null);
  };

  const handleUpdatePassword = async () => {
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwIsError(true);
      setPwMsg(t("passwordMin"));
      return;
    }
    if (newPw !== confirmPw) {
      setPwIsError(true);
      setPwMsg(t("passwordMismatch"));
      return;
    }

    setPwSaving(true);
    try {
      const { error } = await updatePassword(newPw);
      if (error) {
        setPwIsError(true);
        setPwMsg(t("passwordUpdateError"));
      } else {
        setPwIsError(false);
        setPwMsg(t("passwordUpdated"));
        setNewPw("");
        setConfirmPw("");
        setPwEditing(false);
      }
    } catch {
      setPwIsError(true);
      setPwMsg(t("passwordUpdateError"));
    } finally {
      setPwSaving(false);
    }
  };

  const handleCancelPassword = () => {
    setNewPw("");
    setConfirmPw("");
    setPwEditing(false);
    setPwMsg(null);
    setShowNewPw(false);
    setShowConfirmPw(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        className="text-xl font-bold text-[#2D2A26] mb-6"
      >
        {t("pageTitle")}
      </motion.h1>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-5"
      >
        {/* ── Personal Info ── */}
        <SectionCard
          title={t("personalInfoTitle")}
          icon={User}
          headerAction={
            !profileEditing ? (
              <EditBtn onClick={() => setProfileEditing(true)} label={t("edit")} />
            ) : undefined
          }
        >
          <div className="space-y-3">
            <InputField
              label={t("emailLabel")}
              value={user?.email ?? ""}
              icon={Mail}
              disabled
            />
            <InputField
              label={t("fullNameLabel")}
              value={fullName}
              onChange={profileEditing ? setFullName : undefined}
              icon={User}
              dir="rtl"
              readOnly={!profileEditing}
            />
            <InputField
              label={t("phoneLabel")}
              value={phone}
              onChange={profileEditing ? setPhone : undefined}
              icon={Phone}
              readOnly={!profileEditing}
            />
          </div>
          {profileEditing && (
            <div className="mt-4 space-y-3">
              <FeedbackMsg msg={profileMsg} isError={profileIsError} />
              <div className="flex items-center gap-3">
                <SubmitBtn
                  label={t("saveChanges")}
                  isSubmitting={profileSaving}
                  onClick={handleSaveProfile}
                />
                <button
                  type="button"
                  onClick={handleCancelProfile}
                  className="text-sm text-[#7A7267] hover:text-[#2D2A26] transition-colors cursor-pointer"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
          {!profileEditing && profileMsg && (
            <div className="mt-4">
              <FeedbackMsg msg={profileMsg} isError={profileIsError} />
            </div>
          )}
        </SectionCard>

        {/* ── Change Password ── */}
        <SectionCard
          title={t("changePasswordTitle")}
          icon={Lock}
          headerAction={
            !pwEditing ? (
              <EditBtn onClick={() => setPwEditing(true)} label={t("edit")} />
            ) : undefined
          }
        >
          {pwEditing ? (
            <>
              <div className="space-y-3">
                <InputField
                  label={t("newPassword")}
                  value={newPw}
                  onChange={setNewPw}
                  icon={Lock}
                  type="password"
                  placeholder="••••••••"
                  showToggle
                  onToggle={() => setShowNewPw(!showNewPw)}
                  isVisible={showNewPw}
                />
                <InputField
                  label={t("confirmNewPassword")}
                  value={confirmPw}
                  onChange={setConfirmPw}
                  icon={Lock}
                  type="password"
                  placeholder="••••••••"
                  showToggle
                  onToggle={() => setShowConfirmPw(!showConfirmPw)}
                  isVisible={showConfirmPw}
                />
              </div>
              <div className="mt-4 space-y-3">
                <FeedbackMsg msg={pwMsg} isError={pwIsError} />
                <div className="flex items-center gap-3">
                  <SubmitBtn
                    label={t("updatePassword")}
                    isSubmitting={pwSaving}
                    onClick={handleUpdatePassword}
                    disabled={!newPw}
                  />
                  <button
                    type="button"
                    onClick={handleCancelPassword}
                    className="text-sm text-[#7A7267] hover:text-[#2D2A26] transition-colors cursor-pointer"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[#A39B90]">••••••••</p>
              {pwMsg && (
                <div className="mt-3">
                  <FeedbackMsg msg={pwMsg} isError={pwIsError} />
                </div>
              )}
            </>
          )}
        </SectionCard>
      </motion.div>
    </div>
  );
}
