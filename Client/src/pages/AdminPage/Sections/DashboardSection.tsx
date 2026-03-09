import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserCheck,
  Wifi,
  GitBranch,
  Loader2,
  Check,
  X,
  ChevronLeft,
} from "lucide-react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "dashboardGreetingMorning";
  if (hour < 17) return "dashboardGreetingAfternoon";
  return "dashboardGreetingEvening";
}

function groupByMonth(
  items: { created_at: string }[]
): { month: string; count: number }[] {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    const d = new Date(item.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map[key] = (map[key] ?? 0) + 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => {
      const [y, m] = month.split("-");
      const label = new Date(Number(y), Number(m) - 1).toLocaleDateString(
        "en",
        { month: "short" }
      );
      return { month: label, count };
    });
}

const EASE = [0.22, 1, 0.36, 1] as const;
const STATUS_CHART_COLORS = ["#F59E0B", "#10B981", "#EF4444"];
const BOT_CHART_COLORS = ["#E5E7EB", "#60A5FA", "#D8723C"];

export default function DashboardSection() {
  const { t } = useTranslation("admin");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ["admin", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_counts");
      if (error) throw error;
      return data?.[0] ?? { open_tickets: 0, pending_users: 0 };
    },
  });

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["admin", "all-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_profiles");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: formResponses, isLoading: formLoading } = useQuery({
    queryKey: ["admin", "form-responses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_responses")
        .select("created_at");
      if (error) throw error;
      return data ?? [];
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
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  const isLoading = countsLoading || profilesLoading || formLoading;

  const totalUsers = profiles?.length ?? 0;
  const connectedBots =
    profiles?.filter((p) => p.bot_status === "connected").length ?? 0;
  const activeWorkflows =
    profiles?.filter(
      (p) => p.bot_status === "connected" || p.bot_status === "created"
    ).length ?? 0;
  const pendingUsers = useMemo(
    () => (profiles ?? []).filter((p) => p.status === "pending"),
    [profiles]
  );

  const registrationTrend = useMemo(
    () => groupByMonth((profiles ?? []) as { created_at: string }[]),
    [profiles]
  );

  const formTrend = useMemo(
    () => groupByMonth((formResponses ?? []) as { created_at: string }[]),
    [formResponses]
  );

  const statusData = useMemo(() => {
    if (!profiles) return [];
    const pending = profiles.filter((p) => p.status === "pending").length;
    const approved = profiles.filter((p) => p.status === "approved").length;
    const rejected = profiles.filter((p) => p.status === "rejected").length;
    return [
      { name: t("filterPending"), value: pending },
      { name: t("filterApproved"), value: approved },
      { name: t("filterRejected"), value: rejected },
    ];
  }, [profiles, t]);

  const botStatusData = useMemo(() => {
    if (!profiles) return [];
    const notCreated = profiles.filter(
      (p) => p.bot_status === "not_created"
    ).length;
    const created = profiles.filter((p) => p.bot_status === "created").length;
    const connected = profiles.filter(
      (p) => p.bot_status === "connected"
    ).length;
    return [
      { name: t("botNotCreated"), value: notCreated },
      { name: t("botCreated"), value: created },
      { name: t("botConnected"), value: connected },
    ];
  }, [profiles, t]);

  const statCards = [
    {
      key: "totalUsers",
      label: t("statTotalUsers"),
      value: totalUsers,
      icon: Users,
      color: "text-[#444444]",
      bgColor: "bg-[#F2EDE8]",
      link: "/admin/users",
    },
    {
      key: "pendingApprovals",
      label: t("statPendingApprovals"),
      value: counts?.pending_users ?? 0,
      icon: UserCheck,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      link: "/admin/approvals",
    },
    {
      key: "connectedBots",
      label: t("statConnectedBots"),
      value: connectedBots,
      icon: Wifi,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      link: "/admin/users",
    },
    {
      key: "activeWorkflows",
      label: t("statActiveWorkflows"),
      value: activeWorkflows,
      icon: GitBranch,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: null,
    },
  ];

  const card =
    "bg-white rounded-2xl border border-[#E8E4DF] shadow-[0_1px_3px_rgba(0,0,0,0.06)]";

  const tooltipStyle = {
    background: "#111111",
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 12,
  };

  return (
    <div className="h-full flex flex-col p-5 gap-4 overflow-hidden">
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#D8723C]" />
        </div>
      ) : (
        <>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="shrink-0"
          >
            <h1 className="text-xl font-bold text-[#111111]">
              {t(getGreetingKey())}
              {user?.full_name ? `, ${user.full_name}` : ""}
            </h1>
            <p className="text-xs text-[#999999] mt-0.5">
              {t("dashboardSubtitle")}
            </p>
          </motion.div>

          {/* Row 1: Approvals + Donut + Stats (2x2) */}
          <div className="flex gap-4 flex-1 min-h-0">
            {/* Left: Pending Approvals */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.4, ease: EASE }}
              className={cn(
                card,
                "w-[490px] shrink-0 px-4 py-4 flex flex-col"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[#111111]">
                  {t("approvalsTitle")}
                </p>
                <button
                  onClick={() => navigate("/admin/approvals")}
                  className="text-[10px] text-[#D8723C] font-medium hover:underline cursor-pointer"
                >
                  {t("navApprovals")}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                <AnimatePresence mode="popLayout">
                  {pendingUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-[#CCCCCC]">
                      <Users className="w-8 h-8 mb-2" />
                      <p className="text-xs">{t("emptyState")}</p>
                    </div>
                  ) : (
                    pendingUsers.slice(0, 8).map((u) => (
                      <motion.div
                        key={u.id}
                        layout
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12, scale: 0.95 }}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#FAFAF8] border border-[#F0ECE7] hover:border-[#E0DBD6] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-[#D8723C]/10 border border-[#D8723C]/20 flex items-center justify-center shrink-0 text-[#D8723C] font-bold text-xs">
                          {u.full_name?.charAt(0) ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#111111] truncate leading-tight">
                            {u.full_name}
                          </p>
                          <p className="text-[10px] text-[#AAAAAA] truncate leading-tight">
                            {u.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() =>
                              statusMutation.mutate({
                                id: u.id,
                                status: "rejected",
                              })
                            }
                            disabled={processingId === u.id}
                            className={cn(
                              "w-7 h-7 rounded-lg border border-red-200 bg-red-50 text-red-500",
                              "hover:bg-red-100 transition-colors flex items-center justify-center cursor-pointer",
                              processingId === u.id &&
                                "opacity-40 pointer-events-none"
                            )}
                          >
                            {processingId === u.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              statusMutation.mutate({
                                id: u.id,
                                status: "approved",
                              })
                            }
                            disabled={processingId === u.id}
                            className={cn(
                              "w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600",
                              "hover:bg-emerald-100 transition-colors flex items-center justify-center cursor-pointer",
                              processingId === u.id &&
                                "opacity-40 pointer-events-none"
                            )}
                          >
                            {processingId === u.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Center: Donut chart (narrower) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4, ease: EASE }}
              className={cn(
                card,
                "w-[490px] shrink-0 px-5 py-4 flex flex-col min-h-0"
              )}
            >
              <p className="text-sm font-semibold text-[#111111]">
                {t("chartUserStatus")}
              </p>
              <p className="text-[11px] text-[#999999] mb-1">
                {t("chartUserStatusSub")}
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius="40%"
                      outerRadius="70%"
                      dataKey="value"
                      paddingAngle={3}
                      animationDuration={800}
                    >
                      {statusData.map((_, idx) => (
                        <Cell
                          key={idx}
                          fill={STATUS_CHART_COLORS[idx]}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 pt-2">
                {statusData.map((entry, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: STATUS_CHART_COLORS[idx] }}
                    />
                    <span className="text-[11px] text-[#777777] font-medium">
                      {entry.name}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: 2x2 stat cards */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4, ease: EASE }}
              className="flex-1 grid grid-cols-2 gap-3 min-h-0"
            >
              {statCards.map((c, i) => (
                <motion.div
                  key={c.key}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.15 + i * 0.06,
                    duration: 0.35,
                    ease: EASE,
                  }}
                  onClick={() => c.link && navigate(c.link)}
                  className={cn(
                    card,
                    "px-5 py-4 flex flex-col justify-between transition-all duration-200",
                    c.link &&
                      "cursor-pointer hover:bg-[#FDF9F6] hover:border-[#D8723C]/30 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        c.bgColor
                      )}
                    >
                      <c.icon className={cn("w-5 h-5", c.color)} />
                    </div>
                    <ChevronLeft
                      className={cn(
                        "w-4 h-4 text-[#CCCCCC]",
                        !c.link && "opacity-0"
                      )}
                    />
                  </div>
                  <div className="mt-auto">
                    <p className="text-3xl font-bold text-[#111111] leading-none">
                      {c.value}
                    </p>
                    <p className="text-xs text-[#999999] font-medium mt-1">
                      {c.label}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Row 2: Charts */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4, ease: EASE }}
            className="grid grid-cols-3 gap-4 shrink-0 h-[220px]"
          >
            {/* User Registrations */}
            <div className={cn(card, "px-5 py-4 flex flex-col min-h-0")}>
              <p className="text-sm font-semibold text-[#111111]">
                {t("chartRegistrations")}
              </p>
              <p className="text-[11px] text-[#999999] mb-2">
                {t("chartRegistrationsSub")}
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={registrationTrend}
                    margin={{ top: 5, right: 5, bottom: 0, left: -5 }}
                  >
                    <defs>
                      <linearGradient
                        id="regFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#D8723C"
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="100%"
                          stopColor="#D8723C"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E8E4DF"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: "#999" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={24}
                    />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#fff" }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#D8723C"
                      strokeWidth={2}
                      fill="url(#regFill)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bot Status */}
            <div className={cn(card, "px-5 py-4 flex flex-col min-h-0")}>
              <p className="text-sm font-semibold text-[#111111]">
                {t("chartBotStatus")}
              </p>
              <p className="text-[11px] text-[#999999] mb-2">
                {t("chartBotStatusSub")}
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={botStatusData}
                    barCategoryGap="25%"
                    margin={{ top: 5, right: 5, bottom: 0, left: -5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E8E4DF"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "#999" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={24}
                    />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#fff" }} />
                    <Bar
                      dataKey="value"
                      radius={[6, 6, 0, 0]}
                      animationDuration={800}
                    >
                      {botStatusData.map((_, idx) => (
                        <Cell key={idx} fill={BOT_CHART_COLORS[idx]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Form Submissions */}
            <div className={cn(card, "px-5 py-4 flex flex-col min-h-0")}>
              <p className="text-sm font-semibold text-[#111111]">
                {t("chartFormSubmissions")}
              </p>
              <p className="text-[11px] text-[#999999] mb-2">
                {t("chartFormSubmissionsSub")}
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={formTrend}
                    margin={{ top: 5, right: 5, bottom: 0, left: -5 }}
                  >
                    <defs>
                      <linearGradient
                        id="formFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#111111"
                          stopOpacity={0.08}
                        />
                        <stop
                          offset="100%"
                          stopColor="#111111"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E8E4DF"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fill: "#999" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999" }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                      width={24}
                    />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#fff" }} labelStyle={{ color: "#fff" }} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#111111"
                      strokeWidth={2}
                      fill="url(#formFill)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
