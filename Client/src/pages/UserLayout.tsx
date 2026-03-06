import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function UserLayout() {
  const { t } = useTranslation("sidebar");
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen font-secular-one"
      style={{ background: "linear-gradient(170deg, #FDF8F2 0%, #F8F0E6 40%, #FBF5EE 100%)" }}
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[#EDE6DD]/60 shadow-[0_1px_12px_rgba(45,42,38,0.04)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img
              src="/clix-logo.svg"
              alt="CLIX"
              className="h-7 w-7 drop-shadow-[0_0_8px_rgba(255,107,44,0.3)]"
            />
            <span className="font-bold text-lg text-[#2D2A26] tracking-wide">
              CLIX
            </span>
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden sm:block text-end">
                <p className="text-xs font-semibold text-[#2D2A26]">{user.full_name}</p>
                <p className="text-[11px] text-[#A39B90]">{user.email}</p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-[#A39B90] hover:text-[#FF7E47] hover:bg-[#FFF5F0] transition-all duration-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t("logout")}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
}
