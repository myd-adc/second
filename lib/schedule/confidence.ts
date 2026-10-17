import { addDays, daysBetween } from "./dates";
import { nextOccurrences, nthWeekdayOfMonth } from "./occurrences";
import type { DeliveryEvent, ISODate, Rule } from "./types";

export type Confidence = {
  matched: number;
  total: number;
  daysSinceLastEvent: number | null;
  stale: boolean;
};

const WINDOW = 5;
const IRREGULAR_STALE_DAYS = 30;

/** Up to `count` predicted dates strictly before `today`, latest first. */
function previousOccurrences(rule: Rule, today: ISODate, count: number): ISODate[] {
  if (rule.kind === "irregular") return [];
  const out: ISODate[] = [];

  if (rule.kind === "weekly" || rule.kind === "every_n_weeks") {
    const step = rule.kind === "weekly" ? 7 : 7 * rule.intervalWeeks;
    let d = addDays(nextOccurrences(rule, today, 1)[0], -step);
    while (out.length < count) {
      out.push(d);
      d = addDays(d, -step);
    }
    return out;
  }

  let year = Number(today.slice(0, 4));
  let month = Number(today.slice(5, 7));
  for (let i = 0; i < count + 2 && out.length < count; i++) {
    const d = nthWeekdayOfMonth(year, month, rule.weekday, rule.nth);
    if (d < today) out.push(d);
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

function staleThreshold(rule: Rule): number {
  switch (rule.kind) {
    case "weekly":
      return 14;
    case "every_n_weeks":
      return 7 * rule.intervalWeeks * 2;
    case "monthly_nth":
      return 62;
    case "irregular":
      return IRREGULAR_STALE_DAYS;
  }
}

export function confidence(rule: Rule, events: DeliveryEvent[], today: ISODate): Confidence {
  const predicted = previousOccurrences(rule, today, WINDOW);
  const happened = events.filter((e) => e.happened).map((e) => e.date);
  const matched = predicted.filter((p) =>
    happened.some((h) => Math.abs(daysBetween(p, h)) <= 1),
  ).length;

  const last = events.reduce<ISODate | null>((acc, e) => (acc === null || e.date > acc ? e.date : acc), null);
  const daysSinceLastEvent = last === null ? null : daysBetween(last, today);
  const stale = daysSinceLastEvent === null || daysSinceLastEvent > staleThreshold(rule);

  return { matched, total: predicted.length, daysSinceLastEvent, stale };
}
