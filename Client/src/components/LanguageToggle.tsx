import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/auth.store";
import { supabase } from "@/services/supabase";

interface LanguageToggleProps {
  variant?: "light" | "dark";
  className?: string;
}

export default function LanguageToggle({ variant = "dark", className = "" }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isHe = i18n.language === "he";

  const toggle = async () => {
    const next = isHe ? "en" : "he";
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === "he" ? "rtl" : "ltr";

    if (user?.id) {
      await supabase.from("profiles").update({ language: next }).eq("id", user.id);
    }
  };

  const base = "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer select-none";
  const colors =
    variant === "light"
      ? "text-white/70 hover:text-white hover:bg-white/10"
      : "text-[#3D3630]/60 hover:text-[#3D3630] hover:bg-[#3D3630]/5";

  return (
    <button type="button" onClick={toggle} className={`${base} ${colors} ${className}`}>
      {isHe ? "EN" : "עב"}
    </button>
  );
}
