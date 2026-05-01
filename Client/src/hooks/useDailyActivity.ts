import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/services/supabase";

export interface DailyActivity {
  /** Length-7 array of message counts, oldest → today. */
  series: number[];
  /** Today's count (last entry of series). */
  today: number;
  /** Yesterday's count (second-to-last). */
  yesterday: number;
  /** Percent change vs yesterday — `null` when yesterday is 0 (undefined ratio). */
  deltaPercent: number | null;
  /** Index 0–6 of today within the series; equals series.length - 1 (i.e. 6). */
  todayIndex: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function useDailyActivity(workflowId: string | null | undefined) {
  return useQuery<DailyActivity>({
    queryKey: ["daily_activity", workflowId],
    enabled: !!workflowId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const today = startOfDay(new Date());
      const sevenDaysAgo = new Date(today.getTime() - 6 * DAY_MS);

      const { data, error } = await supabase
        .from("flow_message_log")
        .select("created_at")
        .eq("workflow_id", workflowId!)
        .gte("created_at", sevenDaysAgo.toISOString())
        .limit(10_000);

      if (error) throw error;

      // Bucket into 7 days, oldest → today.
      const buckets = new Array<number>(7).fill(0);
      for (const row of data ?? []) {
        const d = startOfDay(new Date(row.created_at));
        const offset = Math.floor((d.getTime() - sevenDaysAgo.getTime()) / DAY_MS);
        if (offset >= 0 && offset < 7) buckets[offset] += 1;
      }

      const todayCount = buckets[6];
      const yesterdayCount = buckets[5];
      const delta =
        yesterdayCount === 0
          ? todayCount === 0
            ? 0
            : null
          : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);

      return {
        series: buckets,
        today: todayCount,
        yesterday: yesterdayCount,
        deltaPercent: delta,
        todayIndex: 6,
      };
    },
  });
}
