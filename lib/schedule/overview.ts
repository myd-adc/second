import type { StoreWithDetails } from "../db/types";
import { closesAt as closesAtFn, isOpenAt } from "../opening-hours";
import { confidence, type Confidence } from "./confidence";
import { daysBetween } from "./dates";
import { predictIrregular } from "./irregular";
import { nextOccurrences } from "./occurrences";
import { todayInKyiv } from "./today";
import type { ISODate, Rule } from "./types";

export type StoreOverview = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  nextDelivery: ISODate | null;
  daysUntil: number | null;
  openNow: boolean;
  closesAt: string | null;
  ruleLabel: string;
  confidence: Confidence | null;
};

const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];
const NO_SCHEDULE = "без графіка";

export function ruleLabel(rule: Rule): string {
  switch (rule.kind) {
    case "weekly":
      return `щотижня, ${WEEKDAY_SHORT[rule.weekday]}`;
    case "every_n_weeks": {
      const word = rule.intervalWeeks >= 5 ? "тижнів" : "тижні";
      return `кожні ${rule.intervalWeeks} ${word}, ${WEEKDAY_SHORT[rule.weekday]}`;
    }
    case "monthly_nth":
      return rule.nth === -1
        ? `останній ${WEEKDAY_SHORT[rule.weekday]} місяця`
        : `кожен ${rule.nth}-й ${WEEKDAY_SHORT[rule.weekday]} місяця`;
    case "irregular":
      return NO_SCHEDULE;
  }
}

function overviewOf(store: StoreWithDetails, now: Date, today: ISODate): StoreOverview {
  const active = store.rules.filter((r) => r.isActive).map((r) => r.rule);

  let best: { date: ISODate; rule: Rule } | null = null;
  const consider = (date: ISODate | null | undefined, rule: Rule) => {
    if (date && (best === null || date < best.date)) best = { date, rule };
  };

  for (const rule of active) {
    if (rule.kind !== "irregular") consider(nextOccurrences(rule, today, 1)[0], rule);
  }
  if (active.length === 0 || active.some((r) => r.kind === "irregular")) {
    consider(predictIrregular(store.events, today), { kind: "irregular" });
  }

  const winner = best as { date: ISODate; rule: Rule } | null;
  const nextDelivery = winner?.date ?? null;

  return {
    id: store.id,
    name: store.name,
    lat: store.lat,
    lng: store.lng,
    nextDelivery,
    daysUntil: nextDelivery === null ? null : daysBetween(today, nextDelivery),
    openNow: isOpenAt(store.hours, now),
    closesAt: closesAtFn(store.hours, now),
    ruleLabel: active.length === 0 ? NO_SCHEDULE : active.map(ruleLabel).join("; "),
    confidence: confidence(winner?.rule ?? { kind: "irregular" }, store.events, today),
  };
}

export function buildOverview(stores: StoreWithDetails[], now: Date): StoreOverview[] {
  const today = todayInKyiv(now);
  return stores.map((s) => overviewOf(s, now, today)).sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) {
      if (a.daysUntil === null) return 1;
      if (b.daysUntil === null) return -1;
      return a.daysUntil - b.daysUntil;
    }
    return a.name.localeCompare(b.name, "uk");
  });
}
