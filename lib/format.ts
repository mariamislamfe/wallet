import type { Transaction } from "@/types/finance";

const numberFormatters = new Map<number, Intl.NumberFormat>();

function numberFormatter(fractionDigits: number): Intl.NumberFormat {
  let formatter = numberFormatters.get(fractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    numberFormatters.set(fractionDigits, formatter);
  }
  return formatter;
}

export function fractionDigitsFor(value: number): number {
  return Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2;
}

export function formatNumber(value: number, fractionDigits = fractionDigitsFor(value)): string {
  return numberFormatter(fractionDigits).format(Math.abs(value));
}

/** "EGP 1,250" · "−EGP 80.50" — uses a true minus sign for negatives. */
export function formatMoney(value: number, fractionDigits = fractionDigitsFor(value)): string {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded < 0 ? "−" : "";
  return `${sign}EGP ${formatNumber(rounded, fractionDigits)}`;
}

/** "− EGP 150" / "+ EGP 1,000" for activity rows. */
export function formatSignedMoney(tx: Pick<Transaction, "amount" | "type">): string {
  return `${tx.type === "income" ? "+" : "−"} EGP ${formatNumber(tx.amount)}`;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const arWeekdayFormatter = new Intl.DateTimeFormat("ar-EG", { weekday: "long" });
const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long" });
const arMonthFormatter = new Intl.DateTimeFormat("ar-EG", { month: "long" });

export type Bilingual = { en: string; ar: string };

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

// Months are addressed by offset from the current one (0 = this month, 1 = last
// month…), so the selection survives midnight and is timezone-free until rendered.

/** Local-time `[start, end)` of the month `offset` months before `now`. */
export function monthRange(offset: number, now = new Date()): { start: Date; end: Date } {
  return {
    start: new Date(now.getFullYear(), now.getMonth() - offset, 1),
    end: new Date(now.getFullYear(), now.getMonth() - offset + 1, 1),
  };
}

/** How many months `date` lies before the current month. */
export function monthOffsetOf(date: Date, now = new Date()): number {
  return (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
}

export function monthTitle(offset: number, now = new Date()): { name: Bilingual; year: number | null; relative: Bilingual | null } {
  const { start } = monthRange(offset, now);
  return {
    name: { en: monthFormatter.format(start), ar: arMonthFormatter.format(start) },
    year: start.getFullYear() === now.getFullYear() ? null : start.getFullYear(),
    relative:
      offset === 0
        ? { en: "This month", ar: "الشهر ده" }
        : offset === 1
          ? { en: "Last month", ar: "الشهر اللي فات" }
          : null,
  };
}

export type DayGroup = { key: number; label: Bilingual; items: Transaction[] };

export function groupByDay(transactions: Transaction[], now = new Date()): DayGroup[] {
  const today = startOfDay(now);
  const yesterday = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups = new Map<number, Transaction[]>();

  const sorted = [...transactions].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  );

  for (const tx of sorted) {
    const day = startOfDay(new Date(tx.created_at));
    const items = groups.get(day);
    if (items) items.push(tx);
    else groups.set(day, [tx]);
  }

  return [...groups].map(([key, items]) => {
    const date = new Date(key);
    const label =
      key === today
        ? { en: "Today", ar: "النهارده" }
        : key === yesterday
          ? { en: "Yesterday", ar: "امبارح" }
          : { en: dayFormatter.format(date), ar: arWeekdayFormatter.format(date) };
    return { key, label, items };
  });
}

export function formatRowTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}
