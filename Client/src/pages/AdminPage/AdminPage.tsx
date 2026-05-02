import { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import LanguageToggle from "@/components/LanguageToggle";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Users,
  UserRoundSearch,
  ClipboardList,
  Ticket,
  Radio,
  Building2,
  LogOut,
  Settings,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useTenantStore } from "@/store/tenant.store";

const navItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, labelKey: "navDashboard" },
  { to: "/admin/approvals", icon: Users, labelKey: "navApprovals" },
  { to: "/admin/users", icon: UserRoundSearch, labelKey: "navUsers" },
  { to: "/admin/form-builder", icon: ClipboardList, labelKey: "navFormBuilder" },
  { to: "/admin/tickets", icon: Ticket, labelKey: "navTickets" },
  { to: "/admin/gateway", icon: Radio, labelKey: "navGateway" },
  { to: "/admin/tenants", icon: Building2, labelKey: "navTenants" },
] as const;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function AdminPage() {
  const { t } = useTranslation("admin");
  const { t: tSidebar } = useTranslation("sidebar");
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const tenantConfig = useTenantStore((s) => s.config);
  const isDefaultTenant = !tenantConfig || tenantConfig.slug === "clix";
  const surfaceBg = isDefaultTenant ? "bg-[#F8FAFC]" : "bg-[#FFF8F6]";

  const CurrentPageIcon = (() => {
    const p = location.pathname;
    if (p.startsWith("/admin/approvals")) return Users;
    if (p.startsWith("/admin/users")) return UserRoundSearch;
    if (p.startsWith("/admin/form-builder")) return ClipboardList;
    if (p.startsWith("/admin/tickets")) return Ticket;
    if (p.startsWith("/admin/gateway")) return Radio;
    if (p.startsWith("/admin/tenants")) return Building2;
    return LayoutDashboard;
  })();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsTriggerRef.current?.contains(e.target as Node)) return;
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSignOut = async () => {
    setSettingsOpen(false);
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div dir="rtl" className={`min-h-screen ${surfaceBg} text-[#261815]`}>
      {/* Right-anchored sidebar (physical right-0 keeps it visually identical in RTL/LTR). */}
      <aside className="fixed right-0 top-0 h-full w-64 z-50 hidden md:flex flex-col bg-white border-l border-zinc-200/50 shadow-[-20px_0_40px_rgba(0,0,0,0.02)]">
        <div className="px-8 py-6 cursor-default select-none">
          <BrandLogo className="h-9" />
        </div>

        <nav className="flex-1 flex flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-8 py-4 transition-all duration-200 active:scale-[0.97]",
                  isActive
                    ? "text-[var(--brand-primary)] font-bold border-l-4 border-[var(--brand-primary)] bg-[var(--brand-primary)]/5"
                    : "text-zinc-500 font-medium hover:bg-white/50",
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-4 flex flex-col gap-1 border-t border-zinc-100">
          <div className="relative">
            <button
              ref={settingsTriggerRef}
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 font-medium hover:bg-white/50 transition-all duration-200 rounded-xl text-start"
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span>{tSidebar("settings")}</span>
            </button>

            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  ref={settingsMenuRef}
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-2 inset-x-0 z-50 bg-white rounded-2xl shadow-[0_8px_32px_rgba(45,42,38,0.12)] border border-[#EDE6DD]/50 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm font-medium text-[#2D2A26]">
                      {tSidebar("language")}
                    </span>
                    <LanguageToggle />
                  </div>
                  <div className="border-t border-[#EDE6DD]/50" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {tSidebar("logout")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* Slim top header — profile chip + decorative current-page icon. */}
      <header className="fixed top-0 inset-x-0 h-14 z-40 bg-transparent flex items-center pr-4 md:pr-72 pl-4 md:pl-8">
        <div className="flex items-center gap-3 md:hidden">
          <BrandLogo className="h-6" />
        </div>

        <div dir="ltr" className="flex items-center gap-3 md:gap-4 ml-auto">
          <NavLink
            to="/dashboard/profile"
            className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-full hover:bg-white/60 transition-all duration-200 active:scale-95"
            aria-label="Open profile"
          >
            <span className="w-9 h-9 rounded-full bg-[var(--brand-primary-light)] text-white text-[11px] font-bold flex items-center justify-center shadow-sm border-2 border-white">
              {user ? getInitials(user.full_name) : "?"}
            </span>
            {user && (
              <div className="text-left hidden sm:block leading-tight">
                <p
                  className="text-sm font-bold text-zinc-900"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {user.full_name}
                </p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">
                  {user.role}
                </p>
              </div>
            )}
          </NavLink>

          <span aria-hidden className="h-8 w-px bg-zinc-200 hidden md:block" />

          <span
            aria-hidden
            className="text-zinc-400 hidden md:inline-flex items-center justify-center w-9 h-9 select-none cursor-default pointer-events-none"
          >
            <CurrentPageIcon className="w-5 h-5" />
          </span>
        </div>
      </header>

      <main className="md:pr-64 pt-14 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
