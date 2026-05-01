import { useTranslation } from "react-i18next";
import { useDailyActivity, type DailyActivity } from "@/hooks/useDailyActivity";

interface DailyActivityCardProps {
  workflowId: string | null | undefined;
}

const W = 400;
const H = 100;

/** Build a smoothed cubic-bezier path through 7 points, oldest → today. */
function buildSparklinePath(series: number[]): { line: string; area: string } {
  if (series.length === 0) return { line: "", area: "" };

  const max = Math.max(...series, 1);
  const stepX = W / (series.length - 1 || 1);

  const points = series.map((v, i) => ({
    x: i * stepX,
    // 10% top padding, 20% bottom padding so the line never hugs the edges.
    y: H - 10 - (v / max) * (H * 0.7),
  }));

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` Q${cx},${p0.y} ${cx},${(p0.y + p1.y) / 2} T${p1.x},${p1.y}`;
  }

  const area = `${d} L${W},${H} L0,${H} Z`;
  return { line: d, area };
}

function getTodayDot(series: number[]): { x: number; y: number } {
  const max = Math.max(...series, 1);
  const stepX = W / (series.length - 1 || 1);
  const last = series.length - 1;
  return {
    x: last * stepX,
    y: H - 10 - (series[last] / max) * (H * 0.7),
  };
}

const DAY_KEYS = [
  "daysShortMon",
  "daysShortTue",
  "daysShortWed",
  "daysShortThu",
  "daysShortFri",
  "daysShortSat",
  "daysShortSun",
] as const;

/** Returns the 7 day keys ordered oldest → today, ending on today's weekday. */
function rotatedDayKeys(): readonly (typeof DAY_KEYS)[number][] {
  // JS getDay(): 0=Sunday..6=Saturday. Our DAY_KEYS are Mon..Sun (0..6).
  const todayIdx = (new Date().getDay() + 6) % 7; // shift so 0=Mon..6=Sun
  const out: (typeof DAY_KEYS)[number][] = [];
  for (let i = 6; i >= 0; i--) {
    out.push(DAY_KEYS[(todayIdx - i + 7) % 7]);
  }
  return out;
}

function EmptyState() {
  const { t } = useTranslation("dashboard");
  return (
    <div className="absolute inset-0 bg-white p-6 flex flex-col items-center justify-center text-center">
      <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest">
        {t("activityTitle")}
      </p>
      <p className="text-sm text-zinc-500 mt-2">{t("activityNoData")}</p>
    </div>
  );
}

function CardBody({ data }: { data: DailyActivity }) {
  const { t } = useTranslation("dashboard");
  const { line, area } = buildSparklinePath(data.series);
  const todayDot = getTodayDot(data.series);
  const dayKeys = rotatedDayKeys();
  const isPositive = data.deltaPercent !== null && data.deltaPercent >= 0;

  return (
    <div
      className="absolute inset-0 bg-white px-5 py-3 flex flex-col justify-between"
      style={{ fontFamily: "var(--font-display)" }}
    >
      <div className="flex justify-between items-start">
        <div className="text-start">
          <p className="text-zinc-400 text-[9px] uppercase font-bold tracking-widest">
            {t("activityTitle")}
          </p>
          <h5 className="text-xl font-black text-zinc-900 mt-0.5">
            {data.today.toLocaleString()}
            {data.deltaPercent !== null && (
              <span
                className={`text-[11px] font-medium ms-1 ${
                  isPositive ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {isPositive ? "+" : ""}
                {data.deltaPercent}%
              </span>
            )}
          </h5>
        </div>
      </div>

      <div className="flex-1 mt-1 relative min-h-0">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          style={{ direction: "ltr" }}
        >
          <defs>
            <linearGradient id="dailyActivityGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-primary)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--brand-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {area && <path d={area} fill="url(#dailyActivityGradient)" />}
          {line && (
            <path
              d={line}
              fill="none"
              stroke="var(--brand-primary)"
              strokeWidth={3}
              strokeLinecap="round"
            />
          )}
          {data.series.length > 0 && (
            <circle
              cx={todayDot.x}
              cy={todayDot.y}
              r={4}
              fill="var(--brand-primary)"
              className="animate-pulse"
            />
          )}
        </svg>
      </div>

      <div className="flex justify-between mt-1" style={{ direction: "ltr" }}>
        {dayKeys.map((key, i) => (
          <span
            key={key}
            className={`text-[9px] font-bold ${
              i === 6 ? "text-[var(--brand-primary)]" : "text-zinc-300"
            }`}
          >
            {t(key)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DailyActivityCard({ workflowId }: DailyActivityCardProps) {
  const { data, isLoading, isError } = useDailyActivity(workflowId);

  return (
    <div className="w-full h-44 relative rounded-[28px] overflow-hidden border border-zinc-100 shrink-0 bg-white">
      {isLoading || isError || !data || data.series.every((v) => v === 0) ? (
        <EmptyState />
      ) : (
        <CardBody data={data} />
      )}
    </div>
  );
}
