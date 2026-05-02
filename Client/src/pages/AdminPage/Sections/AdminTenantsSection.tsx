import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Loader2,
  Building2,
  Globe,
  Mail,
  Phone,
  ExternalLink,
  Eye,
} from "lucide-react";
import { supabase } from "@/services/supabase";
import { cn } from "@/lib/utils";
import AdminSectionHeader from "../components/AdminSectionHeader";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  icon_url: string | null;
  primary_color: string;
  primary_hover: string;
  contact_email: string;
  contact_phone: string | null;
  website_url: string | null;
  custom_domain: string | null;
  app_title: string;
  status: string;
  is_active: boolean;
  created_at: string;
};

export default function AdminTenantsSection() {
  const { t } = useTranslation("admin");
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [previewTenant, setPreviewTenant] = useState<TenantRow | null>(null);

  const { data: tenants, isLoading, isError } = useQuery({
    queryKey: ["admin", "tenants", filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_tenants", {
        p_status: filter === "all" ? undefined : filter,
      });
      if (error) throw error;
      // Hide the default platform tenant — it's the main site, not a white-label customer
      const defaultSlug = import.meta.env.VITE_DEFAULT_TENANT_SLUG || "clix";
      return (data as TenantRow[]).filter((t) => t.slug !== defaultSlug);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.rpc("admin_update_tenant_status", {
        p_id: id,
        p_status: status,
      });
      if (error) throw error;
    },
    onMutate: ({ id }) => setProcessingId(id),
    onSettled: () => {
      setProcessingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });

  const filters = [
    { key: "pending" as const, label: t("tenantFilterPending") },
    { key: "approved" as const, label: t("tenantFilterApproved") },
    { key: "rejected" as const, label: t("tenantFilterRejected") },
    { key: "all" as const, label: t("tenantFilterAll") },
  ];

  return (
    <div className="p-4 lg:p-5 max-w-[1600px] mx-auto space-y-4">
      <AdminSectionHeader
        title={t("tenantsTitle")}
        subtitle={t("tenantsSubtitle")}
      />

      <div className="max-w-5xl">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-bold transition-all",
              filter === f.key
                ? "bg-[var(--brand-primary)] text-white"
                : "bg-black/[0.04] text-[#666666] hover:bg-black/[0.08]",
            )}
          >
            {f.label}
            {filter === f.key && tenants ? ` (${tenants.length})` : ""}
          </button>
        ))}
      </div>

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
      {!isLoading && !isError && tenants?.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 text-[#AAAAAA]"
        >
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t("tenantsEmpty")}</p>
        </motion.div>
      )}

      {/* Tenant cards */}
      <AnimatePresence mode="popLayout">
        {tenants?.map((tenant, i) => (
          <motion.div
            key={tenant.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl border border-black/[0.06] p-5 mb-4 shadow-sm"
          >
            <div className="flex items-start gap-4">
              {/* Logo / color swatch */}
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-black/5"
                style={{ backgroundColor: tenant.primary_color + "15" }}
              >
                {tenant.logo_url ? (
                  <img src={tenant.logo_url} alt="" className="w-10 h-10 object-contain" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg"
                    style={{ backgroundColor: tenant.primary_color }}
                  />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-[#111111] text-lg">{tenant.name}</h3>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                      tenant.status === "pending" && "bg-amber-100 text-amber-700",
                      tenant.status === "approved" && "bg-emerald-100 text-emerald-700",
                      tenant.status === "rejected" && "bg-red-100 text-red-700",
                    )}
                  >
                    {tenant.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-[#888888] flex-wrap">
                  <span className="flex items-center gap-1 font-mono">
                    <Globe className="w-3.5 h-3.5" />
                    {tenant.custom_domain || `${tenant.slug}.${import.meta.env.VITE_BASE_DOMAIN || "clix-bot.com"}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {tenant.contact_email}
                  </span>
                  {tenant.contact_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {tenant.contact_phone}
                    </span>
                  )}
                </div>

                {/* Color preview */}
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className="w-5 h-5 rounded-md border border-black/10"
                    style={{ backgroundColor: tenant.primary_color }}
                    title={`Primary: ${tenant.primary_color}`}
                  />
                  <span className="text-xs text-[#AAAAAA] font-mono">{tenant.primary_color}</span>
                  {tenant.website_url && (
                    <a
                      href={tenant.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--brand-primary)] flex items-center gap-1 hover:underline mr-auto"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {t("tenantVisitSite")}
                    </a>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewTenant(previewTenant?.id === tenant.id ? null : tenant)}
                  className="p-2 rounded-lg text-[#999999] hover:bg-black/[0.04] transition-colors"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>

                {tenant.status === "pending" && (
                  <>
                    <button
                      type="button"
                      disabled={processingId === tenant.id}
                      onClick={() => statusMutation.mutate({ id: tenant.id, status: "approved" })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      {processingId === tenant.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {t("approve")}
                    </button>
                    <button
                      type="button"
                      disabled={processingId === tenant.id}
                      onClick={() => statusMutation.mutate({ id: tenant.id, status: "rejected" })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      {t("reject")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Preview panel */}
            <AnimatePresence>
              {previewTenant?.id === tenant.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 pt-4 border-t border-black/[0.06]">
                    <p className="text-xs text-[#AAAAAA] mb-3 font-bold uppercase tracking-wider">
                      {t("tenantBrandPreview")}
                    </p>
                    <div
                      className="rounded-xl p-6 text-center"
                      style={{ backgroundColor: tenant.primary_color + "10" }}
                    >
                      {tenant.logo_url && (
                        <img src={tenant.logo_url} alt="" className="h-10 mx-auto mb-3" />
                      )}
                      <p className="font-bold text-lg" style={{ color: tenant.primary_color }}>
                        {tenant.app_title || tenant.name}
                      </p>
                      <div className="flex justify-center gap-2 mt-3">
                        <div
                          className="px-4 py-2 rounded-lg text-white text-sm font-bold"
                          style={{ backgroundColor: tenant.primary_color }}
                        >
                          {t("tenantSampleButton")}
                        </div>
                        <div
                          className="px-4 py-2 rounded-lg text-sm font-bold border"
                          style={{
                            color: tenant.primary_color,
                            borderColor: tenant.primary_color + "40",
                          }}
                        >
                          {t("tenantSampleOutline")}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
      </div>
    </div>
  );
}
