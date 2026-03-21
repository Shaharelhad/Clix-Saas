import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Trash2, Pencil, Plug, Loader2, CheckCircle2, XCircle, Zap } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { callTestIntegration } from "@/services/edge-functions";
import type { Json } from "@/types/database";

/* ── Types ── */

type IntegrationType = "cloudbeds" | "custom_api";

interface CloudbedsConfig {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  propertyId: string;
  bookingUrl: string;
}

interface CustomApiConfig {
  name: string;
  baseUrl: string;
  authType: "bearer" | "api_key";
  authValue: string;
}

type IntegrationConfig = CloudbedsConfig | CustomApiConfig;

interface Integration {
  id: string;
  integration_type: IntegrationType;
  config: IntegrationConfig;
  status: string;
  created_at: string;
}

/* ── Helpers ── */

function mask(value: string): string {
  if (!value || value.length <= 4) return "****";
  return "****" + value.slice(-4);
}

/* ── Form State ── */

interface FormState {
  type: IntegrationType;
  clientId: string;
  clientSecret: string;
  apiKey: string;
  propertyId: string;
  bookingUrl: string;
  name: string;
  baseUrl: string;
  authType: "bearer" | "api_key";
  authValue: string;
}

const EMPTY_FORM: FormState = {
  type: "cloudbeds",
  clientId: "",
  clientSecret: "",
  apiKey: "",
  propertyId: "",
  bookingUrl: "",
  name: "",
  baseUrl: "",
  authType: "bearer",
  authValue: "",
};

function formToConfig(form: FormState): IntegrationConfig {
  if (form.type === "cloudbeds") {
    return { clientId: form.clientId, clientSecret: form.clientSecret, apiKey: form.apiKey, propertyId: form.propertyId, bookingUrl: form.bookingUrl };
  }
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    authType: form.authType,
    authValue: form.authValue,
  };
}

function configToForm(type: IntegrationType, config: IntegrationConfig): FormState {
  if (type === "cloudbeds") {
    const c = config as CloudbedsConfig;
    return { ...EMPTY_FORM, type, clientId: c.clientId, clientSecret: c.clientSecret, apiKey: c.apiKey, propertyId: c.propertyId || "", bookingUrl: c.bookingUrl || "" };
  }
  const c = config as CustomApiConfig;
  return {
    ...EMPTY_FORM,
    type,
    name: c.name,
    baseUrl: c.baseUrl,
    authType: c.authType || "bearer",
    authValue: c.authValue,
  };
}

/* ── Component ── */

interface FlowIntegrationsModalProps {
  onClose: () => void;
}

