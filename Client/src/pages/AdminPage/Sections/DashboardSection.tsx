import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserCheck,
  Ticket,
  GitBranch,
  Loader2,
  Check,
  X,
  ChevronLeft,
  CheckCircle2,
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
import { useTenantStore } from "@/store/tenant.store";
import AdminSectionHeader from "../components/AdminSectionHeader";

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
const STATUS_CHART_COLORS = ["#FBBF24", "#10B981", "#F43F5E"];

export default function DashboardSection() {
  const { t } = useTranslation("admin");
  const { user } = useAuth();
  const tenantName = useTenantStore((s) => s.config?.name) ?? "CLIX";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const brandPrimary = useMemo(() => {
    if (typeof window === "undefined") return "#FF6B2C";
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue("--brand-primary")
      .trim();
    return v || "#FF6B2C";
  }, []);

  const botChartColors = useMemo(
    () => ["#E5E7EB", "#60A5FA", brandPrimary],
    [brandPrimary]
  );

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

  const { data: ticketDates, isLoading: ticketsLoading } = useQuery({
    queryKey: ["admin", "ticket-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
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

  const isLoading = countsLoading || profilesLoading || ticketsLoading;

  const totalUsers = profiles?.length ?? 0;
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

  const ticketTrend = useMemo(
    () => groupByMonth((ticketDates ?? []) as { created_at: string }[]),
    [ticketDates]
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
      iconClass: "text-[color:var(--brand-primary)]",
      pillClass:
        "bg-gradient-to-br from-[rgba(var(--brand-primary-rgb),0.18)] to-[rgba(var(--brand-primary-rgb),0.08)]",
      link: "/admin/users",
    },
    {
      key: "pendingApprovals",
      label: t("statPendingApprovals"),
      value: counts?.pending_users ?? 0,
      icon: UserCheck,
      iconClass: "text-amber-600",
      pillClass: "bg-gradient-to-br from-amber-100 to-orange-100",
      link: "/admin/approvals",
    },
    {
      key: "openTickets",
      label: t("statOpenTickets"),
      value: counts?.open_tickets ?? 0,
      icon: Ticket,
      iconClass: "text-rose-600",
      pillClass: "bg-gradient-to-br from-rose-100 to-red-100",
      link: "/admin/tickets",
    },
    {
      key: "activeWorkflows",
      label: t("statActiveWorkflows"),
      value: activeWorkflows,
      icon: GitBranch,
      iconClass: "text-emerald-600",
      pillClass: "bg-gradient-to-br from-emerald-100 to-teal-100",
      link: null,
    },
  ];

  const card =
    "rounded-2xl bg-white/70 backdrop-blur-xl border border-white/80 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] transition-shadow hover:shadow-[0_12px_40px_0_rgba(31,38,135,0.08)]";

  const sectionTitle =
    "border-b border-gray-100/60 pb-2 mb-3 flex items-center justify-between shrink-0";

  const tooltipStyle = {
    background: "#111111",
    border: "none",
    borderRadius: 12,
    color: "#fff",
    fontSize: 12,
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-3.5rem)] overflow-hidden p-4 lg:p-5 max-w-[1600px] mx-auto flex flex-col gap-4">
        <div className="h-9 w-64 rounded-xl bg-white/60 animate-pulse shrink-0" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(card, "h-20 animate-pulse")}
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
          <div className={cn(card, "animate-pulse")} />
          <div className={cn(card, "animate-pulse")} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn(card, "h-44 animate-pulse")} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden p-4 lg:p-5 max-w-[1600px] mx-auto flex flex-col gap-4">
      <AdminSectionHeader
        title={`${t(getGreetingKey())}${user?.full_name ? `, ${user.full_name}` : ""}`}
        subtitle={t("dashboardSubtitle", { brandName: tenantName })}
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 shrink-0">
        {statCards.map((c, i) => (
          <motion.div
            key={c.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: EASE }}
            onClick={() => c.link && navigate(c.link)}
            className={cn(
              card,
              "group px-5 py-4 flex items-center gap-4 transition-all duration-300",
              c.link &&
                "cursor-pointer hover:bg-white/85 hover:border-[rgba(var(--brand-primary-rgb),0.25)]"
            )}
          >
            <div
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-white/60",
                "group-hover:scale-110 transition-transform duration-300",
                c.pillClass
              )}
            >
              <c.icon className={cn("w-5 h-5", c.iconClass)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-[#777777] font-light mb-0.5">
                {c.label}
              </p>
              <p className="text-2xl font-bold leading-none tracking-tight text-[#111111]">
                {c.value}
              </p>
            </div>
            {c.link && (
              <ChevronLeft className="w-3.5 h-3.5 text-[#CCCCCC] shrink-0 group-hover:text-[color:var(--brand-primary)] transition-colors" />
            )}
          </motion.div>
        ))}
      </div>

      {/* Donut + Pending Approvals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Donut chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: EASE }}
          className={cn(card, "px-5 py-4 flex flex-col min-h-0")}
        >
          <div className={sectionTitle}>
            <div>
              <h3 className="text-sm font-semibold text-[#111111] tracking-tight">
                {t("chartUserStatus")}
              </h3>
              <p className="text-[11px] text-[#999999] font-light mt-0.5">
                {t("chartUserStatusSub")}
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 flex-1 min-h-0">
            <div className="relative w-[160px] h-[160px] shrink-0">
              <div
                className="absolute inset-3 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.7) 60%, rgba(241,245,249,0.4) 100%)",
                  boxShadow:
                    "inset 0 2px 8px rgba(0,0,0,0.04), 0 4px 24px rgba(15,23,42,0.06)",
                }}
              />
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {STATUS_CHART_COLORS.map((color, idx) => (
                      <linearGradient
                        key={idx}
                        id={`donutGrad-${idx}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.78} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius="62%"
                    outerRadius="92%"
                    dataKey="value"
                    paddingAngle={4}
                    cornerRadius={8}
                    animationDuration={900}
                    animationBegin={150}
                  >
                    {statusData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={`url(#donutGrad-${idx})`}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: "#fff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold tracking-tight text-[#0f172a] leading-none">
                  {totalUsers}
                </span>
                <span className="text-[10px] tracking-[0.3em] uppercase text-gray-400 font-semibold mt-1.5">
                  {t("dashboardTotal")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {statusData.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{
                      backgroundColor: STATUS_CHART_COLORS[idx],
                      boxShadow: `0 0 10px ${STATUS_CHART_COLORS[idx]}50`,
                    }}
                  />
                  <span className="text-xs text-[#777777] font-light w-20">
                    {entry.name}
                  </span>
                  <span className="text-sm font-semibold text-[#111111]">
                    {entry.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Pending Approvals */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4, ease: EASE }}
          className={cn(card, "px-5 py-4 flex flex-col min-h-0")}
        >
          <div className={sectionTitle}>
            <h3 className="text-sm font-semibold text-[#111111] tracking-tight">
              {t("approvalsTitle")}
            </h3>
            <button
              type="button"
              onClick={() => navigate("/admin/approvals")}
              className="text-[10px] font-semibold tracking-wider uppercase text-[color:var(--brand-primary)] hover:opacity-70 transition-opacity"
            >
              {t("navApprovals")}
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <AnimatePresence mode="popLayout">
              {pendingUsers.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center bg-white/30 rounded-2xl border border-dashed border-gray-200/60 py-4">
                  <div className="w-14 h-14 rounded-full bg-[rgba(var(--brand-primary-rgb),0.08)] border border-[rgba(var(--brand-primary-rgb),0.18)] flex items-center justify-center mb-3 text-[color:var(--brand-primary)] shadow-inner">
                    <CheckCircle2 className="w-6 h-6" strokeWidth={1.5} />
                  </div>
                  <h4 className="text-sm font-semibold text-[#111111] mb-1 tracking-tight">
                    {t("emptyState")}
                  </h4>
                  <p className="text-[11px] text-[#999999] font-light max-w-xs">
                    {t("dashboardSubtitle", { brandName: tenantName })}
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0 pr-1">
                  {pendingUsers.slice(0, 8).map((u) => (
                    <motion.div
                      key={u.id}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12, scale: 0.95 }}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/60 border border-white/80 hover:border-[rgba(var(--brand-primary-rgb),0.2)] transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[rgba(var(--brand-primary-rgb),0.1)] border border-[rgba(var(--brand-primary-rgb),0.2)] flex items-center justify-center shrink-0 text-[color:var(--brand-primary)] font-bold text-xs">
                        {u.full_name?.charAt(0) ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[#111111] truncate leading-tight">
                          {u.full_name}
                        </p>
                        <p className="text-[10px] text-[#999999] truncate leading-tight mt-0.5 font-light">
                          {u.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            statusMutation.mutate({
                              id: u.id,
                              status: "rejected",
                            })
                          }
                          disabled={processingId === u.id}
                          className={cn(
                            "w-7 h-7 rounded-lg border border-rose-200 bg-rose-50/80 text-rose-500",
                            "hover:bg-rose-100 transition-colors flex items-center justify-center cursor-pointer",
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
                          type="button"
                          onClick={() =>
                            statusMutation.mutate({
                              id: u.id,
                              status: "approved",
                            })
                          }
                          disabled={processingId === u.id}
                          className={cn(
                            "w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50/80 text-emerald-600",
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
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Trend charts row */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: EASE }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0"
      >
        {/* User Registrations */}
        <div className={cn(card, "px-5 py-4 flex flex-col")}>
          <div className={sectionTitle}>
            <div>
              <h3 className="text-sm font-semibold text-[#111111] tracking-tight">
                {t("chartRegistrations")}
              </h3>
              <p className="text-[11px] text-[#999999] font-light mt-0.5">
                {t("chartRegistrationsSub")}
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={registrationTrend}
                margin={{ top: 5, right: 5, bottom: 0, left: -5 }}
              >
                <defs>
                  <linearGradient id="regFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={brandPrimary}
                      stopOpacity={0.18}
                    />
                    <stop
                      offset="100%"
                      stopColor={brandPrimary}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#EEF1F8"
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
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={brandPrimary}
                  strokeWidth={2.5}
                  fill="url(#regFill)"
                  animationDuration={800}
                  dot={{ r: 4, strokeWidth: 2.5, fill: "#fff", stroke: brandPrimary }}
                  activeDot={{ r: 5, strokeWidth: 2.5, fill: "#fff", stroke: brandPrimary }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bot Status */}
        <div className={cn(card, "px-5 py-4 flex flex-col")}>
          <div className={sectionTitle}>
            <div>
              <h3 className="text-sm font-semibold text-[#111111] tracking-tight">
                {t("chartBotStatus")}
              </h3>
              <p className="text-[11px] text-[#999999] font-light mt-0.5">
                {t("chartBotStatusSub")}
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={botStatusData}
                barCategoryGap="25%"
                margin={{ top: 5, right: 5, bottom: 0, left: -5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#EEF1F8"
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
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Bar
                  dataKey="value"
                  radius={[8, 8, 0, 0]}
                  animationDuration={800}
                >
                  {botStatusData.map((_, idx) => (
                    <Cell key={idx} fill={botChartColors[idx]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Support Tickets */}
        <div className={cn(card, "px-5 py-4 flex flex-col")}>
          <div className={sectionTitle}>
            <div>
              <h3 className="text-sm font-semibold text-[#111111] tracking-tight">
                {t("chartTickets")}
              </h3>
              <p className="text-[11px] text-[#999999] font-light mt-0.5">
                {t("chartTicketsSub")}
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={ticketTrend}
                margin={{ top: 5, right: 5, bottom: 0, left: -5 }}
              >
                <defs>
                  <linearGradient id="ticketFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#EEF1F8"
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
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#7C3AED"
                  strokeWidth={2.5}
                  fill="url(#ticketFill)"
                  animationDuration={800}
                  dot={{ r: 4, strokeWidth: 2.5, fill: "#fff", stroke: "#7C3AED" }}
                  activeDot={{ r: 5, strokeWidth: 2.5, fill: "#fff", stroke: "#7C3AED" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
