import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, Users, Trash2, AlertTriangle, X } from "lucide-react";
import { supabase } from "@/services/supabase";
import { cn } from "@/lib/utils";
import AdminSectionHeader from "../components/AdminSectionHeader";

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

type DeleteTarget = { id: string; email: string; full_name: string } | null;

export default function AdminUsersSection() {
  const { t } = useTranslation("admin");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [botFilter, setBotFilter] = useState<BotFilter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = (type: "success" | "error", text: string) => {
    clearTimeout(toastTimer.current);
    setToast({ type, text });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api`;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          ...(session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ action: "delete_user", userId, confirmEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      setConfirmEmail("");
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "all-users"] });
      showToast("success", t("deleteUserSuccess"));
    },
    onError: (err: Error) => {
      showToast("error", err.message || t("deleteUserError"));
    },
  });

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
    <div className="p-4 lg:p-5 max-w-[1600px] mx-auto space-y-4">
      <AdminSectionHeader
        title={t("usersTitle")}
        subtitle={t("usersSubtitle")}
      />

      <div className="max-w-5xl">
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
            className="w-full bg-white border border-[#E8E4DF] rounded-xl pr-10 pl-4 py-2.5 text-sm text-[#111111] placeholder:text-[#BBBBBB] focus:outline-none focus:border-[var(--brand-primary)]/50 focus:ring-2 focus:ring-[var(--brand-primary)]/10 transition-colors"
          />
        </div>

        {/* Filter rows */}
        <div className="flex flex-wrap gap-2">
          {/* Status filters */}
          {statusFilters.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer",
                statusFilter === s
                  ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/30"
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
              type="button"
              key={b}
              onClick={() => setBotFilter(b)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer",
                botFilter === b
                  ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/30"
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
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-primary)]" />
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
            onClick={() =>
              setSelectedUserId((prev) => (prev === user.id ? null : user.id))
            }
            className={cn(
              "mb-2 rounded-2xl border bg-white px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-[#FDF9F6] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
              selectedUserId === user.id
                ? "border-red-300 hover:border-red-300"
                : "border-[#E8E4DF] hover:border-[var(--brand-primary)]/30"
            )}
          >
            {/* Trash icon \u2014 slides in from left when selected */}
            <AnimatePresence>
              {selectedUserId === user.id && (
                <motion.button
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 36 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({
                      id: user.id,
                      email: user.email,
                      full_name: user.full_name,
                    });
                  }}
                  className="shrink-0 w-9 h-9 rounded-xl border border-red-200 bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors overflow-hidden cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 flex items-center justify-center shrink-0 text-[var(--brand-primary)] font-bold text-sm">
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

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => {
              if (!deleteMutation.isPending) {
                setDeleteTarget(null);
                setConfirmEmail("");
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <h2 className="text-lg font-bold text-[#111111]">
                    {t("deleteUserTitle")}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!deleteMutation.isPending) {
                      setDeleteTarget(null);
                      setConfirmEmail("");
                    }
                  }}
                  className="text-[#AAAAAA] hover:text-[#555555] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FDF9F6] border border-[#E8E4DF]">
                <div className="w-9 h-9 rounded-full bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 flex items-center justify-center text-[var(--brand-primary)] font-bold text-sm shrink-0">
                  {deleteTarget.full_name?.charAt(0) ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111111] truncate">
                    {deleteTarget.full_name}
                  </p>
                  <p className="text-xs text-[#999999] truncate">
                    {deleteTarget.email}
                  </p>
                </div>
              </div>

              {/* Warning */}
              <p className="text-sm text-red-600 leading-relaxed">
                {t("deleteUserWarning")}
              </p>

              {/* Email confirmation input */}
              <div className="space-y-2">
                <label className="text-sm text-[#555555]">
                  {t("deleteUserConfirmLabel")}
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={deleteTarget.email}
                  disabled={deleteMutation.isPending}
                  className="w-full bg-white border border-[#E8E4DF] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#CCCCCC] focus:outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 transition-colors disabled:opacity-50"
                  dir="ltr"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(null);
                    setConfirmEmail("");
                  }}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-[#E8E4DF] text-sm font-medium text-[#555555] hover:bg-[#F5F2EF] transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {t("deleteUserCancel")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteMutation.mutate({
                      userId: deleteTarget.id,
                      email: confirmEmail,
                    })
                  }
                  disabled={
                    confirmEmail !== deleteTarget.email ||
                    deleteMutation.isPending
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t("deleteUserButton")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium",
              toast.type === "success"
                ? "bg-emerald-600 text-white"
                : "bg-red-600 text-white"
            )}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
