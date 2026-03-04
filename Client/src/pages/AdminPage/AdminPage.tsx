import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users, UserRoundSearch, ClipboardList, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function AdminPage() {
  const { t } = useTranslation("admin");
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div
      dir="rtl"
      className="h-screen bg-[#0D0D0D] text-white font-secular-one flex overflow-hidden"
    >
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col border-l border-white/[0.06] bg-black/40 backdrop-blur-xl">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06]">
          <img
            src="/clix-logo.svg"
            alt="CLIX"
            className="h-7 w-7 drop-shadow-[0_0_8px_rgba(255,107,44,0.3)]"
          />
          <span className="font-bold text-lg text-white tracking-wide">
            CLIX
          </span>
          <span className="text-[10px] text-[#FF6B2C]/60 font-bold uppercase tracking-widest mr-auto">
            admin
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink
            to="/admin/approvals"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              )
            }
          >
            <Users className="w-4 h-4 shrink-0" />
            {t("navApprovals")}
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              )
            }
          >
            <UserRoundSearch className="w-4 h-4 shrink-0" />
            {t("navUsers")}
          </NavLink>
          <NavLink
            to="/admin/form-builder"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/[0.06]"
              )
            }
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            {t("navFormBuilder")}
          </NavLink>
        </nav>

        {/* Bottom: user info + logout */}
        <div className="px-3 py-4 border-t border-white/[0.06] space-y-2">
          {user && (
            <div className="px-3 py-2">
              <p className="text-xs text-white/30 truncate">{user.full_name}</p>
              <p className="text-xs text-white/20 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {t("logout")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
