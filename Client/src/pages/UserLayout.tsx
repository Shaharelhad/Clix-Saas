import { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import { isMainDomain } from "@/lib/tenant";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  LayoutDashboard,
  Pencil,
  GitBranch,
  Headphones,
  Settings,
  HelpCircle,
  LayoutGrid,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import SupportTicketModal from "@/components/SupportTicketModal";
import { cn } from "@/lib/utils";
import LanguageToggle from "@/components/LanguageToggle";
import { useTenantStore } from "@/store/tenant.store";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const tenantConfig = useTenantStore((s) => s.config);
  // Default CLIX tenant gets the new slate surface; white-label tenants keep the
  // existing cream so their previously-shipped look is preserved untouched.
  const isDefaultTenant = !tenantConfig || tenantConfig.slug === "clix";
  const surfaceBg = isDefaultTenant ? "bg-[#F8FAFC]" : "bg-[#FFF8F6]";

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Close settings popover on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsTriggerRef.current?.contains(e.target as Node)) return;
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close settings popover on Escape
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
      {/* ── Right Sidebar (always pinned to the visual right edge, matching the
          Stitch design which uses physical positioning so RTL and LTR look identical). */}
      <aside
        className="fixed right-0 top-0 h-full w-64 z-50 hidden md:flex flex-col bg-white border-l border-zinc-200/50 shadow-[-20px_0_40px_rgba(0,0,0,0.02)]"
      >
        {/* Brand — static, non-interactive label */}
        <div className="px-8 py-6 cursor-default select-none">
          <BrandLogo className="h-9" />
        </div>

        {/* Primary nav */}
        <nav className="flex-1 flex flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              preventScrollReset
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
              <span>{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer block */}
        <div className="mt-auto p-4 flex flex-col gap-1 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => isMainDomain() && setSupportModalOpen(true)}
            className="flex items-center gap-3 px-4 py-3 text-zinc-500 font-medium hover:bg-white/50 transition-all duration-200 rounded-xl text-start"
          >
            <HelpCircle className="w-5 h-5 shrink-0" />
            <span>{t("help")}</span>
          </button>

          {/* Settings — opens a popover above with language + logout */}
          <div className="relative">
            <button
              ref={settingsTriggerRef}
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="w-full flex items-center gap-3 px-4 py-3 text-zinc-500 font-medium hover:bg-white/50 transition-all duration-200 rounded-xl text-start"
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span>{t("settings")}</span>
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
                      {t("language")}
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
                    {t("logout")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      {/* ── Slim Top Header ── */}
      <header className="fixed top-0 inset-x-0 h-14 z-40 bg-transparent flex items-center pr-4 md:pr-72 pl-4 md:pl-8">
        {/* Mobile-only brand mark on the left */}
        <div className="flex items-center gap-3 md:hidden">
          <BrandLogo className="h-6" />
        </div>

        {/* Action cluster sits on the visual right (next to the sidebar).
            ml-auto pushes everything before it to the left, so the cluster floats
            against the sidebar. dir="ltr" locks an unambiguous left-to-right
            reading order inside the chip — avatar → name+plan → grid —
            independent of the page's RTL/LTR direction. */}
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

          {/* Vertical separator between profile chip and the decorative mark */}
          <span aria-hidden className="h-8 w-px bg-zinc-200 hidden md:block" />

          {/* Decorative grid mark — non-interactive */}
          <span
            aria-hidden
            className="text-zinc-400 hidden md:inline-flex items-center justify-center w-9 h-9 select-none cursor-default pointer-events-none"
          >
            <LayoutGrid className="w-5 h-5" />
          </span>
        </div>
      </header>

      {/* ── Main content (right padding reserves space for the right-anchored sidebar) ── */}
      <main className="md:pr-64 pt-14 min-h-screen">
        <Outlet />
      </main>

      {/* ── Mobile floating support button (hidden on flow builder; collapses bigger on mobile) ── */}
      {isMainDomain() && !location.pathname.includes("/flow-builder") && (
        <button
          type="button"
          onClick={() => setSupportModalOpen(true)}
          className="md:hidden fixed bottom-6 left-6 z-40 w-12 h-12 rounded-full bg-[var(--brand-primary-light)] text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
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