export default function FlowIntegrationsModal({ onClose }: FlowIntegrationsModalProps) {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testError, setTestError] = useState<string | null>(null);

  // Wrap setForm to reset test status on any field change
  const updateForm = (updater: FormState | ((f: FormState) => FormState)) => {
    setForm(updater);
    setTestStatus("idle");
    setTestError(null);
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["integrations", user?.id] });

  /* ── Queries ── */

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integrations", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Integration[];
    },
    enabled: !!user?.id,
  });

  /* ── Mutations ── */

  const saveMutation = useMutation({
    mutationFn: async () => {
      const config = formToConfig(form);
      if (editingId) {
        const { error } = await supabase
          .from("integrations")
          .update({
            integration_type: form.type,
            config: config as unknown as Json,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({
          user_id: user!.id,
          integration_type: form.type,
          config: config as unknown as Json,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      showFeedback(t("integrationSaved"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setConfirmDeleteId(null);
      showFeedback(t("integrationDeleted"));
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from("integrations")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  /* ── Handlers ── */

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setTestStatus("idle");
    setTestError(null);
    setShowForm(true);
  };

  const openEdit = (item: Integration) => {
    setForm(configToForm(item.integration_type, item.config));
    setEditingId(item.id);
    setTestStatus("idle");
    setTestError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTestStatus("idle");
    setTestError(null);
  };

  const handleTest = async () => {
    setTestStatus("testing");
    setTestError(null);
    const config = formToConfig(form);
    const result = await callTestIntegration({
      integration_type: form.type,
      config,
    });
    if (result.error) {
      setTestStatus("error");
      setTestError(result.error);
    } else {
      const data = result.data as { success?: boolean; error?: string; propertyId?: string } | null;
      if (data?.success) {
        setTestStatus("success");
        // Auto-store propertyId from Cloudbeds getHotelDetails response
        if (form.type === "cloudbeds" && data.propertyId) {
          setForm((f) => ({ ...f, propertyId: data.propertyId! }));
        }
      } else {
        setTestStatus("error");
        setTestError(data?.error || t("testConnectionFailed"));
      }
    }
  };

  const handleSave = () => {
    if (form.type === "cloudbeds" && !form.apiKey.trim()) return;
    if (form.type === "custom_api" && !form.baseUrl.trim()) return;
    saveMutation.mutate();
  };

  const isFormValid =
    form.type === "cloudbeds" ? !!form.apiKey.trim() : !!form.baseUrl.trim();

  /* ── Field input class ── */
  const fieldCls =
    "w-full border border-[#EDE6DD] rounded-md px-2.5 py-1.5 text-xs text-[#2D2A26] bg-white focus:outline-none focus:border-[#FF7E47] transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-[380px] max-h-[80vh] overflow-y-auto border border-[#EDE6DD]/60">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EDE6DD]/40">
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-[#FF7E47]" />
            <span className="text-sm font-bold text-[#2D2A26]">{t("integrationsTitle")}</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-[#EDE6DD]/40 cursor-pointer" aria-label="Close">
            <X className="w-4 h-4 text-[#7A7267]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Feedback */}
          {feedback && (
            <p className="text-xs text-emerald-600 mb-3">{feedback}</p>
          )}

          {/* Add button */}
          {!showForm && (
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF7E47] hover:bg-[#E86B38] text-white text-xs font-bold transition-colors cursor-pointer mb-4"
            >
              <Plus className="w-3.5 h-3.5" />
              {t("addIntegration")}
            </button>
          )}

          {/* Form */}
          {showForm && (
            <div className="mb-4 bg-[#FAF7F3] rounded-lg p-3 border border-[#EDE6DD]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#2D2A26]">
                  {editingId ? t("editIntegration") : t("addIntegration")}
                </span>
                <button type="button" onClick={closeForm} className="p-0.5 rounded hover:bg-white cursor-pointer" aria-label="Close">
                  <X className="w-3.5 h-3.5 text-[#7A7267]" />
                </button>
              </div>

              {/* Type */}
              <div className="mb-2">
                <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                  {t("selectType")}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => updateForm({ ...EMPTY_FORM, type: e.target.value as IntegrationType })}
                  className={fieldCls}
                >
                  <option value="cloudbeds">{t("integrationTypeCloudbeds")}</option>
                  <option value="custom_api">{t("integrationTypeCustomApi")}</option>
                </select>
              </div>

              {/* Cloudbeds */}
              {form.type === "cloudbeds" && (
                <>
                  <div className="mb-2">
                    <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                      {t("integrationClientId")}
                    </label>
                    <input
                      type="password"
                      value={form.clientId}
                      onChange={(e) => updateForm((f) => ({ ...f, clientId: e.target.value }))}
                      className={fieldCls}
                      dir="ltr"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                      {t("integrationClientSecret")}
                    </label>
                    <input
                      type="password"
                      value={form.clientSecret}
                      onChange={(e) => updateForm((f) => ({ ...f, clientSecret: e.target.value }))}
                      className={fieldCls}
                      dir="ltr"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                      {t("integrationApiKey")}
                    </label>
                    <input
                      type="password"
                      value={form.apiKey}
                      onChange={(e) => updateForm((f) => ({ ...f, apiKey: e.target.value }))}
                      className={fieldCls}
                      dir="ltr"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                      {t("integrationBookingUrl")}
                    </label>
                    <input
                      type="url"
                      value={form.bookingUrl}
                      onChange={(e) => updateForm((f) => ({ ...f, bookingUrl: e.target.value }))}
                      placeholder="https://us2.cloudbeds.com/en/reservation/xxxxx"
                      className={`${fieldCls} placeholder:text-[#C5BDB3]`}
                      dir="ltr"
                    />
                    <span className="text-[9px] text-[#A39888] mt-0.5 block">{t("integrationBookingUrlHint")}</span>
                  </div>
                </>
              )}

              {/* Custom API */}
              {form.type === "custom_api" && (
                <>
                  <div className="mb-2">
                    <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                      {t("integrationName")}
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm((f) => ({ ...f, name: e.target.value }))}
                      className={fieldCls}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                      {t("integrationBaseUrl")}
                    </label>
                    <input
                      type="url"
                      value={form.baseUrl}
                      onChange={(e) => updateForm((f) => ({ ...f, baseUrl: e.target.value }))}
                      placeholder="https://api.example.com"
                      className={`${fieldCls} placeholder:text-[#C5BDB3]`}
                      dir="ltr"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                      {t("integrationAuthType")}
                    </label>
                    <select
                      value={form.authType}
                      onChange={(e) =>
                        updateForm((f) => ({ ...f, authType: e.target.value as "bearer" | "api_key" }))
                      }
                      className={fieldCls}
                    >
                      <option value="bearer">Bearer Token</option>
                      <option value="api_key">API Key</option>
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="text-[10px] font-medium text-[#7A7267] mb-1 block">
                      {t("integrationAuthValue")}
                    </label>
                    <input
                      type="password"
                      value={form.authValue}
                      onChange={(e) => updateForm((f) => ({ ...f, authValue: e.target.value }))}
                      className={fieldCls}
                      dir="ltr"
                    />
                  </div>
                </>
              )}

              {/* Test Connection */}
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={!isFormValid || testStatus === "testing"}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EDE6DD] text-xs font-bold text-[#2D2A26] hover:bg-[#FAF7F3] disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <span key={testStatus} className="flex items-center justify-center gap-1.5 w-full">
                    {testStatus === "testing" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    {testStatus === "testing" ? t("testConnectionTesting") : t("testConnection")}
                  </span>
                </button>

                {/* Test result */}
                {testStatus === "success" && (
                  <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    {t("testConnectionSuccess")}
                  </div>
                )}
                {testStatus === "error" && (
                  <div className="flex items-start gap-1.5 text-red-500 text-[10px] font-medium">
                    <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{testError || t("testConnectionFailed")}</span>
                  </div>
                )}
              </div>

              {/* Save */}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isFormValid || saveMutation.isPending || testStatus !== "success"}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FF7E47] hover:bg-[#E86B38] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {saveMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  {editingId ? t("editIntegration") : t("addIntegration")}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-3 py-1.5 rounded-lg border border-[#EDE6DD] text-xs text-[#7A7267] hover:bg-[#FAF7F3] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#A39B90]" />
            </div>
          ) : integrations.length === 0 && !showForm ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-[#FAF7F3] flex items-center justify-center mb-2">
                <Plug className="w-5 h-5 text-[#C5BDB3]" />
              </div>
              <p className="text-xs font-medium text-[#7A7267]">{t("integrationsEmpty")}</p>
              <p className="text-[10px] text-[#A39B90] mt-0.5">{t("integrationsEmptyDesc")}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {integrations.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg border border-[#EDE6DD] bg-white hover:shadow-sm transition-shadow group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Status dot */}
                    <button
                      type="button"
                      onClick={() =>
                        toggleStatusMutation.mutate({
                          id: item.id,
                          newStatus: item.status === "active" ? "inactive" : "active",
                        })
                      }
                      className="shrink-0 cursor-pointer"
                      title={item.status === "active" ? t("integrationActive") : t("integrationInactive")}
                      aria-label={item.status === "active" ? t("integrationActive") : t("integrationInactive")}
                    >
                      <span
                        className={`block w-2 h-2 rounded-full transition-colors ${
                          item.status === "active" ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                      />
                    </button>

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#2D2A26] truncate">
                        {item.integration_type === "cloudbeds"
                          ? t("integrationTypeCloudbeds")
                          : t("integrationTypeCustomApi")}
                        {item.integration_type === "custom_api" &&
                          (item.config as CustomApiConfig).name &&
                          ` — ${(item.config as CustomApiConfig).name}`}
                      </p>
                      <p className="text-[10px] text-[#A39B90] truncate" dir="ltr">
                        {item.integration_type === "cloudbeds"
                          ? `${t("integrationApiKey")}: ${mask((item.config as CloudbedsConfig).apiKey)}`
                          : (item.config as CustomApiConfig).baseUrl}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="p-1 rounded text-[#A39B90] hover:text-[#FF7E47] hover:bg-[#FF7E47]/10 transition-colors cursor-pointer"
                      title={t("editIntegration")}
                      aria-label={t("editIntegration")}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {confirmDeleteId === item.id ? (
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                      >
                        {t("deleteIntegration")}?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1 rounded text-[#C5BDB3] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                        title={t("deleteIntegration")}
                      aria-label={t("deleteIntegration")}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EDE6DD]/40">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-[#FF7E47] text-white text-sm font-semibold hover:bg-[#e56e3a] transition-colors cursor-pointer"
          >
            {t("integrationDone", "Done")}
          </button>
        </div>
      </div>
    </div>
  );
}
