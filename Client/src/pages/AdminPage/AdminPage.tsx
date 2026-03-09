import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  UserRoundSearch,
  ClipboardList,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, labelKey: "navDashboard" },
  { to: "/admin/approvals", icon: Users, labelKey: "navApprovals" },
  { to: "/admin/users", icon: UserRoundSearch, labelKey: "navUsers" },
  { to: "/admin/form-builder", icon: ClipboardList, labelKey: "navFormBuilder" },
];

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
      className="h-screen bg-[#F7F5F2] text-[#111111] font-secular-one flex flex-col overflow-hidden"
    >
      {/* Top Navbar */}
      <header className="shrink-0 border-b border-black/[0.07] bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img
              src="/clix-logo.svg"
              alt="CLIX"
              className="h-7 w-7 drop-shadow-[0_1px_3px_rgba(216,114,60,0.2)]"
            />
            <span className="font-bold text-lg text-[#111111] tracking-wide">
              CLIX
            </span>
            <span className="text-[10px] text-[#D8723C]/60 font-bold uppercase tracking-widest">
              admin
            </span>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all duration-200",
                    isActive
                      ? "bg-[#D8723C]/10 text-[#D8723C] border border-[#D8723C]/25"
                      : "text-[#666666] hover:text-[#111111] hover:bg-black/[0.04] border border-transparent"
                  )
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>

          {/* User + Logout */}
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-[#AAAAAA] hidden sm:block">
                {user.full_name}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#999999] hover:text-[#444444] hover:bg-black/[0.04] transition-all duration-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
