import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Loader2,
  Plus,
  Radio,
  Send,
  Trash2,
  Unplug,
  RefreshCw,
  Link,
  Phone,
  X,
} from "lucide-react";
import { callGatewayAdmin } from "@/services/edge-functions";
import { cn } from "@/lib/utils";

/* ── constants ───────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  connected: "bg-emerald-100 text-emerald-700",
  connecting: "bg-amber-100 text-amber-700",
  qr_generated: "bg-blue-100 text-blue-700",
  not_found: "bg-gray-100 text-gray-500",
};

const STATUS_KEYS: Record<string, string> = {
  connected: "gatewayStatusConnected",
  connecting: "gatewayStatusConnecting",
  qr_generated: "gatewayStatusQr",
  not_found: "gatewayStatusNotFound",
};

const EASE = [0.22, 1, 0.36, 1] as const;

const card =
  "bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

interface GatewayInstance {
  id: string;
  instance_id: string;
  label: string;
  webhook_url: string | null;
  status: string;
  phone_number: string | null;
  created_at: string;
}

/* ── component ───────────────────────────────────────────── */

export default function GatewaySection() {
  const { t } = useTranslation("admin");
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "disconnect" | "delete";
    instanceId: string;
  } | null>(null);

  // Create form state
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newWebhook, setNewWebhook] = useState("");

  // Detail form state
  const [webhookInput, setWebhookInput] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");

  // QR polling ref
  const qrPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  /* ── queries ─────────────────────────────────────────── */

  const { data: instances = [], isLoading } = useQuery<GatewayInstance[]>({
    queryKey: ["admin", "gateway-instances"],
    queryFn: async () => {
      const { data, error } = await callGatewayAdmin({ action: "list" });
      if (error) throw new Error(error);
      return (data as { instances: GatewayInstance[] }).instances;
    },
  });

  const { data: healthData } = useQuery({
    queryKey: ["admin", "gateway-health"],
    queryFn: async () => {
      const { data, error } = await callGatewayAdmin({ action: "health" });
      if (error) return { healthy: false };
      return data as { healthy: boolean };
    },
    refetchInterval: 30000,
  });

  const selected = instances.find((i) => i.id === selectedId);

  // Sync webhookInput when selection changes
  useEffect(() => {
    if (selected) {
      setWebhookInput(selected.webhook_url || "");
    }
  }, [selected]);

  /* ── QR polling ──────────────────────────────────────── */

  const pollStatus = useCallback(
    async (instanceId: string) => {
      const { data } = await callGatewayAdmin({
        action: "status",
        instance_id: instanceId,
      });
      if (data) {
        queryClient.invalidateQueries({
          queryKey: ["admin", "gateway-instances"],
        });
      }
    },
    [queryClient]
  );

  // Poll status: fast (3s) during QR/connecting, slow (30s) when connected
  useEffect(() => {
    if (qrPollingRef.current) {
      clearInterval(qrPollingRef.current);
      qrPollingRef.current = null;
    }

    if (!selected) return;

    let interval: number | undefined;
    if (selected.status === "qr_generated" || selected.status === "connecting") {
      interval = 3000;
    } else if (selected.status === "connected") {
      interval = 30000;
    }

    if (interval) {
      qrPollingRef.current = setInterval(() => {
        pollStatus(selected.instance_id);
      }, interval);
    }

    return () => {
      if (qrPollingRef.current) {
        clearInterval(qrPollingRef.current);
        qrPollingRef.current = null;
      }
    };
  }, [selected?.instance_id, selected?.status, pollStatus]);

  /* ── mutations ───────────────────────────────────────── */

  const [qrCode, setQrCode] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await callGatewayAdmin({
        action: "create",
        instance_id: newId.trim().toLowerCase(),
        label: newLabel.trim() || newId.trim(),
        webhook_url: newWebhook.trim() || undefined,
      });
      if (error) {
        if (error.includes("409")) throw new Error("exists");
        throw new Error(error);
      }
      return data as { qr?: string; status: string; instance_id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "gateway-instances"],
      });
      setShowCreate(false);
      setNewId("");
      setNewLabel("");
      setNewWebhook("");
      showFeedback(t("gatewayCreated"));
    },
    onError: (err) => {
      if (err.message === "exists") {
        showFeedback(t("gatewayInstanceExists"));
      }
    },
  });

  const startMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await callGatewayAdmin({
        action: "start",
        instance_id: instanceId,
      });
      if (error) throw new Error(error);
      return data as { qr?: string; status: string };
    },
    onSuccess: (data) => {
      if (data.qr) setQrCode(data.qr);
      queryClient.invalidateQueries({
        queryKey: ["admin", "gateway-instances"],
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await callGatewayAdmin({
        action: "disconnect",
        instance_id: instanceId,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      setQrCode(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "gateway-instances"],
      });
      showFeedback(t("gatewayDisconnected"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (instanceId: string) => {
      const { data, error } = await callGatewayAdmin({
        action: "delete",
        instance_id: instanceId,
      });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      setSelectedId(null);
      setQrCode(null);
      queryClient.invalidateQueries({
        queryKey: ["admin", "gateway-instances"],
      });
      showFeedback(t("gatewayDeleted"));
    },
  });

  const webhookMutation = useMutation({
    mutationFn: async ({
      instanceId,
      url,
    }: {
      instanceId: string;
      url: string;
    }) => {
      const { error } = await callGatewayAdmin({
        action: "set_webhook",
        instance_id: instanceId,
        webhook_url: url,
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "gateway-instances"],
      });
      showFeedback(t("gatewayWebhookSaved"));
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const { error } = await callGatewayAdmin({
        action: "send_test",
        instance_id: selected!.instance_id,
        to: testPhone.trim(),
        message: testMessage.trim(),
      });
      if (error) throw new Error(error);
    },
    onSuccess: () => {
      setTestMessage("");
      showFeedback(t("gatewayTestSent"));
    },
    onError: () => {
      showFeedback(t("gatewaySendError"));
    },
  });

  /* ── loading state ───────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#D8723C]" />
      </div>
    );
  }

  /* ── render ──────────────────────────────────────────── */

  return (
    <div className="h-full flex flex-col p-5 gap-4 overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="shrink-0 flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-[#111111]">
            {t("gatewayTitle")}
          </h1>
          <p className="text-xs text-[#999999] mt-0.5">
            {t("gatewaySubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Health indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                healthData?.healthy ? "bg-emerald-500" : "bg-red-400"
              )}
            />
            <span className="text-[10px] text-[#999999]">
              {t(healthData?.healthy ? "gatewayHealthOk" : "gatewayHealthDown")}
            </span>
          </div>
          {/* Create button */}
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D8723C] hover:bg-[#C4632F] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("gatewayCreateNew")}
          </button>
        </div>
      </motion.div>

      {/* Feedback toast — always mounted, visibility toggled */}
      <div
        className={cn(
          "shrink-0 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold transition-all duration-200",
          feedback ? "opacity-100" : "opacity-0 h-0 py-0 overflow-hidden"
        )}
      >
        {feedback}
      </div>

      {/* Create modal overlay — always mounted, visibility toggled */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center transition-all duration-200",
          showCreate
            ? "bg-black/30 backdrop-blur-sm opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        <div className={cn(card, "w-[420px] p-6", !showCreate && "scale-95")}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-[#111111]">
              {t("gatewayCreateNew")}
            </h2>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="p-1 rounded-lg hover:bg-black/[0.04] cursor-pointer"
            >
              <X className="w-4 h-4 text-[#999999]" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Instance ID */}
            <div>
              <label className="block text-xs font-bold text-[#444444] mb-1">
                {t("gatewayInstanceId")}
              </label>
              <input
                value={newId}
                onChange={(e) =>
                  setNewId(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                  )
                }
                placeholder="my-bot-1"
                className="w-full border border-[#E8E4DF] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#D8723C] focus:ring-1 focus:ring-[#D8723C]/20 transition-colors"
              />
              <p className="text-[10px] text-[#AAAAAA] mt-1">
                {t("gatewayInstanceIdHint")}
              </p>
            </div>

            {/* Label */}
            <div>
              <label className="block text-xs font-bold text-[#444444] mb-1">
                {t("gatewayLabel")}
              </label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="My WhatsApp Bot"
                className="w-full border border-[#E8E4DF] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#D8723C] focus:ring-1 focus:ring-[#D8723C]/20 transition-colors"
              />
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block text-xs font-bold text-[#444444] mb-1">
                {t("gatewayWebhookUrl")}{" "}
                <span className="font-normal text-[#AAAAAA]">
                  ({t("fieldDescription") || "optional"})
                </span>
              </label>
              <input
                value={newWebhook}
                onChange={(e) => setNewWebhook(e.target.value)}
                placeholder="https://n8n.example.com/webhook/..."
                dir="ltr"
                className="w-full border border-[#E8E4DF] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#D8723C] focus:ring-1 focus:ring-[#D8723C]/20 transition-colors font-mono text-xs"
              />
              <p className="text-[10px] text-[#AAAAAA] mt-1">
                {t("gatewayWebhookUrlHint")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={!newId.trim() || createMutation.isPending}
            className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#D8723C] hover:bg-[#C4632F] disabled:opacity-50 text-white text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="w-4 h-4">
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Radio className="w-4 h-4" />
              )}
            </span>
            {t("gatewayCreate")}
          </button>
        </div>
      </div>

      {/* Confirm modal — always mounted, visibility toggled */}
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center transition-all duration-200",
          confirmAction
            ? "bg-black/30 backdrop-blur-sm opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        <div className={cn(card, "w-[360px] p-6", !confirmAction && "scale-95")}>
          <p className="text-sm font-bold text-[#111111] mb-5">
            {confirmAction?.type === "disconnect"
              ? t("gatewayDisconnectConfirm")
              : t("gatewayDeleteConfirm")}
          </p>
          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#666666] hover:bg-black/[0.04] border border-[#E8E4DF] transition-colors cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "disconnect") {
                  disconnectMutation.mutate(confirmAction.instanceId);
                } else {
                  deleteMutation.mutate(confirmAction.instanceId);
                }
                setConfirmAction(null);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer",
                confirmAction?.type === "delete"
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-amber-500 hover:bg-amber-600"
              )}
            >
              {confirmAction?.type === "disconnect"
                ? t("gatewayDisconnect")
                : t("gatewayDelete")}
            </button>
          </div>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Instance list */}
        <div
          className={cn(
            card,
            "w-[340px] shrink-0 flex flex-col overflow-hidden"
          )}
        >
          <div className="flex-1 overflow-y-auto">
            {instances.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#CCCCCC]">
                <Radio className="w-8 h-8 mb-2" />
                <p className="text-xs">{t("gatewayEmpty")}</p>
              </div>
            ) : (
              instances.map((inst) => (
                <button
                  type="button"
                  key={inst.id}
                  onClick={() => {
                    setSelectedId(inst.id);
                    setQrCode(null);
                  }}
                  className={cn(
                    "w-full text-start px-4 py-3.5 border-b border-[#F0ECE7] hover:bg-[#FAFAF8] transition-colors cursor-pointer",
                    selectedId === inst.id &&
                      "bg-[#FDF9F6] border-s-2 border-s-[#D8723C]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-[#111111] truncate flex-1">
                      {inst.label || inst.instance_id}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ms-2 ${STATUS_COLORS[inst.status] ?? STATUS_COLORS.not_found}`}
                    >
                      {t(STATUS_KEYS[inst.status] ?? "gatewayStatusNotFound")}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#AAAAAA] truncate font-mono">
                    {inst.instance_id}
                  </p>
                  {inst.phone_number && (
                    <p className="text-[10px] text-[#CCCCCC] mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {inst.phone_number}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Detail */}
        <div className={cn(card, "flex-1 flex flex-col overflow-hidden")}>
          {selected ? (
            <>
              {/* Detail header */}
              <div className="px-5 py-4 border-b border-[#F0ECE7] shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-bold text-[#111111] truncate flex-1">
                    {selected.label || selected.instance_id}
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[selected.status] ?? STATUS_COLORS.not_found}`}
                  >
                    {t(
                      STATUS_KEYS[selected.status] ?? "gatewayStatusNotFound"
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-[#AAAAAA] font-mono">
                  ID: {selected.instance_id}
                </p>
                {selected.phone_number && (
                  <p className="text-[11px] text-[#AAAAAA] mt-0.5">
                    {t("gatewayPhoneNumber")}: {selected.phone_number}
                  </p>
                )}
              </div>

              {/* Detail body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
                {/* QR Code area */}
                {(selected.status === "qr_generated" ||
                  selected.status === "connecting" ||
                  selected.status === "not_found") && (
                  <div className="space-y-3">
                    {qrCode ? (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-xs text-[#666666] font-bold">
                          {t("gatewayScanQr")}
                        </p>
                        <img
                          src={qrCode}
                          alt="QR Code"
                          className="w-64 h-64 rounded-xl border border-[#E8E4DF]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            startMutation.mutate(selected.instance_id)
                          }
                          disabled={startMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#D8723C] hover:bg-[#D8723C]/10 transition-colors cursor-pointer"
                        >
                          <RefreshCw
                            className={cn(
                              "w-3.5 h-3.5",
                              startMutation.isPending && "animate-spin"
                            )}
                          />
                          {t("gatewayRefreshQr")}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          startMutation.mutate(selected.instance_id)
                        }
                        disabled={startMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[#E8E4DF] text-xs font-bold text-[#999999] hover:border-[#D8723C] hover:text-[#D8723C] transition-colors cursor-pointer"
                      >
                        <span className="w-4 h-4">
                          {startMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Radio className="w-4 h-4" />
                          )}
                        </span>
                        {t("gatewayGenerateQr")}
                      </button>
                    )}
                  </div>
                )}

                {/* Connected status indicator */}
                {selected.status === "connected" && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-700">
                      {t("gatewayStatusConnected")}
                    </span>
                    {selected.phone_number && (
                      <span className="text-xs text-emerald-600 font-mono ms-auto">
                        {selected.phone_number}
                      </span>
                    )}
                  </div>
                )}

                {/* Webhook URL */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#444444] mb-1.5">
                    <Link className="w-3.5 h-3.5" />
                    {t("gatewayWebhookUrl")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={webhookInput}
                      onChange={(e) => setWebhookInput(e.target.value)}
                      placeholder="https://n8n.example.com/webhook/..."
                      dir="ltr"
                      className="flex-1 border border-[#E8E4DF] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#D8723C] focus:ring-1 focus:ring-[#D8723C]/20 transition-colors font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        webhookMutation.mutate({
                          instanceId: selected.instance_id,
                          url: webhookInput.trim(),
                        })
                      }
                      disabled={webhookMutation.isPending}
                      className="px-4 py-2.5 rounded-xl bg-[#111111] hover:bg-[#333333] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {webhookMutation.isPending && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {!webhookMutation.isPending && t("saveSettings")}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#AAAAAA] mt-1">
                    {t("gatewayWebhookUrlHint")}
                  </p>
                </div>

                {/* Send test message */}
                {selected.status === "connected" && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#444444] mb-1.5">
                      <Send className="w-3.5 h-3.5" />
                      {t("gatewaySendTest")}
                    </label>
                    <div className="space-y-2">
                      <input
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="972501234567"
                        dir="ltr"
                        className="w-full border border-[#E8E4DF] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#D8723C] focus:ring-1 focus:ring-[#D8723C]/20 transition-colors font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <textarea
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          placeholder={t("gatewayTestMessage")}
                          rows={2}
                          className="flex-1 border border-[#E8E4DF] rounded-xl px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#CCCCCC] focus:outline-none focus:border-[#D8723C] focus:ring-1 focus:ring-[#D8723C]/20 transition-colors resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => sendTestMutation.mutate()}
                          disabled={
                            !testPhone.trim() ||
                            !testMessage.trim() ||
                            sendTestMutation.isPending
                          }
                          className="self-end px-4 py-2.5 rounded-xl bg-[#D8723C] hover:bg-[#C4632F] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          <span className="w-4 h-4">
                            {sendTestMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions footer */}
              <div className="px-5 py-3 border-t border-[#F0ECE7] shrink-0 flex items-center gap-2">
                {selected.status === "connected" && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmAction({
                        type: "disconnect",
                        instanceId: selected.instance_id,
                      })
                    }
                    disabled={disconnectMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    {t("gatewayDisconnect")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setConfirmAction({
                      type: "delete",
                      instanceId: selected.instance_id,
                    })
                  }
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer disabled:opacity-50 ms-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("gatewayDelete")}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#CCCCCC]">
              <Radio className="w-10 h-10 mb-3" />
              <p className="text-sm">{t("gatewaySelectPrompt")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
