import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2, Users } from "lucide-react";
import { supabase } from "@/services/supabase";
import { cn } from "@/lib/utils";
import AdminSectionHeader from "../components/AdminSectionHeader";

export default function AdminApprovalsSection() {
  const { t } = useTranslation("admin");
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const {
    data: pendingUsers,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin", "pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_profiles", {
        p_status: "pending",
      });
      if (error) throw error;
      return data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "approved" | "rejected";
    }) => {
      const { error } = await supabase.rpc("admin_update_profile_status", {
        p_id: id,
        p_status: status,
      });
      if (error) throw error;
    },
    onMutate: ({ id }) => setProcessingId(id),
    onSettled: () => {
      setProcessingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-users"] });
    },
  });

  return (
    <div className="p-4 lg:p-5 max-w-[1600px] mx-auto space-y-4">
      <AdminSectionHeader
        title={t("approvalsTitle")}
        subtitle={t("approvalsSubtitle")}
      />

      <div className="max-w-4xl">
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
      {!isLoading && !isError && pendingUsers?.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-[#CCCCCC]"
        >
          <Users className="w-12 h-12 mb-4" />
          <p className="text-base">{t("emptyState")}</p>
        </motion.div>
      )}

      {/* User cards */}
      <AnimatePresence mode="popLayout">
        {pendingUsers?.map((user, i) => (
          <motion.div
            key={user.id}
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 40, scale: 0.96 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="mb-3 rounded-2xl border border-[#E8E4DF] bg-white px-5 py-4 flex items-center gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[var(--brand-primary)]/10 border border-[var(--brand-primary)]/20 flex items-center justify-center shrink-0 text-[var(--brand-primary)] font-bold text-sm">
              {user.full_name?.charAt(0) ?? "?"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#111111] truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-[#999999] truncate">{user.email}</p>
              {user.phone && (
                <p className="text-xs text-[#BBBBBB] truncate">{user.phone}</p>
              )}
            </div>

            {/* Date */}
            <p className="text-xs text-[#CCCCCC] shrink-0 hidden sm:block">
              {new Date(user.created_at).toLocaleDateString("he-IL")}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  statusMutation.mutate({ id: user.id, status: "rejected" })
                }
                disabled={processingId === user.id}
                className={cn(
                  "w-9 h-9 rounded-xl border border-red-200 bg-red-50 text-red-600",
                  "hover:bg-red-100 hover:border-red-300 transition-all duration-200",
                  "flex items-center justify-center cursor-pointer",
                  processingId === user.id && "opacity-40 pointer-events-none"
                )}
              >
                {processingId === user.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  statusMutation.mutate({ id: user.id, status: "approved" })
                }
                disabled={processingId === user.id}
                className={cn(
                  "w-9 h-9 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700",
                  "hover:bg-emerald-100 hover:border-emerald-300 transition-all duration-200",
                  "flex items-center justify-center cursor-pointer",
                  processingId === user.id && "opacity-40 pointer-events-none"
                )}
              >
                {processingId === user.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      </div>
    </div>
  );
}
