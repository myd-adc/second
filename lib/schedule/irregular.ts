import { addDays, daysBetween } from "./dates";
import type { DeliveryEvent, ISODate } from "./types";

export function predictIrregular(events: DeliveryEvent[], from: ISODate): ISODate | null {
  const facts = events
    .filter((e) => e.happened)
    .map((e) => e.date)
    .sort()
    .slice(-5);
  if (facts.length < 3) return null;

  const intervals = facts.slice(1).map((d, i) => daysBetween(facts[i], d));
  const sorted = [...intervals].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : Math.floor((sorted[mid - 1] + sorted[mid] + 1) / 2);
  if (median <= 0) return null;

  let d = addDays(facts[facts.length - 1], median);
  while (d < from) d = addDays(d, median);
  return d;
}
