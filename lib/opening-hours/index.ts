import { TIMEZONE } from "../config";
import type { ISODate } from "../schedule/types";

export type DayHours = {
  weekday: number; // 0 = Monday … 6 = Sunday
  opens: string | null; // "HH:MM"
  closes: string | null; // "HH:MM"
  isClosed: boolean;
};

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAYS: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function kyivParts(instant: Date): { date: ISODate; weekday: number; minutes: number } {
  const p: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAYS[p.weekday],
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
  };
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

type Interval = { opens: number; closes: number; closesText: string; overnight: boolean };

function intervalFor(hours: DayHours[], weekday: number): Interval | null {
  const row = hours.find((h) => h.weekday === weekday);
  if (!row || row.isClosed || row.opens === null || row.closes === null) return null;
  const opens = toMinutes(row.opens);
  const closes = toMinutes(row.closes);
  return { opens, closes, closesText: row.closes, overnight: closes <= opens };
}

/** End ("HH:MM") of the interval that covers the instant, or null if closed. */
export function closesAt(hours: DayHours[], instant: Date): string | null {
  const { weekday, minutes } = kyivParts(instant);

  const today = intervalFor(hours, weekday);
  if (today) {
    const inside = today.overnight
      ? minutes >= today.opens
      : minutes >= today.opens && minutes < today.closes;
    if (inside) return today.closesText;
  }

  const yesterday = intervalFor(hours, (weekday + 6) % 7);
  if (yesterday && yesterday.overnight && minutes < yesterday.closes) return yesterday.closesText;

  return null;
}

export function isOpenAt(hours: DayHours[], instant: Date): boolean {
  return closesAt(hours, instant) !== null;
}
