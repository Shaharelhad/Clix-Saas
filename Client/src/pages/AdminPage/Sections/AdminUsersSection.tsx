import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, Users } from "lucide-react";
import { supabase } from "@/services/supabase";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type BotFilter = "all" | "not_created" | "created" | "connected";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/15 text-red-400 border-red-500/20",
};

const BOT_COLORS: Record<string, string> = {
  not_created: "bg-white/[0.06] text-white/40 border-white/[0.08]",
  created: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

export default function AdminUsersSection() {
  const { t } = useTranslation("admin");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [botFilter, setBotFilter] = useState<BotFilter>("all");

  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["admin", "all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_profiles");
      if (error) throw error;
      return data;
    },
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      // Status filter
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      // Bot status filter
      if (botFilter !== "all" && u.bot_status !== botFilter) return false;
      return true;
    });
  }, [users, search, statusFilter, botFilter]);

  const statusFilters: StatusFilter[] = ["all", "pending", "approved", "rejected"];
  const botFilters: BotFilter[] = ["all", "not_created", "created", "connected"];

  const statusLabel = (s: StatusFilter) => {
    const map: Record<StatusFilter, string> = {
      all: t("filterAll"),
      pending: t("filterPending"),
      approved: t("filterApproved"),
      rejected: t("filterRejected"),
    };
    return map[s];
  };

  const botLabel = (b: BotFilter) => {
    const map: Record<BotFilter, string> = {
      all: t("filterAll"),
      not_created: t("botNotCreated"),
      created: t("botCreated"),
      connected: t("botConnected"),
    };
    return map[b];
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-white">{t("usersTitle")}</h1>
        <p className="text-white/40 text-sm mt-1">{t("usersSubtitle")}</p>
      </motion.div>

      {/* Search + Filters */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-6 space-y-3"
      >
        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6B2C]/40 transition-colors"
          />
        </div>

        {/* Filter rows */}
        <div className="flex flex-wrap gap-2">
          {/* Status filters */}
          {statusFilters.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer",
                statusFilter === s
                  ? "bg-[#FF6B2C]/15 text-[#FF6B2C] border-[#FF6B2C]/30"
                  : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60 hover:border-white/[0.12]"
              )}
            >
              {statusLabel(s)}
            </button>
          ))}

          <div className="w-px h-6 bg-white/[0.08] self-center mx-1" />

          {/* Bot status filters */}
          {botFilters.map((b) => (
            <button
              key={b}
              onClick={() => setBotFilter(b)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer",
                botFilter === b
                  ? "bg-[#FF6B2C]/15 text-[#FF6B2C] border-[#FF6B2C]/30"
                  : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60 hover:border-white/[0.12]"
              )}
            >
              {botLabel(b)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF6B2C]" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-5 text-red-400 text-sm">
          {t("errorLoadFailed")}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filteredUsers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-white/20"
        >
          <Users className="w-12 h-12 mb-4" />
          <p className="text-base">{t("usersEmpty")}</p>
        </motion.div>
      )}

      {/* User rows */}
      <AnimatePresence mode="popLayout">
        {filteredUsers.map((user, i) => (
          <motion.div
            key={user.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, delay: i * 0.03 }}
            onClick={() => navigate(`/admin/users/${user.id}`)}
            className="mb-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-200"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[#FF6B2C]/15 border border-[#FF6B2C]/20 flex items-center justify-center shrink-0 text-[#FF6B2C] font-bold text-sm">
              {user.full_name?.charAt(0) ?? "?"}
            </div>

            {/* Name + Email */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>

            {/* Status badge */}
            <span
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium border shrink-0",
                STATUS_COLORS[user.status] ?? STATUS_COLORS.pending
              )}
            >
              {statusLabel(user.status as StatusFilter)}
            </span>

            {/* Bot status badge */}
            <span
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium border shrink-0 hidden sm:inline-flex",
                BOT_COLORS[user.bot_status] ?? BOT_COLORS.not_created
              )}
            >
              {botLabel(user.bot_status as BotFilter)}
            </span>

            {/* Plan tier */}
            <span className="text-xs text-white/25 shrink-0 hidden md:block capitalize">
              {user.plan_tier ?? "—"}
            </span>

            {/* Date */}
            <span className="text-xs text-white/20 shrink-0 hidden lg:block">
              {new Date(user.created_at).toLocaleDateString("he-IL")}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
