import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LogOut,
  LayoutDashboard,
  Pencil,
  GitBranch,
  Upload,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useDraftStatus } from "@/hooks/useDraftStatus";
import { usePublishDraft } from "@/hooks/usePublishDraft";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "dashboard", end: true },
  { to: "/dashboard/edit-bot", icon: Pencil, label: "editBot", end: false },
  { to: "/dashboard/flow-builder", icon: GitBranch, label: "flowBuilder", end: false },
] as const;

export default function UserLayout() {
  const { t } = useTranslation("sidebar");
  const { t: td } = useTranslation("dashboard");
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { hasDraft } = useDraftStatus();
  const { publish, discard, isPublishing, isDiscarding, feedback } = usePublishDraft();

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
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/clix-logo.svg"
              alt="CLIX"
              className="h-7 w-7 drop-shadow-[0_0_8px_rgba(255,107,44,0.3)]"
            />
            <span className="font-bold text-lg text-[#2D2A26] tracking-wide">
              CLIX
            </span>
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

      {/* Publish Banner */}
      <AnimatePresence>
        {(hasDraft || feedback) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {feedback ? (
              <div
                className={cn(
                  "flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium",
                  feedback.type === "success"
                    ? "bg-emerald-50 text-emerald-700 border-b border-emerald-200"
                    : "bg-red-50 text-red-700 border-b border-red-200",
                )}
              >
                {feedback.type === "success" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                {td(feedback.message)}
              </div>
            ) : (
              <div className="flex items-center justify-between px-5 sm:px-8 py-2.5 bg-amber-50 border-b border-amber-200">
                <span className="text-sm font-medium text-amber-800">
                  {td("unpublishedChanges")}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={discard}
                    disabled={isDiscarding}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isDiscarding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    {td("discardDraft")}
                  </button>
                  <button
                    onClick={publish}
                    disabled={isPublishing}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-[#FF7E47] hover:bg-[#E86B38] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    {td("publishChanges")}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
