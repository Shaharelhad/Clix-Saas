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
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
};

const BOT_COLORS: Record<string, string> = {
  not_created: "bg-gray-100 text-gray-500 border-gray-200",
  created: "bg-blue-50 text-blue-700 border-blue-200",
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
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
      if (search) {
        const q = search.toLowerCase();
        const matchesSearch =
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.phone?.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
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
        <h1 className="text-2xl font-bold text-[#111111]">{t("usersTitle")}</h1>
        <p className="text-[#999999] text-sm mt-1">{t("usersSubtitle")}</p>
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
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full bg-white border border-[#E8E4DF] rounded-xl pr-10 pl-4 py-2.5 text-sm text-[#111111] placeholder:text-[#BBBBBB] focus:outline-none focus:border-[#D8723C]/50 focus:ring-2 focus:ring-[#D8723C]/10 transition-colors"
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
                  ? "bg-[#D8723C]/10 text-[#D8723C] border-[#D8723C]/30"
                  : "bg-transparent text-[#777777] border-[#E0DBD6] hover:text-[#333333] hover:border-[#C5BEB8]"
              )}
            >
              {statusLabel(s)}
            </button>
          ))}

          <div className="w-px h-6 bg-[#E0DBD6] self-center mx-1" />

          {/* Bot status filters */}
          {botFilters.map((b) => (
            <button
              key={b}
              onClick={() => setBotFilter(b)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer",
                botFilter === b
                  ? "bg-[#D8723C]/10 text-[#D8723C] border-[#D8723C]/30"
                  : "bg-transparent text-[#777777] border-[#E0DBD6] hover:text-[#333333] hover:border-[#C5BEB8]"
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
          <Loader2 className="w-8 h-8 animate-spin text-[#D8723C]" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-600 text-sm">
          {t("errorLoadFailed")}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && filteredUsers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-[#CCCCCC]"
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
            className="mb-2 rounded-2xl border border-[#E8E4DF] bg-white px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-[#FDF9F6] hover:border-[#D8723C]/30 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[#D8723C]/10 border border-[#D8723C]/20 flex items-center justify-center shrink-0 text-[#D8723C] font-bold text-sm">
              {user.full_name?.charAt(0) ?? "?"}
            </div>

            {/* Name + Email */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#111111] truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-[#999999] truncate">{user.email}</p>
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
            <span className="text-xs text-[#BBBBBB] shrink-0 hidden md:block capitalize">
              {user.plan_tier ?? "\u2014"}
            </span>

            {/* Date */}
            <span className="text-xs text-[#CCCCCC] shrink-0 hidden lg:block">
              {new Date(user.created_at).toLocaleDateString("he-IL")}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
