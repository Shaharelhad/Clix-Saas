import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  LayoutDashboard,
  Pencil,
  GitBranch,
  BookOpen,
  Headphones,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import RagUploadModal from "@/components/RagUploadModal";
import SupportTicketModal from "@/components/SupportTicketModal";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "dashboard", end: true },
  { to: "/dashboard/edit-bot", icon: Pencil, label: "editBot", end: false },
  { to: "/dashboard/flow-builder", icon: GitBranch, label: "flowBuilder", end: false },
] as const;

export default function UserLayout() {
  const { t } = useTranslation("sidebar");
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [ragModalOpen, setRagModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  const { data: ragStatus } = useQuery({
    queryKey: ["rag-status", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_documents")
        .select("status")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.status ?? null;
    },
  });
  const hasReadyDoc = ragStatus === "ready";

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

          {/* Knowledge Base + User info + logout */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setRagModalOpen(true)}
              className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#7A7267] hover:text-[#2D2A26] hover:bg-[#EDE6DD]/40 transition-all duration-200 cursor-pointer"
              title={t("knowledgeBase")}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t("knowledgeBase")}</span>
              {hasReadyDoc && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
              )}
            </button>
            <button
              onClick={() => setSupportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#7A7267] hover:text-[#2D2A26] hover:bg-[#EDE6DD]/40 transition-all duration-200 cursor-pointer"
              title={t("support")}
            >
              <Headphones className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t("support")}</span>
            </button>
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
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      <RagUploadModal isOpen={ragModalOpen} onClose={() => setRagModalOpen(false)} />
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
