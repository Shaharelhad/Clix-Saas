// Pure date utilities for the list node's calendar modes.
//
// buildMonthSections — month picker:
//   • Anchored at new Date() (each render recomputes; rolling forward is free)
//   • Horizon: current month → December of next calendar year
//   • Year-half grouping handles WhatsApp's 10-rows-per-section limit
//   • Locale-aware month names via Intl.DateTimeFormat
//
// buildDaySections — day picker:
//   • Days of the picked month, grouped by week (Sun-Sat — used by both en + he-IL)
//   • Past days are filtered out when the picked month is the current month
//   • rowId is the full ISO date (YYYY-MM-DD) so downstream nodes get a usable value
//
// No DB, no fetch, no side effects — easy to reason about and unit-verify.

import type { ListSection } from "./wa-messaging.ts";

type Locale = "en" | "he";

const LABELS: Record<Locale, { h1: string; h2: string; coming: string }> = {
  en: { h1: "Jan to Jun", h2: "Jul to Dec", coming: "coming up" },
  he: { h1: "ינואר עד יוני", h2: "יולי עד דצמבר", coming: "קרוב" },
};

const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  he: "he-IL",
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function monthRow(year: number, monthIndex: number, locale: Locale) {
  const d = new Date(year, monthIndex, 1);
  const formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: "long",
    year: "numeric",
  });
  return {
    rowId: `${year}-${pad2(monthIndex + 1)}`,
    title: formatter.format(d),
  };
}

export function buildMonthSections(locale: Locale = "en"): ListSection[] {
  const labels = LABELS[locale];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  const nextYear = currentYear + 1;

  const sections: ListSection[] = [];

  // Current year: months from currentMonth through December.
  const remaining: number[] = [];
  for (let m = currentMonth; m <= 11; m++) remaining.push(m);

  if (remaining.length > 10) {
    // Only happens when currentMonth ≤ 1 (Jan or Feb): split into halves.
    const h1 = remaining.filter((m) => m <= 5);
    const h2 = remaining.filter((m) => m >= 6);
    if (h1.length > 0) {
      sections.push({
        title: `${currentYear} — ${labels.h1}`,
        rows: h1.map((m) => monthRow(currentYear, m, locale)),
      });
    }
    if (h2.length > 0) {
      sections.push({
        title: `${currentYear} — ${labels.h2}`,
        rows: h2.map((m) => monthRow(currentYear, m, locale)),
      });
    }
  } else if (remaining.length > 0) {
    sections.push({
      title: `${currentYear} — ${labels.coming}`,
      rows: remaining.map((m) => monthRow(currentYear, m, locale)),
    });
  }

  // Next year: always full, split into two halves.
  sections.push({
    title: `${nextYear} — ${labels.h1}`,
    rows: [0, 1, 2, 3, 4, 5].map((m) => monthRow(nextYear, m, locale)),
  });
  sections.push({
    title: `${nextYear} — ${labels.h2}`,
    rows: [6, 7, 8, 9, 10, 11].map((m) => monthRow(nextYear, m, locale)),
  });

  return sections;
}

export function buildDaySections(monthRowId: string, locale: Locale = "en"): ListSection[] {
  const match = monthRowId?.match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];
  const year = parseInt(match[1], 10);
  const monthIndex = parseInt(match[2], 10) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return [];

  const intl = INTL_LOCALE[locale];
  const dayFormatter = new Intl.DateTimeFormat(intl, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const monthShortFormatter = new Intl.DateTimeFormat(intl, { month: "short" });

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && monthIndex === now.getMonth();
  const todayDay = isCurrentMonth ? now.getDate() : 0;

  // Group days into weeks (Sun-Sat). Both en-US and he-IL treat Sunday as week start.
  const weekGroups: number[][] = [];
  let currentWeek: number[] | null = null;
  let currentWeekSunKey = "";

  for (let day = 1; day <= daysInMonth; day++) {
    if (day < todayDay) continue;
    const date = new Date(year, monthIndex, day);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    const sunDate = new Date(date);
    sunDate.setDate(date.getDate() - dayOfWeek);
    const sunKey = `${sunDate.getFullYear()}-${sunDate.getMonth()}-${sunDate.getDate()}`;
    if (sunKey !== currentWeekSunKey) {
      currentWeek = [];
      weekGroups.push(currentWeek);
      currentWeekSunKey = sunKey;
    }
    currentWeek!.push(day);
  }

  return weekGroups.map((days) => {
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const firstDate = new Date(year, monthIndex, firstDay);
    const monthShort = monthShortFormatter.format(firstDate);
    const sectionTitle = firstDay === lastDay
      ? `${monthShort} ${firstDay}`
      : `${monthShort} ${firstDay}-${lastDay}`;
    return {
      title: sectionTitle,
      rows: days.map((d) => ({
        rowId: `${year}-${pad2(monthIndex + 1)}-${pad2(d)}`,
        title: dayFormatter.format(new Date(year, monthIndex, d)),
      })),
    };
  });
}
