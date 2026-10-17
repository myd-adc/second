import { addDays, daysBetween, weekdayOf } from "./dates";
import type { ISODate, Rule } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** nth (1-4) or last (-1) given weekday of a month; month is 1-12. */
export function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): ISODate {
  const first: ISODate = `${String(year).padStart(4, "0")}-${pad(month)}-01`;
  if (nth > 0) {
    const offset = (weekday - weekdayOf(first) + 7) % 7;
    return addDays(first, offset + (nth - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last: ISODate = `${String(year).padStart(4, "0")}-${pad(month)}-${pad(lastDay)}`;
  const back = (weekdayOf(last) - weekday + 7) % 7;
  return addDays(last, -back);
}

export function nextOccurrences(rule: Rule, from: ISODate, count: number): ISODate[] {
  if (count <= 0 || rule.kind === "irregular") return [];
  const out: ISODate[] = [];

  if (rule.kind === "weekly") {
    let d = addDays(from, (rule.weekday - weekdayOf(from) + 7) % 7);
    while (out.length < count) {
      out.push(d);
      d = addDays(d, 7);
    }
    return out;
  }

  if (rule.kind === "every_n_weeks") {
    const step = 7 * rule.intervalWeeks;
    const k = Math.ceil(daysBetween(rule.anchorDate, from) / step);
    let d = addDays(rule.anchorDate, k * step);
    while (out.length < count) {
      out.push(d);
      d = addDays(d, step);
    }
    return out;
  }

  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  while (out.length < count) {
    const d = nthWeekdayOfMonth(year, month, rule.weekday, rule.nth);
    if (d >= from) out.push(d);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}
