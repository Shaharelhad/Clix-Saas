import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2, Users } from "lucide-react";
import { supabase } from "@/services/supabase";
import { cn } from "@/lib/utils";

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
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-white">
          {t("approvalsTitle")}
        </h1>
        <p className="text-white/40 text-sm mt-1">{t("approvalsSubtitle")}</p>
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
      {!isLoading && !isError && pendingUsers?.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 text-white/20"
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
            className="mb-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 flex items-center gap-4"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-[#FF6B2C]/15 border border-[#FF6B2C]/20 flex items-center justify-center shrink-0 text-[#FF6B2C] font-bold text-sm">
              {user.full_name?.charAt(0) ?? "?"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
              {user.phone && (
                <p className="text-xs text-white/25 truncate">{user.phone}</p>
              )}
            </div>

            {/* Date */}
            <p className="text-xs text-white/20 shrink-0 hidden sm:block">
              {new Date(user.created_at).toLocaleDateString("he-IL")}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() =>
                  statusMutation.mutate({ id: user.id, status: "rejected" })
                }
                disabled={processingId === user.id}
                className={cn(
                  "w-9 h-9 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400",
                  "hover:bg-red-500/20 hover:border-red-500/40 transition-all duration-200",
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
                onClick={() =>
                  statusMutation.mutate({ id: user.id, status: "approved" })
                }
                disabled={processingId === user.id}
                className={cn(
                  "w-9 h-9 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
                  "hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all duration-200",
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
  );
}
