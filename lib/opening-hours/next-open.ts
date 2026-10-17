import { isOpenAt, kyivParts, type DayHours } from "./index";

export type NextOpening = { daysAhead: number; weekday: number; time: string };

const DAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];

function openingOf(hours: DayHours[], weekday: number): string | null {
  const row = hours.find((h) => h.weekday === weekday);
  return !row || row.isClosed || row.opens === null || row.closes === null ? null : row.opens;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** When the store opens next (Kyiv time); null when it is open right now or never opens within a week. */
export function nextOpening(hours: DayHours[], instant: Date): NextOpening | null {
  if (isOpenAt(hours, instant)) return null;
  const { weekday, minutes } = kyivParts(instant);

  const todayOpens = openingOf(hours, weekday);
  if (todayOpens !== null && minutes < toMinutes(todayOpens)) {
    return { daysAhead: 0, weekday, time: todayOpens };
  }
  for (let d = 1; d <= 7; d++) {
    const wd = (weekday + d) % 7;
    const opens = openingOf(hours, wd);
    if (opens !== null) return { daysAhead: d, weekday: wd, time: opens };
  }
  return null;
}

export function formatNextOpening(n: NextOpening): string {
  if (n.daysAhead === 0) return `сьогодні о ${n.time}`;
  if (n.daysAhead === 1) return `завтра о ${n.time}`;
  return `у ${DAYS[n.weekday]} о ${n.time}`;
}
