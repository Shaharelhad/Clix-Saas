import { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  LayoutDashboard,
  Pencil,
  GitBranch,
  UserCircle,
  Headphones,
  ChevronDown,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import SupportTicketModal from "@/components/SupportTicketModal";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "dashboard", end: true },
  { to: "/dashboard/edit-bot", icon: Pencil, label: "editBot", end: false },
  { to: "/dashboard/flow-builder", icon: GitBranch, label: "flowBuilder", end: false },
] as const;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function UserLayout() {
  const { t } = useTranslation("sidebar");
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSignOut = async () => {
    setMenuOpen(false);
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
        <div className="max-w-full mx-auto px-3 sm:px-5 md:px-8 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/clix-logo-full.png"
              alt="CLIX"
              className="h-6 drop-shadow-[0_0_8px_rgba(255,107,44,0.3)]"
            />
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                preventScrollReset
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all duration-200",
                    isActive
                      ? "bg-[#FF7E47]/10 text-[#FF7E47] border border-[#FF7E47]/20"
                      : "text-[#7A7267] hover:text-[#2D2A26] hover:bg-[#EDE6DD]/40 border border-transparent",
                  )
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{t(item.label)}</span>
              </NavLink>
            ))}
          </nav>

          {/* Avatar Dropdown */}
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full transition-all duration-200 hover:opacity-80 active:scale-95"
              aria-label="User menu"
            >
              <span className="w-9 h-9 rounded-full bg-[#FF7E47] text-white text-xs font-bold flex items-center justify-center shadow-sm">
                {user ? getInitials(user.full_name) : "?"}
              </span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-[#7A7267] transition-transform duration-200 hidden sm:block",
                  menuOpen && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute end-0 top-full mt-2 z-50 bg-white rounded-xl shadow-[0_8px_32px_rgba(45,42,38,0.12)] border border-[#EDE6DD]/50 overflow-hidden min-w-[220px]"
                >
                  {/* User info header */}
                  {user && (
                    <div className="px-4 py-3 border-b border-[#EDE6DD]/50">
                      <p className="text-sm font-bold text-[#2D2A26] truncate">
                        {user.full_name}
                      </p>
                      <p className="text-xs text-[#A39B90] truncate" dir="ltr">
                        {user.email}
                      </p>
                    </div>
                  )}

                  {/* Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/dashboard/profile");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#2D2A26] hover:bg-[#FAF7F3] transition-colors"
                  >
                    <UserCircle className="w-4 h-4 text-[#7A7267]" />
                    {t("profile")}
                  </button>

                  {/* Divider */}
                  <div className="border-t border-[#EDE6DD]/50" />

                  {/* Logout */}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("logout")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      {/* Floating Support Button — hidden on flow builder (has its own assistant) */}
      {!location.pathname.includes("/flow-builder") && (
        <button
          type="button"
          onClick={() => setSupportModalOpen(true)}
          className="fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full bg-[#FF7E47] text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
          aria-label={t("support")}
          title={t("support")}
        >
          <Headphones className="w-5 h-5" />
        </button>
      )}

      {user?.id && (
        <SupportTicketModal
          open={supportModalOpen}
          onClose={() => setSupportModalOpen(false)}
          userId={user.id}
        />
      )}
    </div>
  );
}
