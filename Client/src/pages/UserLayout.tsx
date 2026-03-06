import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, LayoutDashboard, FileText, HelpCircle, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "dashboard", end: true },
  { to: "/dashboard/business-content", icon: FileText, label: "businessContent", end: false },
  { to: "/dashboard/faq", icon: HelpCircle, label: "faq", end: false },
] as const;

export default function UserLayout() {
  const { t } = useTranslation("sidebar");
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <div className="max-w-full mx-auto px-5 sm:px-8 flex items-center justify-between h-14">
          {/* Logo + mobile toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-[#EDE6DD]/60 transition-colors cursor-pointer"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-[#2D2A26]" /> : <Menu className="w-5 h-5 text-[#2D2A26]" />}
            </button>
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

      <div className="flex">
        {/* Sidebar overlay on mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed top-14 right-0 z-20 h-[calc(100vh-3.5rem)] w-56 bg-white/90 backdrop-blur-xl border-l border-[#EDE6DD]/60 shadow-[2px_0_12px_rgba(45,42,38,0.04)] transition-transform duration-200 ease-out",
            "lg:sticky lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
          )}
        >
          <nav className="flex flex-col gap-1.5 p-4 pt-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                preventScrollReset
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-[#FF7E47]/10 text-[#FF7E47] border border-[#FF7E47]/20"
                      : "text-[#7A7267] hover:text-[#2D2A26] hover:bg-[#EDE6DD]/40"
                  )
                }
              >
                <item.icon className="w-4.5 h-4.5 shrink-0" />
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
