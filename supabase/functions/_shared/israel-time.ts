/**
 * Israel timezone helpers (DST-safe).
 * Israel observes exactly two offsets: +03:00 (IDT, roughly late-Mar to late-Oct)
 * and +02:00 (IST, rest of year). DST transitions happen at 02:00 local time.
 */

export function nowIsraelISO(): string {
  try {
    const n = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(n);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const localMs = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    const offMin = Math.round((localMs - n.getTime()) / 60000);
    const sign = offMin >= 0 ? "+" : "-";
    const hh = String(Math.floor(Math.abs(offMin) / 60)).padStart(2, "0");
    const mm = String(Math.abs(offMin) % 60).padStart(2, "0");
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${hh}:${mm}`;
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Returns "+03:00" or "+02:00" depending on DST for a specific YYYY-MM-DD date.
 * Probes at 12:00 UTC (always well after the 02:00-local DST transition).
 * Returns "+03:00" on invalid input so callers never receive a malformed offset.
 */
export function israelOffsetForDate(dateYYYYMMDD: string): string {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYYYYMMDD)) return "+03:00";
    const probe = new Date(`${dateYYYYMMDD}T12:00:00Z`);
    if (isNaN(probe.getTime())) return "+03:00";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(probe);
    const hourPart = parts.find((x) => x.type === "hour");
    if (!hourPart) return "+03:00";
    const ilHour = parseInt(hourPart.value, 10);
    if (!Number.isFinite(ilHour)) return "+03:00";
    const offsetHours = ilHour - 12;
    if (offsetHours !== 2 && offsetHours !== 3) return "+03:00";
    return `+0${offsetHours}:00`;
  } catch {
    return "+03:00";
  }
}
